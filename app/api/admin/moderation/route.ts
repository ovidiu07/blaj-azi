import { adminModerate } from "../../../server/content";
import { getRuntimeDb } from "../../../../db/runtime";
import { assertSameOrigin, cleanText, isAdmin, jsonError, PlatformError, requireAuthenticatedUser } from "../../../server/platform";

export async function GET(request: Request) {
  try {
    const account = await requireAuthenticatedUser();
    if (!isAdmin(account)) throw new PlatformError(403, "Acces administrativ necesar.");
    const status = new URL(request.url).searchParams.get("status") || "pending_review";
    const rows = await getRuntimeDb().prepare("SELECT c.*,u.display_name author_name,b.name business_name FROM content_records c LEFT JOIN users u ON u.id=c.owner_user_id LEFT JOIN businesses b ON b.id=c.business_id WHERE c.moderation_state=? AND c.deleted_at IS NULL ORDER BY c.submitted_at ASC LIMIT 200")
      .bind(status).all();
    return Response.json({ items: rows.results });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const account = await requireAuthenticatedUser();
    if (!isAdmin(account)) throw new PlatformError(403, "Acces administrativ necesar.");
    const body = await request.json() as { id?: number; action?: string; note?: string; scheduledAt?: string };
    const id = Number(body.id);
    if (!Number.isInteger(id) || id <= 0) throw new PlatformError(400, "Identificator invalid.");
    return Response.json(await adminModerate(account, id, cleanText(body.action, 40, true), cleanText(body.note, 2000), cleanText(body.scheduledAt, 40)));
  } catch (error) { return jsonError(error); }
}
