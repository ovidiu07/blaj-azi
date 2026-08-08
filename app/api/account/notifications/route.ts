import { getRuntimeDb } from "../../../../db/runtime";
import { assertSameOrigin, cleanText, jsonError, requireAuthenticatedUser } from "../../../server/platform";

export async function GET() {
  try {
    const account = await requireAuthenticatedUser();
    const result = await getRuntimeDb().prepare("SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 200").bind(account.id).all();
    return Response.json({ items: result.results });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const account = await requireAuthenticatedUser();
    const body = await request.json() as { action?: string; id?: number };
    const action = cleanText(body.action, 30, true);
    if (action === "read_all") await getRuntimeDb().prepare("UPDATE notifications SET read_at=COALESCE(read_at,CURRENT_TIMESTAMP) WHERE user_id=?").bind(account.id).run();
    else if (action === "read") await getRuntimeDb().prepare("UPDATE notifications SET read_at=COALESCE(read_at,CURRENT_TIMESTAMP) WHERE id=? AND user_id=?").bind(Number(body.id), account.id).run();
    else return Response.json({ error: "Acțiune invalidă" }, { status: 400 });
    return Response.json({ ok: true });
  } catch (error) { return jsonError(error); }
}
