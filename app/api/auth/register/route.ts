import { assertSameOrigin, jsonError } from "../../../server/platform";
import { registerCredentialUser, safeReturnPath, sessionCookieHeader } from "../../../server/auth";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = await request.json() as Record<string, unknown>;
    const result = await registerCredentialUser(body, request);
    return Response.json(
      { ok: true, returnTo: safeReturnPath(body.returnTo, "/cont") },
      { status: 201, headers: { "set-cookie": sessionCookieHeader(request, result.session) } },
    );
  } catch (error) {
    return jsonError(error);
  }
}
