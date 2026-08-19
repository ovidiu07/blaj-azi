import { assertSameOrigin, jsonError } from "../../../server/platform";
import { clearedSessionCookieHeaders, revokeSessionToken, safeReturnPath, sessionTokenFromRequest } from "../../../server/auth";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    await revokeSessionToken(sessionTokenFromRequest(request));
    const headers = new Headers({ "content-type": "application/json; charset=utf-8" });
    for (const cookie of clearedSessionCookieHeaders()) headers.append("set-cookie", cookie);
    return new Response(JSON.stringify({ ok: true, returnTo: safeReturnPath(body.returnTo, "/") }), { headers });
  } catch (error) {
    return jsonError(error);
  }
}
