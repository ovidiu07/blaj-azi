import { env } from "cloudflare:workers";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getChatGPTUser } from "../chatgpt-auth";
import { getRuntimeDb } from "../../db/runtime";
import { AuthError, normalizeEmailAddress, resolveSessionToken, safeReturnPath, SECURE_SESSION_COOKIE, SESSION_COOKIE } from "./auth";
import type { AuthUserRow } from "./auth";

export const globalRoles = ["user", "business_owner", "admin", "platform_owner"] as const;
export type GlobalRole = (typeof globalRoles)[number];
export type AccountStatus = "active" | "suspended" | "closed";

export type LocalAccount = {
  id: number;
  externalUserId: string;
  email: string;
  normalizedEmail: string;
  displayName: string;
  avatarUrl: string | null;
  globalRole: GlobalRole;
  accountStatus: AccountStatus;
  createdAt: string;
  lastLoginAt: string;
};

export class PlatformError extends Error {
  status: number;
  code: string;
  constructor(status: number, message: string, code = "platform_error") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

type UserRow = AuthUserRow;

function mapUser(row: UserRow): LocalAccount {
  return {
    id: row.id,
    externalUserId: row.external_user_id,
    email: row.email,
    normalizedEmail: row.normalized_email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    globalRole: row.global_role,
    accountStatus: row.account_status,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  };
}

export function normalizeEmail(email: string): string {
  return normalizeEmailAddress(email);
}

async function persistIdentity(identity: Awaited<ReturnType<typeof getChatGPTUser>>): Promise<LocalAccount | null> {
  if (!identity) return null;
  const db = getRuntimeDb();
  const normalizedEmail = normalizeEmail(identity.email);
  const existing = await db
    .prepare("SELECT * FROM users WHERE external_user_id = ? LIMIT 1")
    .bind(identity.userId)
    .first<UserRow>();

  const emailOwner = !existing ? await db.prepare("SELECT id FROM users WHERE normalized_email=? LIMIT 1").bind(normalizedEmail).first<{ id: number }>() : null;
  if (emailOwner) {
    throw new PlatformError(409, "Adresa de e-mail este deja legată de o altă identitate.", "identity_conflict");
  }

  if (!existing) {
    const bootstrapEmail = normalizeEmail(String(env.ADMIN_EMAIL || ""));
    const owner = await db
      .prepare("SELECT id FROM users WHERE global_role = 'platform_owner' AND account_status = 'active' LIMIT 1")
      .first<{ id: number }>();
    const role: GlobalRole = !owner && bootstrapEmail && bootstrapEmail === normalizedEmail ? "platform_owner" : "user";
    await db.batch([
      db.prepare("INSERT INTO users (external_user_id,email,normalized_email,display_name,global_role,account_status,email_verified_at) VALUES (?,?,?,?,?,'active',CURRENT_TIMESTAMP)")
        .bind(identity.userId, identity.email.trim(), normalizedEmail, identity.displayName.slice(0, 180), role),
      db.prepare("INSERT INTO auth_identities (user_id,provider,provider_subject,provider_email,email_verified) SELECT id,'chatgpt',?,?,1 FROM users WHERE external_user_id=?")
        .bind(identity.userId, identity.email.trim(), identity.userId),
      db.prepare("INSERT INTO audit_logs (actor_user_id,action,entity_type,entity_id,metadata) VALUES (NULL,'account.created','user',NULL,?)")
        .bind(JSON.stringify({ role, source: "trusted_identity" })),
    ]);
  } else {
    await db.batch([
      db.prepare("UPDATE users SET email=?, normalized_email=?, display_name=COALESCE(?,display_name), email_verified_at=COALESCE(email_verified_at,CURRENT_TIMESTAMP), updated_at=CURRENT_TIMESTAMP, last_login_at=CURRENT_TIMESTAMP WHERE id=?")
        .bind(identity.email.trim(), normalizedEmail, identity.fullName?.slice(0, 180) ?? null, existing.id),
      db.prepare("INSERT INTO auth_identities (user_id,provider,provider_subject,provider_email,email_verified,last_used_at) VALUES (?,'chatgpt',?,?,1,CURRENT_TIMESTAMP) ON CONFLICT(provider,provider_subject) DO UPDATE SET provider_email=excluded.provider_email,email_verified=1,last_used_at=CURRENT_TIMESTAMP")
        .bind(existing.id, identity.userId, identity.email.trim()),
    ]);
  }

  const row = await db.prepare("SELECT * FROM users WHERE external_user_id=? LIMIT 1").bind(identity.userId).first<UserRow>();
  if (!row) throw new PlatformError(500, "Contul local nu a putut fi creat.");

  await db.prepare("UPDATE business_memberships SET user_id=? WHERE user_id IS NULL AND lower(invite_email)=? AND membership_status='invited'")
    .bind(row.id, normalizedEmail)
    .run();
  return mapUser(row);
}

export async function getOptionalAccount(): Promise<LocalAccount | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SECURE_SESSION_COOKIE)?.value || cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    const sessionAccount = await resolveSessionToken(token).catch(() => null);
    if (sessionAccount) return mapUser(sessionAccount);
  }
  return persistIdentity(await getChatGPTUser());
}

