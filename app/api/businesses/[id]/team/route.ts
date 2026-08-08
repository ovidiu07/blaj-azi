import { getRuntimeDb } from "../../../../../db/runtime";
import { assertSameOrigin, audit, cleanText, isAdmin, jsonError, normalizeEmail, notify, PlatformError, requireAuthenticatedUser, requireBusinessMembership } from "../../../../server/platform";

function parseId(value: string) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new PlatformError(400, "Identificator invalid.");
  return id;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const account = await requireAuthenticatedUser();
    const businessId = parseId((await params).id);
    await requireBusinessMembership(account, businessId);
    const rows = await getRuntimeDb().prepare("SELECT bm.id,bm.membership_role,bm.membership_status,bm.invite_email,bm.invited_at,bm.accepted_at,u.display_name,u.email FROM business_memberships bm LEFT JOIN users u ON u.id=bm.user_id WHERE bm.business_id=? ORDER BY CASE bm.membership_role WHEN 'owner' THEN 0 ELSE 1 END,bm.invited_at").bind(businessId).all();
    return Response.json({ items: rows.results });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const account = await requireAuthenticatedUser();
    const businessId = parseId((await params).id);
    await requireBusinessMembership(account, businessId, "owner");
    const body = await request.json() as Record<string, unknown>;
    const email = normalizeEmail(cleanText(body.email, 200, true));
    const role = body.role === "owner" && isAdmin(account) ? "owner" : "manager";
    const db = getRuntimeDb();
    const user = await db.prepare("SELECT id FROM users WHERE normalized_email=? LIMIT 1").bind(email).first<{ id: number }>();
    const existing = await db.prepare("SELECT id FROM business_memberships WHERE business_id=? AND (user_id=? OR lower(invite_email)=?) AND membership_status IN ('active','invited') LIMIT 1")
      .bind(businessId, user?.id ?? -1, email).first();
    if (existing) throw new PlatformError(409, "Persoana este deja membru sau are o invitație activă.");
    const result = await db.prepare("INSERT INTO business_memberships (business_id,user_id,invite_email,membership_role,membership_status,invited_by) VALUES (?,?,?,?,'invited',?)")
      .bind(businessId, user?.id ?? null, email, role, account.id).run();
    await audit(account, "business.manager_invited", "business", businessId, { membershipId: result.meta.last_row_id, role });
    if (user) await notify(user.id, "business_invitation", "Invitație în echipa unei afaceri", "Ai primit o invitație pe care o poți accepta din Contul meu.", "business_membership", result.meta.last_row_id, "/cont/cereri");
    return Response.json({ id: result.meta.last_row_id, status: "invited" }, { status: 201 });
  } catch (error) { return jsonError(error); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const account = await requireAuthenticatedUser();
    const businessId = parseId((await params).id);
    await requireBusinessMembership(account, businessId, "owner");
    const membershipId = Number(new URL(request.url).searchParams.get("membershipId"));
    const db = getRuntimeDb();
    const target = await db.prepare("SELECT id,user_id,membership_role,membership_status FROM business_memberships WHERE id=? AND business_id=?").bind(membershipId, businessId).first<{ id: number; user_id: number | null; membership_role: string; membership_status: string }>();
    if (!target) throw new PlatformError(404, "Membrul nu există.");
    if (target.membership_role === "owner" && !isAdmin(account)) throw new PlatformError(403, "Doar un administrator poate revoca un proprietar.");
    if (target.membership_role === "owner") {
      const owners = await db.prepare("SELECT COUNT(*) count FROM business_memberships WHERE business_id=? AND membership_role='owner' AND membership_status='active'").bind(businessId).first<{ count: number }>();
      if ((owners?.count ?? 0) <= 1) throw new PlatformError(409, "Ultimul proprietar activ nu poate fi eliminat.");
    }
    await db.prepare("UPDATE business_memberships SET membership_status='revoked',revoked_at=CURRENT_TIMESTAMP WHERE id=?").bind(membershipId).run();
    await audit(account, "business.membership_revoked", "business", businessId, { membershipId });
    if (target.user_id) await notify(target.user_id, "business_membership_revoked", "Acces la afacere retras", "Accesul tău la administrarea afacerii a fost retras.", "business", businessId, "/cont/afaceri");
    return Response.json({ ok: true });
  } catch (error) { return jsonError(error); }
}
