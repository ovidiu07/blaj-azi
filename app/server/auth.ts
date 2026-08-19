import { scrypt as scryptCallback } from "node:crypto";
import { getRuntimeDb } from "../../db/runtime";

export const PASSWORD_HASH_VERSION = "scrypt-v1";
export const PASSWORD_COST = 16_384;
export const SESSION_COOKIE = "blaj_session";
export const SECURE_SESSION_COOKIE = "__Host-blaj_session";

const encoder = new TextEncoder();
const dummySalt = "Ymxhai1hemlfZHVtbXlfc2FsdA";
const legacyPasswordHashVersion = "pbkdf2-sha256-v1";
const maxLegacyPbkdf2Iterations = 100_000;
const scryptBlockSize = 8;
const scryptParallelization = 1;
const scryptKeyLength = 32;
const scryptMaxMemory = 32 * 1024 * 1024;
const maxSupportedScryptCost = 32_768;
const authPaths = new Set([
  "/conectare",
  "/inregistrare",
  "/deconectare",
  "/admin/conectare",
  "/signin-with-chatgpt",
  "/signout-with-chatgpt",
  "/callback",
]);

export type AuthUserRow = {
  id: number;
  external_user_id: string;
  email: string;
  normalized_email: string;
  display_name: string;
  avatar_url: string | null;
  global_role: "user" | "business_owner" | "admin" | "platform_owner";
  account_status: "active" | "suspended" | "closed";
  created_at: string;
  last_login_at: string;
};

type CredentialRow = AuthUserRow & {
  hash_version: string;
  password_hash: string;
  salt: string;
  iterations: number;
};

export class AuthError extends Error {
  status: number;
  code: string;

  constructor(status: number, message: string, code = "authentication_error") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function normalizeEmailAddress(email: string): string {
  return email.trim().toLocaleLowerCase("ro-RO");
}

export function safeReturnPath(value: unknown, fallback = "/"): string {
  const raw = typeof value === "string" ? value : "";
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return fallback;
  try {
    const url = new URL(raw, "https://blaj-azi.local");
    if (url.origin !== "https://blaj-azi.local" || authPaths.has(url.pathname)) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export async function hashPassword(password: string, cost = PASSWORD_COST) {
  if (!isSupportedScryptCost(cost)) throw new Error("Unsupported scrypt cost.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return {
    hashVersion: PASSWORD_HASH_VERSION,
    passwordHash: toBase64Url(await deriveScryptPassword(password, salt, cost)),
    salt: toBase64Url(salt),
    iterations: cost,
  };
}

export async function verifyPassword(password: string, credential?: Pick<CredentialRow, "hash_version" | "password_hash" | "salt" | "iterations"> | null) {
  try {
    if (credential?.hash_version === PASSWORD_HASH_VERSION && isSupportedScryptCost(credential.iterations)) {
      const actual = await deriveScryptPassword(password, fromBase64Url(credential.salt), credential.iterations);
      return constantTimeEqual(actual, fromBase64Url(credential.password_hash));
    }
    if (credential?.hash_version === legacyPasswordHashVersion && isSupportedLegacyPbkdf2Iterations(credential.iterations)) {
      const actual = await deriveLegacyPbkdf2Password(password, fromBase64Url(credential.salt), credential.iterations);
      return constantTimeEqual(actual, fromBase64Url(credential.password_hash));
    }
  } catch {
    // Treat malformed or unsupported stored credentials exactly like invalid credentials.
  }
  await deriveScryptPassword(password, fromBase64Url(dummySalt), PASSWORD_COST);
  return false;
}

function deriveScryptPassword(password: string, salt: Uint8Array, cost: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    scryptCallback(
      password,
      salt,
      scryptKeyLength,
      { N: cost, r: scryptBlockSize, p: scryptParallelization, maxmem: scryptMaxMemory },
      (error, derivedKey) => error ? reject(error) : resolve(new Uint8Array(derivedKey)),
    );
  });
}

async function deriveLegacyPbkdf2Password(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const saltBuffer = new Uint8Array(salt).buffer;
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: saltBuffer, iterations }, key, 256);
  return new Uint8Array(bits);
}

function isSupportedScryptCost(cost: number): boolean {
  return Number.isInteger(cost) && cost >= 2 && cost <= maxSupportedScryptCost && (cost & (cost - 1)) === 0;
}

function isSupportedLegacyPbkdf2Iterations(iterations: number): boolean {
  return Number.isInteger(iterations) && iterations > 0 && iterations <= maxLegacyPbkdf2Iterations;
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  let mismatch = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) mismatch |= (left[index] ?? 0) ^ (right[index] ?? 0);
  return mismatch === 0;
}

export async function sha256(value: string): Promise<string> {
  return toBase64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));
}

