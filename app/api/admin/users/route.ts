import { getRuntimeDb } from "../../../../db/runtime";
import { assertSameOrigin, audit, cleanText, globalRoles, isAdmin, jsonError, notify, PlatformError, requireAuthenticatedUser } from "../../../server/platform";

export async function GET(request: Request) {
  try {
    const account = await requireAuthenticatedUser();
    if (!isAdmin(account)) throw new PlatformError(403, "Acces administrativ necesar.");
    const q = `%${cleanText(new URL(request.url).searchParams.get("q"), 180)}%`;
    const rows = await getRuntimeDb().prepare("SELECT id,email,display_name,global_role,account_status,created_at,last_login_at,suspended_at,suspension_reason FROM users WHERE display_name LIKE ? OR email LIKE ? ORDER BY created_at DESC LIMIT 200").bind(q, q).all();
    return Response.json({ items: rows.results });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const account = await requireAuthenticatedUser();
    if (!isAdmin(account)) throw new PlatformError(403, "Acces administrativ necesar.");
    const body = await request.json() as Record<string, unknown>;
    const userId = Number(body.userId);
    const action = cleanText(body.action, 30, true);
    const reason = cleanText(body.reason, 2000);
    const db = getRuntimeDb();
    const target = await db.prepare("SELECT id,global_role,account_status FROM users WHERE id=?").bind(userId).first<{ id: number; global_role: string; account_status: string }>();
    if (!target) throw new PlatformError(404, "Contul nu există.");
    if (action === "role") {
      const role = cleanText(body.role, 40) as (typeof globalRoles)[number];
      if (!globalRoles.includes(role)) throw new PlatformError(400, "Rol invalid.");
      if (["admin", "platform_owner"].includes(role) || ["admin", "platform_owner"].includes(target.global_role)) {
        if (account.globalRole !== "platform_owner") throw new PlatformError(403, "Doar proprietarul platformei poate gestiona administratori.");
      }
      if (target.global_role === "platform_owner" && role !== "platform_owner") {
        const owners = await db.prepare("SELECT COUNT(*) count FROM users WHERE global_role='platform_owner' AND account_status='active'").first<{ count: number }>();
        if ((owners?.count ?? 0) <= 1) throw new PlatformError(409, "Ultimul proprietar activ al platformei nu poate fi retrogradat.");
      }
      await db.batch([
        db.prepare("UPDATE users SET global_role=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(role, userId),
        db.prepare("INSERT INTO role_history (user_id,previous_role,new_role,changed_by,reason) VALUES (?,?,?,?,?)").bind(userId, target.global_role, role, account.id, reason || null),
        db.prepare("INSERT INTO audit_logs (actor_user_id,action,entity_type,entity_id,metadata) VALUES (?,'user.role_changed','user',?,?)").bind(account.id, String(userId), JSON.stringify({ previousRole: target.global_role, newRole: role, reason: reason || null })),
      ]);
      await notify(userId, "role_change", "Rol actualizat", `Rolul tău pe Blaj Azi este acum ${role}.`, "user", userId, "/cont");
      return Response.json({ id: userId, role });
    }
    if (action === "suspend" || action === "reactivate") {
      if (action === "suspend" && !reason) throw new PlatformError(400, "Motivul suspendării este obligatoriu.");
      if (target.global_role === "platform_owner" && action === "suspend") {
        const owners = await db.prepare("SELECT COUNT(*) count FROM users WHERE global_role='platform_owner' AND account_status='active'").first<{ count: number }>();
        if ((owners?.count ?? 0) <= 1) throw new PlatformError(409, "Ultimul proprietar activ al platformei nu poate fi suspendat.");
      }
      const status = action === "suspend" ? "suspended" : "active";
      await db.prepare("UPDATE users SET account_status=?,suspended_at=CASE WHEN ?='suspended' THEN CURRENT_TIMESTAMP ELSE NULL END,suspension_reason=CASE WHEN ?='suspended' THEN ? ELSE NULL END,updated_at=CURRENT_TIMESTAMP WHERE id=?")
        .bind(status, status, status, reason || null, userId).run();
      await audit(account, `user.${action}`, "user", userId, { reason: reason || null });
      await notify(userId, action === "suspend" ? "account_suspension" : "account_reactivated", action === "suspend" ? "Cont suspendat" : "Cont reactivat", reason || "Contul tău a fost reactivat.", "user", userId, "/cont");
      return Response.json({ id: userId, status });
    }
    throw new PlatformError(400, "Acțiune invalidă.");
  } catch (error) { return jsonError(error); }
}
