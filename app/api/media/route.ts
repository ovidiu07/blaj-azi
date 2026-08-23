import { env } from "cloudflare:workers";
import { getRuntimeDb } from "../../../db/runtime";
import { assertSameOrigin, canManageEntity, cleanText, enforceRateLimit, isAdmin, jsonError, PlatformError, requireAuthenticatedUser, requireBusinessMembership } from "../../server/platform";
import { safeExternalHref } from "../../site-content";
import { ImageValidationError, inspectImage, MAX_IMAGE_BYTES } from "../../server/media";

type MediaResponseRow = { id:number; alt_text:string|null; approval_status:string; media_status:string; width:number|null; height:number|null; mime_type:string|null };

function validationError(error: ImageValidationError): PlatformError {
  if (error.reason === "too_large") return new PlatformError(413, "Imaginea depășește dimensiunea maximă permisă.", "media_too_large");
  if (error.reason === "unsupported") return new PlatformError(415, "Formatul imaginii nu este acceptat.", "media_unsupported");
  if (error.reason === "dimensions") return new PlatformError(413, "Imaginea are dimensiuni prea mari.", "media_dimensions_too_large");
  return new PlatformError(400, "Fișierul selectat nu este o imagine validă.", "media_invalid");
}

function mediaResponse(row: MediaResponseRow) {
  return { id: row.id, url: `/api/media/${row.id}`, altText: row.alt_text ?? "", approvalStatus: row.approval_status, mediaStatus: row.media_status, width: row.width, height: row.height };
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
    if (!(file instanceof File) || !file.size) throw new PlatformError(400, "Fișierul selectat nu este o imagine validă.", "media_invalid");
    if (file.size > MAX_IMAGE_BYTES) throw new PlatformError(413, "Imaginea depășește dimensiunea maximă permisă.", "media_too_large");
    const uploadIdRaw = cleanText(form.get("uploadId"), 80);
    const uploadId = uploadIdRaw || crypto.randomUUID();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uploadId)) throw new PlatformError(400, "Identificatorul încărcării nu este valid.");
    const db = getRuntimeDb();
    const existing = await db.prepare("SELECT id,alt_text,approval_status,media_status,width,height,mime_type FROM media_assets WHERE upload_id=? AND owner_user_id=? LIMIT 1").bind(uploadId, account.id).first<MediaResponseRow>();
    if (existing) return Response.json({ media: mediaResponse(existing), idempotent: true });
    const bytes = new Uint8Array(await file.arrayBuffer());
    let format;
    try { format = inspectImage(file.name, file.type, bytes); }
    catch (error) { if (error instanceof ImageValidationError) throw validationError(error); throw error; }
    const altText = cleanText(form.get("altText"), 500, true);
    const businessId = Number(form.get("businessId")) || null;
    if (businessId) await requireBusinessMembership(account, businessId);
    const contentId = Number(form.get("contentId")) || null;
    if (contentId && !(await canManageEntity(account, contentId))) throw new PlatformError(403, "Nu poți atașa imaginea acestui material.");
    const objectKey = `users/${account.id}/${crypto.randomUUID()}.${format.extension}`;
    const rawSource = cleanText(form.get("sourceUrl"), 800);
    const sourceUrl = rawSource ? safeExternalHref(rawSource) : null;
    if (rawSource && !sourceUrl) throw new PlatformError(400, "Sursa imaginii trebuie să fie un URL HTTP sau HTTPS valid.");
    await env.MEDIA.put(objectKey, bytes, { httpMetadata: { contentType: format.mime }, customMetadata: { originalName: file.name.slice(0, 180), ownerUserId: String(account.id) } });
    let result;
    try {
      result = await db.prepare("INSERT INTO media_assets (r2_key,title,photographer,source_url,license,alt_text,owner_user_id,business_id,content_id,original_filename,mime_type,size_bytes,width,height,upload_id,approval_status,media_status,orphaned_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'pending','active',datetime('now','+7 days'))")
        .bind(objectKey, cleanText(form.get("title"), 240) || null, cleanText(form.get("photographer"), 240) || null, sourceUrl, cleanText(form.get("license"), 120) || null, altText, account.id, businessId, contentId, file.name.slice(0, 180), format.mime, file.size, format.width, format.height, uploadId).run();
    } catch (error) {
      await env.MEDIA.delete(objectKey);
      const raced = await db.prepare("SELECT id,alt_text,approval_status,media_status,width,height,mime_type FROM media_assets WHERE upload_id=? AND owner_user_id=? LIMIT 1").bind(uploadId, account.id).first<MediaResponseRow>();
      if (raced) return Response.json({ media: mediaResponse(raced), idempotent: true });
      throw error;
    }
    const id = Number(result.meta.last_row_id);
    await db.prepare("INSERT INTO audit_logs (actor_user_id,action,entity_type,entity_id,metadata) VALUES (?,'media.uploaded','media',?,?)")
      .bind(account.id, String(id), JSON.stringify({ mimeType: format.mime, size: file.size, width: format.width, height: format.height })).run();
    return Response.json({ media: mediaResponse({ id, alt_text: altText, approval_status: "pending", media_status: "active", width: format.width, height: format.height, mime_type: format.mime }) }, { status: 201 });
  } catch (error) { return jsonError(error); }
}

export async function DELETE(request:Request){try{assertSameOrigin(request);const account=await requireAuthenticatedUser();if(!isAdmin(account))throw new PlatformError(403,"Acces administrativ necesar.");const db=getRuntimeDb();const rows=await db.prepare(`SELECT m.id,m.r2_key FROM media_assets m WHERE m.media_status='active' AND m.approval_status='pending' AND m.orphaned_at IS NOT NULL AND datetime(m.orphaned_at)<=CURRENT_TIMESTAMP AND m.content_id IS NULL AND NOT EXISTS (SELECT 1 FROM site_content_entries e WHERE e.draft_json LIKE '%"mediaId":'||m.id||'%' OR e.published_json LIKE '%"mediaId":'||m.id||'%') AND NOT EXISTS (SELECT 1 FROM site_content_revisions r WHERE r.snapshot LIKE '%"mediaId":'||m.id||'%') LIMIT 100`).all<{id:number;r2_key:string}>();for(const row of rows.results)await env.MEDIA.delete(row.r2_key);if(rows.results.length)await db.batch(rows.results.map(row=>db.prepare("UPDATE media_assets SET media_status='soft_deleted',archived_at=CURRENT_TIMESTAMP WHERE id=?").bind(row.id)));await db.prepare("INSERT INTO audit_logs (actor_user_id,action,entity_type,metadata) VALUES (?,'media.orphans_cleaned','media',?)").bind(account.id,JSON.stringify({count:rows.results.length})).run();return Response.json({removed:rows.results.length})}catch(error){return jsonError(error)}}