export async function registerCredentialUser(
  input: Record<string, unknown>,
  request: Request,
  db: D1Database = getRuntimeDb(),
) {
  const displayName = String(input.name ?? "").trim().replace(/\s+/g, " ").slice(0, 180);
  const email = String(input.email ?? "").trim().slice(0, 254);
  const normalizedEmail = normalizeEmailAddress(email);
  const password = String(input.password ?? "");
  const confirmation = String(input.passwordConfirmation ?? "");
  if (displayName.length < 2) throw new AuthError(400, "Completează numele tău.", "validation_error");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) throw new AuthError(400, "Introdu o adresă de e-mail validă.", "validation_error");
  if (password.length < 12 || password.length > 128) throw new AuthError(400, "Parola trebuie să aibă între 12 și 128 de caractere.", "validation_error");
  if (password !== confirmation) throw new AuthError(400, "Parolele nu coincid.", "validation_error");
  if (input.acceptTerms !== true || input.acceptPrivacy !== true) throw new AuthError(400, "Acceptă Termenii și Politica de confidențialitate.", "validation_error");

  const fingerprint = await authFingerprint(request, "register", "");
  await enforceAuthRateLimit(db, "register", fingerprint, 5, 60);
  if (await db.prepare("SELECT id FROM users WHERE normalized_email=? LIMIT 1").bind(normalizedEmail).first()) {
    await recordAuthAttempt(db, "register", fingerprint, false);
    throw new AuthError(409, "Contul nu a putut fi creat cu datele trimise.", "registration_unavailable");
  }

  const credential = await hashPassword(password);
  const subject = crypto.randomUUID();
  const externalUserId = `password:${subject}`;
  try {
    await db.batch([
      db.prepare("INSERT INTO users (external_user_id,email,normalized_email,display_name,global_role,account_status,terms_accepted_at,privacy_accepted_at) VALUES (?,?,?,?,'user','active',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)")
        .bind(externalUserId, email, normalizedEmail, displayName),
      db.prepare("INSERT INTO auth_identities (user_id,provider,provider_subject,provider_email,email_verified) SELECT id,'password',?,?,0 FROM users WHERE external_user_id=?")
        .bind(subject, email, externalUserId),
      db.prepare("INSERT INTO password_credentials (user_id,hash_version,password_hash,salt,iterations) SELECT id,?,?,?,? FROM users WHERE external_user_id=?")
        .bind(credential.hashVersion, credential.passwordHash, credential.salt, credential.iterations, externalUserId),
      db.prepare("INSERT INTO audit_logs (actor_user_id,action,entity_type,entity_id,metadata) SELECT id,'account.created','user',CAST(id AS TEXT),? FROM users WHERE external_user_id=?")
        .bind(JSON.stringify({ role: "user", source: "password_registration" }), externalUserId),
      db.prepare("INSERT INTO auth_attempts (action,fingerprint,succeeded) VALUES ('register',?,1)").bind(fingerprint),
    ]);
  } catch (error) {
    if (/unique|constraint/i.test(error instanceof Error ? error.message : "")) {
      throw new AuthError(409, "Contul nu a putut fi creat cu datele trimise.", "registration_unavailable");
    }
    throw error;
  }
  const account = await db.prepare("SELECT * FROM users WHERE external_user_id=? LIMIT 1").bind(externalUserId).first<AuthUserRow>();
  if (!account) throw new AuthError(500, "Contul nu a putut fi creat.");
  await claimPendingInvitations(db, account.id, normalizedEmail);
  return { account, session: await createSession(db, account.id, request, false) };
}

