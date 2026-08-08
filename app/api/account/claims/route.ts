import { getRuntimeDb } from "../../../../db/runtime";
import { assertSameOrigin, audit, cleanText, enforceRateLimit, jsonError, notify, PlatformError, requireAuthenticatedUser } from "../../../server/platform";

export async function GET() {
  try {
    const account = await requireAuthenticatedUser();
    const claims = await getRuntimeDb().prepare("SELECT bc.*,b.name business_name,b.slug business_slug FROM business_claims bc JOIN businesses b ON b.id=bc.business_id WHERE bc.requester_user_id=? ORDER BY bc.submitted_at DESC").bind(account.id).all();
    const invites = await getRuntimeDb().prepare("SELECT bm.*,b.name business_name FROM business_memberships bm JOIN businesses b ON b.id=bm.business_id WHERE bm.user_id=? AND bm.membership_status='invited' ORDER BY bm.invited_at DESC").bind(account.id).all();
    return Response.json({ claims: claims.results, invitations: invites.results });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const account = await requireAuthenticatedUser();
    const body = await request.json() as Record<string, unknown>;
    const action = cleanText(body.action, 30);
    const db = getRuntimeDb();
    if (action === "accept_invitation" || action === "decline_invitation") {
      const membershipId = Number(body.membershipId);
      const status = action === "accept_invitation" ? "active" : "revoked";
      const result = await db.prepare("UPDATE business_memberships SET membership_status=?,accepted_at=CASE WHEN ?='active' THEN CURRENT_TIMESTAMP ELSE accepted_at END,revoked_at=CASE WHEN ?='revoked' THEN CURRENT_TIMESTAMP ELSE revoked_at END WHERE id=? AND user_id=? AND membership_status='invited'")
        .bind(status, status, status, membershipId, account.id).run();
      if (!result.meta.changes) throw new PlatformError(404, "Invitația nu mai este disponibilă.");
      await audit(account, `business.invitation_${status}`, "business_membership", membershipId);
      return Response.json({ ok: true, status });
    }
    await enforceRateLimit(account,"business.claim_submitted",5,1440);
    const businessId = Number(body.businessId);
    if (!Number.isInteger(businessId) || businessId <= 0) throw new PlatformError(400, "Selectează afacerea.");
    const business = await db.prepare("SELECT id,name FROM businesses WHERE id=? AND deleted_at IS NULL AND visibility='public' LIMIT 1").bind(businessId).first<{ id: number; name: string }>();
    if (!business) throw new PlatformError(404, "Afacerea nu poate fi revendicată.");
    const result = await db.prepare("INSERT INTO business_claims (business_id,requester_user_id,claim_type,explanation,evidence_url,contact_information,status) VALUES (?,?,'existing_business',?,?,?,'pending_review')")
      .bind(businessId, account.id, cleanText(body.explanation, 3000, true), cleanText(body.evidenceUrl, 800) || null, cleanText(body.contactInformation, 1000, true)).run();
    await audit(account, "business.claim_submitted", "business", businessId, { claimId: result.meta.last_row_id });
    await notify(account.id, "business_claim_submitted", "Revendicare trimisă", `Cererea pentru ${business.name} a intrat în verificare.`, "business_claim", result.meta.last_row_id, "/cont/cereri");
    return Response.json({ id: result.meta.last_row_id, status: "pending_review" }, { status: 201 });
  } catch (error) { return jsonError(error); }
}
