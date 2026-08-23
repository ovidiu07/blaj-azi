import { contentAction, createContent, validateBusinessPublicationInput } from "../../../server/content";
import { getRuntimeDb } from "../../../../db/runtime";
import { assertSameOrigin, audit, cleanText, enforceRateLimit, jsonError, notify, requireAuthenticatedUser } from "../../../server/platform";

export async function GET() {
  try {
    const account = await requireAuthenticatedUser();
    const rows = await getRuntimeDb().prepare("SELECT b.*,bm.membership_role,bm.membership_status FROM business_memberships bm JOIN businesses b ON b.id=bm.business_id WHERE bm.user_id=? AND bm.membership_status IN ('active','invited') AND b.deleted_at IS NULL ORDER BY b.name")
      .bind(account.id).all();
    return Response.json({ items: rows.results });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const account = await requireAuthenticatedUser();
    await enforceRateLimit(account,"business.registration_submitted",3,1440);
    const body = await request.json() as Record<string, unknown>;
    const input = {
      type: "business",
      title: cleanText(body.name, 240, true),
      excerpt: body.description,
      locality: cleanText(body.locality, 120, true),
      categoryId: Number(body.categoryId) || null,
      sourceUrl: cleanText(body.evidenceUrl, 800),
      details: { address: body.address, phone: body.phone, website: body.website, contactEmail:body.contactEmail, description: body.description },
    } as const;
    validateBusinessPublicationInput(input);
    const content = await createContent(account, input);
    const explanation = cleanText(body.explanation || "Solicitare de înscriere a unei afaceri noi.", 3000, true);
    const db = getRuntimeDb();
    await db.batch([
      db.prepare("INSERT INTO business_claims (business_id,requester_user_id,claim_type,explanation,evidence_url,contact_information,status) VALUES (?,?,'new_business',?,?,?,'pending_review')")
        .bind(content.entityId, account.id, explanation, cleanText(body.evidenceUrl, 800) || null, cleanText(body.contactInformation, 1000) || null),
      db.prepare("UPDATE businesses SET moderation_status='pending_review' WHERE id=?").bind(content.entityId),
    ]);
    await contentAction(account, content.id, "submit");
    await audit(account, "business.registration_submitted", "business", content.entityId, { contentId: content.id });
    await notify(account.id, "business_claim_submitted", "Afacere trimisă spre verificare", "Cererea de înregistrare a fost primită.", "business", content.entityId, "/cont/cereri");
    return Response.json({ ...content, status: "pending_review" }, { status: 201 });
  } catch (error) { return jsonError(error); }
}
