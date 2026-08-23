import { contentAction } from "../../../../../server/content";
import { assertSameOrigin, cleanText, jsonError, PlatformError, requireAuthenticatedUser } from "../../../../../server/platform";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const account = await requireAuthenticatedUser();
    const id = Number((await params).id);
    if (!Number.isInteger(id) || id <= 0) throw new PlatformError(400, "Identificator invalid.");
    const body = await request.json() as { action?: string; expectedVersion?:number };
    return Response.json(await contentAction(account, id, cleanText(body.action, 40, true), Number.isInteger(body.expectedVersion)?body.expectedVersion:undefined));
  } catch (error) { return jsonError(error); }
}
