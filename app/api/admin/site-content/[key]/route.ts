import { assertSameOrigin, jsonError, requireAuthenticatedUser } from "../../../../server/platform";
import {
  listSiteContentRevisions,
  loadAdminSiteContent,
  saveSiteContentDraft,
  siteContentAction,
} from "../../../../server/site-content";

type RouteContext = { params: Promise<{ key: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const account = await requireAuthenticatedUser();
    const key = decodeURIComponent((await params).key);
    const [entry, revisions] = await Promise.all([
      loadAdminSiteContent(account, key),
      listSiteContentRevisions(account, key),
    ]);
    return Response.json({ entry, revisions: revisions.results });
  } catch (error) { return jsonError(error); }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    assertSameOrigin(request);
    const account = await requireAuthenticatedUser();
    const key = decodeURIComponent((await params).key);
    const body = await request.json() as { content?: unknown; version?: number };
    return Response.json(await saveSiteContentDraft(account, key, body.content, Number(body.version)));
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    assertSameOrigin(request);
    const account = await requireAuthenticatedUser();
    const key = decodeURIComponent((await params).key);
    const body = await request.json() as { action?: string; version?: number; revisionId?: number };
    return Response.json(await siteContentAction(account, key, String(body.action || ""), Number(body.version), Number(body.revisionId) || undefined));
  } catch (error) { return jsonError(error); }
}
