import { createContent, listMyContent } from "../../../server/content";
import { assertSameOrigin, jsonError, requireAuthenticatedUser } from "../../../server/platform";

export async function GET(request: Request) {
  try {
    const account = await requireAuthenticatedUser();
    const url = new URL(request.url);
    const result = await listMyContent(account, url.searchParams.get("q") || "", url.searchParams.get("status") || "", url.searchParams.get("type") || "");
    return Response.json({ items: result.results });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const account = await requireAuthenticatedUser();
    const result = await createContent(account, await request.json());
    return Response.json(result, { status: 201 });
  } catch (error) { return jsonError(error); }
}
