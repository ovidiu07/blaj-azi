import { env } from "cloudflare:workers";
import { getRuntimeDb } from "../../../../db/runtime";
import { assertSameOrigin, isAdmin, jsonError, PlatformError, requireAuthenticatedUser } from "../../../server/platform";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const account = await requireAuthenticatedUser();
    const id = Number((await params).id);
    const media = await getRuntimeDb().prepare("SELECT * FROM media_assets WHERE id=? AND media_status='active'").bind(id).first<{ r2_key: string; mime_type: string; owner_user_id: number; approval_status: string }>();
    if (!media) throw new PlatformError(404, "Imaginea nu există.");
    if (!isAdmin(account) && media.owner_user_id !== account.id) throw new PlatformError(403, "Nu poți accesa această imagine.");
    const object = await env.MEDIA.get(media.r2_key);
    if (!object) throw new PlatformError(404, "Fișierul nu mai există.");
    return new Response(object.body, { headers: { "content-type": media.mime_type, "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
  } catch (error) { return jsonError(error); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const account = await requireAuthenticatedUser();
    const id = Number((await params).id);
    const media = await getRuntimeDb().prepare("SELECT owner_user_id FROM media_assets WHERE id=? AND media_status='active'").bind(id).first<{ owner_user_id: number }>();
    if (!media) throw new PlatformError(404, "Imaginea nu există.");
    if (!isAdmin(account) && media.owner_user_id !== account.id) throw new PlatformError(403, "Nu poți arhiva această imagine.");
    await getRuntimeDb().prepare("UPDATE media_assets SET media_status='archived',archived_at=CURRENT_TIMESTAMP WHERE id=?").bind(id).run();
    await getRuntimeDb().prepare("INSERT INTO audit_logs (actor_user_id,action,entity_type,entity_id) VALUES (?,'media.archived','media',?)").bind(account.id, String(id)).run();
    return Response.json({ ok: true });
  } catch (error) { return jsonError(error); }
}