export async function authenticateCredentialUser(
  input: Record<string, unknown>,
  request: Request,
  db: D1Database = getRuntimeDb(),
) {
  const normalizedEmail = normalizeEmailAddress(String(input.email ?? "").slice(0, 254));
  const password = String(input.password ?? "");
  const remember = input.remember === true;
  const adminOnly = input.admin === true;
  const fingerprint = await authFingerprint(request, adminOnly ? "admin_login" : "login", normalizedEmail);
  await enforceAuthRateLimit(db, adminOnly ? "admin_login" : "login", fingerprint, 10, 15);
  const row = await db.prepare("SELECT u.*,pc.hash_version,pc.password_hash,pc.salt,pc.iterations FROM users u LEFT JOIN password_credentials pc ON pc.user_id=u.id WHERE u.normalized_email=? LIMIT 1")
    .bind(normalizedEmail).first<CredentialRow>();
  const valid = await verifyPassword(password, row?.password_hash ? row : null);
  const permitted = row?.account_status === "active" && (!adminOnly || row.global_role === "admin" || row.global_role === "platform_owner");
  if (!valid || !row || !permitted) {
    await recordAuthAttempt(db, adminOnly ? "admin_login" : "login", fingerprint, false);
    throw new AuthError(401, "E-mailul sau parola nu sunt corecte.", "invalid_credentials");
  }
  const currentToken = sessionTokenFromRequest(request);
  const session = await createSession(db, row.id, request, remember, currentToken);
  await db.batch([
    db.prepare("UPDATE users SET last_login_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(row.id),
    db.prepare("UPDATE auth_identities SET last_used_at=CURRENT_TIMESTAMP WHERE user_id=? AND provider='password'").bind(row.id),
    db.prepare("INSERT INTO auth_attempts (action,fingerprint,succeeded) VALUES (?,?,1)").bind(adminOnly ? "admin_login" : "login", fingerprint),
    db.prepare("INSERT INTO audit_logs (actor_user_id,action,entity_type,entity_id,metadata) VALUES (?,'session.created','user',?,?)")
      .bind(row.id, String(row.id), JSON.stringify({ source: "password", remember, adminEntry: adminOnly })),
  ]);
  return { account: row, session };
}

export async function createSession(db: D1Database, userId: number, request: Request, remember: boolean, previousToken?: string | null) {
  const token = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = await sha256(token);
  const id = crypto.randomUUID();
  const lifetimeSeconds = remember ? 30 * 24 * 60 * 60 : 12 * 60 * 60;
  const expires = new Date(Date.now() + lifetimeSeconds * 1000);
  const userAgentHash = await sha256(request.headers.get("user-agent") || "necunoscut");
  const statements = [
    db.prepare("INSERT INTO auth_sessions (id,user_id,token_hash,expires_at,remember,user_agent_hash) VALUES (?,?,?,?,?,?)")
      .bind(id, userId, tokenHash, sqliteTimestamp(expires), remember ? 1 : 0, userAgentHash),
  ];
  if (previousToken) statements.unshift(db.prepare("UPDATE auth_sessions SET revoked_at=COALESCE(revoked_at,CURRENT_TIMESTAMP) WHERE token_hash=?").bind(await sha256(previousToken)));
  await db.batch(statements);
  return { token, expires, lifetimeSeconds };
}

export async function resolveSessionToken(token: string, db: D1Database = getRuntimeDb()): Promise<AuthUserRow | null> {
  if (!/^[A-Za-z0-9_-]{40,100}$/.test(token)) return null;
  return db.prepare("SELECT u.* FROM auth_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.revoked_at IS NULL AND datetime(s.expires_at)>CURRENT_TIMESTAMP LIMIT 1")
    .bind(await sha256(token)).first<AuthUserRow>();
}

export async function revokeSessionToken(token: string | null, db: D1Database = getRuntimeDb()): Promise<void> {
  if (!token) return;
  await db.prepare("UPDATE auth_sessions SET revoked_at=COALESCE(revoked_at,CURRENT_TIMESTAMP) WHERE token_hash=?").bind(await sha256(token)).run();
}

export function sessionTokenFromRequest(request: Request): string | null {
  const cookies = Object.fromEntries((request.headers.get("cookie") || "").split(";").map(value => value.trim().split(/=(.*)/).slice(0, 2)).filter(pair => pair.length === 2));
  return cookies[SECURE_SESSION_COOKIE] || cookies[SESSION_COOKIE] || null;
}

export function sessionCookieHeader(request: Request, session: { token: string; expires: Date; lifetimeSeconds: number }): string {
  const secure = isSecureRequest(request);
  return `${secure ? SECURE_SESSION_COOKIE : SESSION_COOKIE}=${session.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${session.lifetimeSeconds}; Expires=${session.expires.toUTCString()}${secure ? "; Secure" : ""}`;
}

export function clearedSessionCookieHeaders(): string[] {
  const suffix = "=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT";
  return [`${SESSION_COOKIE}${suffix}`, `${SECURE_SESSION_COOKIE}${suffix}; Secure`];
}

export async function authFingerprint(request: Request, action: string, normalizedEmail: string): Promise<string> {
  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip") || "unknown";
  return sha256(`${action}|${ip}|${normalizedEmail}`);
}

export async function enforceAuthRateLimit(db: D1Database, action: string, fingerprint: string, maximum: number, windowMinutes: number) {
  const row = await db.prepare("SELECT COUNT(*) count FROM auth_attempts WHERE action=? AND fingerprint=? AND created_at>=datetime('now',?)")
    .bind(action, fingerprint, `-${windowMinutes} minutes`).first<{ count: number }>();
  if ((row?.count ?? 0) >= maximum) throw new AuthError(429, "Prea multe încercări. Încearcă din nou mai târziu.", "rate_limited");
}

async function recordAuthAttempt(db: D1Database, action: string, fingerprint: string, succeeded: boolean) {
  await db.batch([
    db.prepare("INSERT INTO auth_attempts (action,fingerprint,succeeded) VALUES (?,?,?)").bind(action, fingerprint, succeeded ? 1 : 0),
    db.prepare("DELETE FROM auth_attempts WHERE created_at<datetime('now','-7 days')"),
  ]);
}

async function claimPendingInvitations(db: D1Database, userId: number, normalizedEmail: string) {
  await db.prepare("UPDATE business_memberships SET user_id=? WHERE user_id IS NULL AND lower(invite_email)=? AND membership_status='invited'")
    .bind(userId, normalizedEmail).run();
}

function sqliteTimestamp(date: Date): string {
  return date.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");
}

function isSecureRequest(request: Request): boolean {
  return request.headers.get("x-forwarded-proto") === "https" || new URL(request.url).protocol === "https:";
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(base64), character => character.charCodeAt(0));
}
