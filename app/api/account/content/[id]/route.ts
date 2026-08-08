import { getContentForEditor, updateContent } from "../../../../server/content";
import { assertSameOrigin, jsonError, PlatformError, requireAuthenticatedUser } from "../../../../server/platform";

function contentId(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new PlatformError(400, "Identificator invalid.");
  return id;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const account = await requireAuthenticatedUser();
    const item = await getContentForEditor(account, contentId((await params).id));
    if (!item) throw new PlatformError(404, "Conținutul nu există.");
    return Response.json(item);
  } catch (error) { return jsonError(error); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const account = await requireAuthenticatedUser();
    return Response.json(await updateContent(account, contentId((await params).id), await request.json()));
  } catch (error) { return jsonError(error); }
}
