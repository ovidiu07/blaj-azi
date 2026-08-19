import { assertSameOrigin, jsonError } from "../../../server/platform";
import { authenticateCredentialUser, safeReturnPath, sessionCookieHeader } from "../../../server/auth";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = await request.json() as Record<string, unknown>;
    const result = await authenticateCredentialUser(body, request);
    return Response.json(
      { ok: true, returnTo: safeReturnPath(body.returnTo, body.admin === true ? "/admin" : "/cont") },
      { headers: { "set-cookie": sessionCookieHeader(request, result.session) } },
    );
  } catch (error) {
    return jsonError(error);
  }
}