export async function requireAccountForPage(returnTo: string, loginPath = "/conectare"): Promise<LocalAccount> {
  const account = await getOptionalAccount();
  if (!account) redirect(`${loginPath}?return_to=${encodeURIComponent(safeReturnPath(returnTo, "/"))}`);
  assertActive(account);
  return account;
}

export async function requireAuthenticatedUser(): Promise<LocalAccount> {
  const account = await getOptionalAccount();
  if (!account) throw new PlatformError(401, "Conectează-te pentru a continua.", "authentication_required");
  assertActive(account);
  return account;
}

export function assertActive(account: LocalAccount): void {
  if (account.accountStatus !== "active") {
    throw new PlatformError(403, "Acest cont este suspendat sau închis.", "account_inactive");
  }
}

export function isAdmin(account: LocalAccount): boolean {
  return account.globalRole === "admin" || account.globalRole === "platform_owner";
}

export function requireGlobalRole(account: LocalAccount, ...roles: GlobalRole[]): void {
  if (!roles.includes(account.globalRole)) throw new PlatformError(403, "Nu ai permisiunea pentru această acțiune.", "forbidden");
}

export async function requireBusinessMembership(account: LocalAccount, businessId: number, minimum: "manager" | "owner" = "manager") {
  if (isAdmin(account)) return { membership_role: "owner", membership_status: "active" };
  const membership = await getRuntimeDb()
    .prepare("SELECT membership_role,membership_status,permissions FROM business_memberships WHERE business_id=? AND user_id=? AND membership_status='active' LIMIT 1")
    .bind(businessId, account.id)
    .first<{ membership_role: "owner" | "manager"; membership_status: string; permissions: string | null }>();
  if (!membership || (minimum === "owner" && membership.membership_role !== "owner")) {
    throw new PlatformError(403, "Nu poți administra această afacere.", "business_membership_required");
  }
  return membership;
}

export async function canManageEntity(account: LocalAccount, contentId: number): Promise<boolean> {
  if (isAdmin(account)) return true;
  const record = await getRuntimeDb().prepare("SELECT owner_user_id,business_id FROM content_records WHERE id=? AND deleted_at IS NULL")
    .bind(contentId).first<{ owner_user_id: number | null; business_id: number | null }>();
  if (!record) return false;
  if (record.owner_user_id === account.id) return true;
  if (record.business_id) {
    const membership = await getRuntimeDb().prepare("SELECT id FROM business_memberships WHERE business_id=? AND user_id=? AND membership_status='active' LIMIT 1")
      .bind(record.business_id, account.id).first<{ id: number }>();
    return Boolean(membership);
  }
  return false;
}

export function canModerate(account: LocalAccount): boolean {
  return isAdmin(account);
}

export function canPublish(account: LocalAccount): boolean {
  return isAdmin(account);
}

export function canPermanentlyDelete(account: LocalAccount): boolean {
  return account.globalRole === "platform_owner";
}

export function assertSameOrigin(request: Request): void {
  const site = request.headers.get("sec-fetch-site");
  if (site === "cross-site") throw new PlatformError(403, "Cerere respinsă.", "cross_site_request");
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new PlatformError(403, "Cerere respinsă.", "origin_mismatch");
}

export async function audit(account: LocalAccount | null, action: string, entityType: string, entityId: string | number | null, metadata?: unknown) {
  await getRuntimeDb().prepare("INSERT INTO audit_logs (actor_user_id,action,entity_type,entity_id,metadata) VALUES (?,?,?,?,?)")
    .bind(account?.id ?? null, action, entityType, entityId == null ? null : String(entityId), metadata == null ? null : JSON.stringify(metadata))
    .run();
}

export async function notify(userId: number, notificationType: string, title: string, message: string, entityType?: string, entityId?: string | number, href?: string) {
  await getRuntimeDb().prepare("INSERT INTO notifications (user_id,notification_type,title,message,related_entity_type,related_entity_id,href) VALUES (?,?,?,?,?,?,?)")
    .bind(userId, notificationType, title, message, entityType ?? null, entityId == null ? null : String(entityId), href ?? null)
    .run();
}

export async function enforceRateLimit(account: LocalAccount, auditAction: string, maximum: number, windowMinutes: number) {
  const row=await getRuntimeDb().prepare("SELECT COUNT(*) count FROM audit_logs WHERE actor_user_id=? AND action=? AND created_at>=datetime('now',?)")
    .bind(account.id,auditAction,`-${windowMinutes} minutes`).first<{count:number}>();
  if((row?.count??0)>=maximum)throw new PlatformError(429,"Ai făcut prea multe solicitări într-un timp scurt. Încearcă din nou mai târziu.","rate_limited");
}

export function jsonError(error: unknown): Response {
  if (error instanceof AuthError) return Response.json({ error: error.message, code: error.code }, { status: error.status });
  if (error instanceof PlatformError) return Response.json({ error: error.message, code: error.code }, { status: error.status });
  console.error("platform_request_failed", error instanceof Error ? error.message : "unknown");
  return Response.json({ error: "Nu am putut finaliza operațiunea." }, { status: 500 });
}

export function safeSlug(input: string): string {
  return input.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100) || "continut";
}

export function cleanText(value: unknown, max: number, required = false): string {
  const result = String(value ?? "").replace(/[<>]/g, "").trim().slice(0, max);
  if (required && !result) throw new PlatformError(400, "Completează toate câmpurile obligatorii.", "validation_error");
  return result;
}
