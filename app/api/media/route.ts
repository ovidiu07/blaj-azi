import { env } from "cloudflare:workers";
import { getRuntimeDb } from "../../../db/runtime";
import { assertSameOrigin, cleanText, enforceRateLimit, isAdmin, jsonError, PlatformError, requireAuthenticatedUser } from "../../server/platform";

const maxBytes = 8 * 1024 * 1024;
const formats = {
  jpeg: { mime: "image/jpeg", extension: "jpg" },
  png: { mime: "image/png", extension: "png" },
  webp: { mime: "image/webp", extension: "webp" },
} as const;

function detectImage(bytes: Uint8Array): (typeof formats)[keyof typeof formats] | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return formats.jpeg;
  if (bytes.length >= 8 && [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a].every((value, index) => bytes[index] === value)) return formats.png;
  if (bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP") return formats.webp;
  return null;
}

export async function GET(request: Request) {
  try {
    const account = await requireAuthenticatedUser();
    const url = new URL(request.url);
    const adminView = url.searchParams.get("scope") === "all";
    if (adminView && !isAdmin(account)) throw new PlatformError(403, "Acces administrativ necesar.");
    const rows = await getRuntimeDb().prepare(adminView
      ? "SELECT m.*,u.display_name owner_name FROM media_assets m LEFT JOIN users u ON u.id=m.owner_user_id WHERE m.media_status!='soft_deleted' ORDER BY m.created_at DESC LIMIT 200"
      : "SELECT * FROM media_assets WHERE owner_user_id=? AND media_status!='soft_deleted' ORDER BY created_at DESC LIMIT 200")
      .bind(...(adminView ? [] : [account.id])).all();
    return Response.json({ items: rows.results });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const account = await requireAuthenticatedUser();
    await enforceRateLimit(account,"media.uploaded",20,60);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) throw new PlatformError(400, "Alege o imagine.");
    if (file.size > maxBytes) throw new PlatformError(413, "Imaginea depășește limita de 8 MB.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const format = detectImage(bytes);
    if (!format) throw new PlatformError(400, "Sunt acceptate doar imagini JPEG, PNG sau WebP valide.");
    const altText = cleanText(form.get("altText"), 500);
    const objectKey = `users/${account.id}/${crypto.randomUUID()}.${format.extension}`;
    await env.MEDIA.put(objectKey, bytes, { httpMetadata: { contentType: format.mime }, customMetadata: { originalName: file.name.slice(0, 180), ownerUserId: String(account.id) } });
    const result = await getRuntimeDb().prepare("INSERT INTO media_assets (r2_key,title,photographer,source_url,license,alt_text,owner_user_id,original_filename,mime_type,size_bytes,approval_status,media_status,orphaned_at) VALUES (?,?,?,?,?,?,?,?,?,?,'pending','active',datetime('now','+7 days'))")
      .bind(objectKey, cleanText(form.get("title"), 240) || null, cleanText(form.get("photographer"), 240) || null, cleanText(form.get("sourceUrl"), 800) || null, cleanText(form.get("license"), 120) || null, altText || null, account.id, file.name.slice(0, 180), format.mime, file.size).run();
    await getRuntimeDb().prepare("INSERT INTO audit_logs (actor_user_id,action,entity_type,entity_id,metadata) VALUES (?,'media.uploaded','media',?,?)")
      .bind(account.id, String(result.meta.last_row_id), JSON.stringify({ mimeType: format.mime, size: file.size })).run();
    return Response.json({ id: result.meta.last_row_id, key: objectKey, status: "pending" }, { status: 201 });
  } catch (error) { return jsonError(error); }
}
