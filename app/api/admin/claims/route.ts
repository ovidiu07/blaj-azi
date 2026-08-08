import { getRuntimeDb } from "../../../../db/runtime";
import { assertSameOrigin, audit, cleanText, isAdmin, jsonError, notify, PlatformError, requireAuthenticatedUser } from "../../../server/platform";

export async function GET() {
  try {
    const account = await requireAuthenticatedUser();
    if (!isAdmin(account)) throw new PlatformError(403, "Acces administrativ necesar.");
    const rows = await getRuntimeDb().prepare("SELECT bc.*,b.name business_name,u.display_name requester_name,u.email requester_email FROM business_claims bc JOIN businesses b ON b.id=bc.business_id JOIN users u ON u.id=bc.requester_user_id WHERE bc.status IN ('pending_review','needs_changes') ORDER BY bc.submitted_at").all();
    return Response.json({ items: rows.results });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const account = await requireAuthenticatedUser();
    if (!isAdmin(account)) throw new PlatformError(403, "Acces administrativ necesar.");
    const body = await request.json() as Record<string, unknown>;
    const claimId = Number(body.id);
    const action = cleanText(body.action, 30, true);
    const note = cleanText(body.note, 2000);
    if (["reject", "needs_changes"].includes(action) && !note) throw new PlatformError(400, "Nota este obligatorie.");
    const db = getRuntimeDb();
    const claim = await db.prepare("SELECT bc.*,u.global_role requester_role FROM business_claims bc JOIN users u ON u.id=bc.requester_user_id WHERE bc.id=? AND bc.status IN ('pending_review','needs_changes')").bind(claimId).first<{ id: number; business_id: number; requester_user_id: number; claim_type: string; status: string;requester_role:string }>();
    if (!claim) throw new PlatformError(404, "Cererea nu mai este disponibilă.");
    if (claim.requester_user_id === account.id) throw new PlatformError(403, "Nu îți poți aproba propria revendicare.");
    const target = action === "approve" ? "approved" : action === "reject" ? "rejected" : action === "needs_changes" ? "needs_changes" : "";
    if (!target) throw new PlatformError(400, "Acțiune invalidă.");
    const statements: D1PreparedStatement[] = [
      db.prepare("UPDATE business_claims SET status=?,reviewer_id=?,reviewer_note=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=?").bind(target, account.id, note || null, claimId),
      db.prepare("INSERT INTO audit_logs (actor_user_id,action,entity_type,entity_id,metadata) VALUES (?,'business_claim.reviewed','business_claim',?,?)").bind(account.id, String(claimId), JSON.stringify({ target, businessId: claim.business_id })),
    ];
    if (target === "approved") {
      statements.push(
        db.prepare("INSERT INTO business_memberships (business_id,user_id,membership_role,membership_status,invited_by,accepted_at) VALUES (?,?,'owner','active',?,CURRENT_TIMESTAMP) ON CONFLICT(business_id,user_id) DO UPDATE SET membership_role='owner',membership_status='active',accepted_at=CURRENT_TIMESTAMP,revoked_at=NULL").bind(claim.business_id, claim.requester_user_id, account.id),
        db.prepare("UPDATE users SET global_role=CASE WHEN global_role='user' THEN 'business_owner' ELSE global_role END,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(claim.requester_user_id),
        db.prepare("UPDATE businesses SET moderation_status='approved',status='published',visibility='public',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(claim.business_id),
        db.prepare("UPDATE content_records SET owner_user_id=?,business_id=?,status='published',moderation_state='approved',visibility='public',published_by=?,published_at=COALESCE(published_at,CURRENT_TIMESTAMP),updated_at=CURRENT_TIMESTAMP,version=version+1 WHERE type='business' AND entity_id=?").bind(claim.requester_user_id, claim.business_id, account.id, claim.business_id),
      );
      if(claim.requester_role==="user")statements.push(
        db.prepare("INSERT INTO role_history (user_id,previous_role,new_role,changed_by,reason) VALUES (?,'user','business_owner',?,'Revendicare de afacere aprobată')").bind(claim.requester_user_id,account.id),
        db.prepare("INSERT INTO audit_logs (actor_user_id,action,entity_type,entity_id,metadata) VALUES (?,'user.role_changed','user',?,?)").bind(account.id,String(claim.requester_user_id),JSON.stringify({previousRole:"user",newRole:"business_owner",source:"business_claim"})),
      );
    }
    await db.batch(statements);
    await audit(account, target === "approved" ? "business.ownership_granted" : `business.claim_${target}`, "business", claim.business_id, { claimId });
    await notify(claim.requester_user_id, `business_claim_${target}`, target === "approved" ? "Revendicare aprobată" : target === "rejected" ? "Revendicare respinsă" : "Sunt necesare informații", note || "Cererea ta a fost actualizată.", "business_claim", claimId, "/cont/cereri");
    return Response.json({ id: claimId, status: target });
  } catch (error) { return jsonError(error); }
}
