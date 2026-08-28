import { adminModerate, listModerationQueue } from "../../../server/content";
import { assertSameOrigin, cleanText, isAdmin, jsonError, PlatformError, requireAuthenticatedUser } from "../../../server/platform";

export async function GET(request: Request) {
  try {
    const account = await requireAuthenticatedUser();
    if (!isAdmin(account)) throw new PlatformError(403, "Acces administrativ necesar.");
    const status = new URL(request.url).searchParams.get("status") || "pending_review";
    const rows = await listModerationQueue(status);
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
