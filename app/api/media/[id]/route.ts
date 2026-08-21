import { env } from "cloudflare:workers";
import { getRuntimeDb } from "../../../../db/runtime";
import { assertSameOrigin, audit, cleanText, isAdmin, jsonError, PlatformError, requireAuthenticatedUser } from "../../../server/platform";
import { safeExternalHref } from "../../../site-content";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = Number((await params).id);
    const media = await getRuntimeDb().prepare(`SELECT m.*,c.status content_status,c.visibility content_visibility,c.scheduled_at,c.deleted_at content_deleted_at,EXISTS(SELECT 1 FROM site_content_entries e WHERE e.published_json LIKE '%"mediaId":'||m.id||'%') cms_published FROM media_assets m LEFT JOIN content_records c ON c.id=m.content_id WHERE m.id=? AND m.media_status='active'`).bind(id).first<{ r2_key: string; mime_type: string; owner_user_id: number; approval_status: string;content_id:number|null;content_status:string|null;content_visibility:string|null;scheduled_at:string|null;content_deleted_at:string|null;cms_published:number }>();
    if (!media) throw new PlatformError(404, "Imaginea nu există.");
    const scheduledPublic=media.content_status==="scheduled"&&media.scheduled_at&&new Date(media.scheduled_at).getTime()<=Date.now();const publiclyAvailable=media.approval_status==="approved"&&(Boolean(media.cms_published)||(Boolean(media.content_id)&&media.content_visibility==="public"&&!media.content_deleted_at&&(media.content_status==="published"||scheduledPublic)));
    if(!publiclyAvailable){const account=await requireAuthenticatedUser();if(!isAdmin(account)&&media.owner_user_id!==account.id)throw new PlatformError(403,"Nu poți accesa această imagine.")}
    const object = await env.MEDIA.get(media.r2_key);
    if (!object) throw new PlatformError(404, "Fișierul nu mai există.");
    return new Response(object.body, { headers: { "content-type": media.mime_type, "cache-control": publiclyAvailable?"public, max-age=3600":"private, no-store", "x-content-type-options": "nosniff" } });
  } catch (error) { return jsonError(error); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const account = await requireAuthenticatedUser();
    const id = Number((await params).id);
    const db = getRuntimeDb();
    const media = await db.prepare("SELECT owner_user_id,content_id FROM media_assets WHERE id=? AND media_status='active'").bind(id).first<{ owner_user_id: number; content_id: number | null }>();
    if (!media) throw new PlatformError(404, "Imaginea nu există.");
    if (!isAdmin(account) && media.owner_user_id !== account.id) throw new PlatformError(403, "Nu poți arhiva această imagine.");
    const cmsReference = await db.prepare(`SELECT 1 referenced FROM site_content_entries WHERE draft_json LIKE '%"mediaId":'||?||'%' OR published_json LIKE '%"mediaId":'||?||'%' UNION ALL SELECT 1 FROM site_content_revisions WHERE snapshot LIKE '%"mediaId":'||?||'%' LIMIT 1`).bind(id,id,id).first();
    if (media.content_id || cmsReference) throw new PlatformError(409, "Imaginea este folosită de conținut sau de istoricul CMS și nu poate fi arhivată.", "media_in_use");
    await db.prepare("UPDATE media_assets SET media_status='archived',archived_at=CURRENT_TIMESTAMP WHERE id=?").bind(id).run();
    await db.prepare("INSERT INTO audit_logs (actor_user_id,action,entity_type,entity_id) VALUES (?,'media.archived','media',?)").bind(account.id, String(id)).run();
    return Response.json({ ok: true });
  } catch (error) { return jsonError(error); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const account = await requireAuthenticatedUser();
    if (!isAdmin(account)) throw new PlatformError(403, "Acces administrativ necesar.");
    const id = Number((await params).id);
    const body = await request.json() as Record<string, unknown>;
    const action = cleanText(body.action, 30, true);
    const media = await getRuntimeDb().prepare("SELECT id,approval_status,media_status,alt_text FROM media_assets WHERE id=?").bind(id).first<{id:number;approval_status:string;media_status:string;alt_text:string|null}>();
    if (!media) throw new PlatformError(404, "Imaginea nu există.");
    if (action === "approve" || action === "reject") {
      if(action==="approve"&&!cleanText(body.altText,500)&&!media.alt_text)throw new PlatformError(400,"Alt textul este obligatoriu înainte de aprobare.");
      const status = action === "approve" ? "approved" : "rejected";
      const rawSource=cleanText(body.sourceUrl,800);const sourceUrl=rawSource?safeExternalHref(rawSource):null;if(rawSource&&!sourceUrl)throw new PlatformError(400,"Sursa imaginii trebuie să fie un URL HTTP sau HTTPS valid.");
      await getRuntimeDb().prepare("UPDATE media_assets SET approval_status=?,title=COALESCE(?,title),photographer=COALESCE(?,photographer),source_url=COALESCE(?,source_url),license=COALESCE(?,license),alt_text=COALESCE(?,alt_text),orphaned_at=NULL WHERE id=?")
        .bind(status, cleanText(body.title,240)||null, cleanText(body.photographer,240)||null, sourceUrl, cleanText(body.license,120)||null, cleanText(body.altText,500)||null, id).run();
      await audit(account, `media.${action}`, "media", id, { previousStatus: media.approval_status });
      return Response.json({ id, approvalStatus: status });
    }
    if (action === "restore") {
      await getRuntimeDb().prepare("UPDATE media_assets SET media_status='active',archived_at=NULL WHERE id=?").bind(id).run();
      await audit(account, "media.restored", "media", id, { previousStatus: media.media_status });
      return Response.json({ id, mediaStatus: "active" });
    }
    if (action === "attach") {
      const contentId=Number(body.contentId);if(!Number.isInteger(contentId)||contentId<=0)throw new PlatformError(400,"Alege un material valid.");
      const content=await getRuntimeDb().prepare("SELECT id FROM content_records WHERE id=? AND deleted_at IS NULL").bind(contentId).first();if(!content)throw new PlatformError(404,"Materialul nu există.");
      if(media.media_status!=="active")throw new PlatformError(409,"Imaginea nu este activă.");
      await getRuntimeDb().prepare("UPDATE media_assets SET content_id=?,orphaned_at=NULL WHERE id=?").bind(contentId,id).run();
      await audit(account,"media.attached","media",id,{contentId});
      return Response.json({id,contentId});
    }
    throw new PlatformError(400, "Acțiune media invalidă.");
  } catch (error) { return jsonError(error); }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);const account=await requireAuthenticatedUser();const id=Number((await params).id);const db=getRuntimeDb();
    const media=await db.prepare("SELECT * FROM media_assets WHERE id=? AND media_status='active'").bind(id).first<Record<string,unknown>&{r2_key:string;owner_user_id:number}>();
    if(!media)throw new PlatformError(404,"Imaginea nu există.");if(!isAdmin(account)&&media.owner_user_id!==account.id)throw new PlatformError(403,"Nu poți înlocui această imagine.");
    const form=await request.formData();const file=form.get("file");if(!(file instanceof File)||!file.size)throw new PlatformError(400,"Alege o imagine.");if(file.size>8*1024*1024)throw new PlatformError(413,"Imaginea depășește limita de 8 MB.");const bytes=new Uint8Array(await file.arrayBuffer());
    const jpeg=bytes.length>=3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff;const png=bytes.length>=8&&[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a].every((value,index)=>bytes[index]===value);const webp=bytes.length>=12&&new TextDecoder().decode(bytes.slice(0,4))==="RIFF"&&new TextDecoder().decode(bytes.slice(8,12))==="WEBP";const mime=jpeg?"image/jpeg":png?"image/png":webp?"image/webp":"";if(!mime)throw new PlatformError(400,"Sunt acceptate doar imagini JPEG, PNG sau WebP valide.");
    const altText=cleanText(form.get("altText"),500,true);const extension=mime==="image/jpeg"?"jpg":mime==="image/png"?"png":"webp";const nextKey=`users/${media.owner_user_id}/${crypto.randomUUID()}.${extension}`;
    await env.MEDIA.put(nextKey,bytes,{httpMetadata:{contentType:mime},customMetadata:{originalName:file.name.slice(0,180),ownerUserId:String(media.owner_user_id)}});
    const inserted=await db.prepare("INSERT INTO media_assets (r2_key,title,photographer,source_url,license,alt_text,owner_user_id,business_id,content_id,original_filename,mime_type,size_bytes,approval_status,media_status,orphaned_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'pending','active',datetime('now','+7 days'))").bind(nextKey,media.title??null,media.photographer??null,media.source_url??null,media.license??null,altText,media.owner_user_id,media.business_id??null,media.content_id??null,file.name.slice(0,180),mime,file.size).run();
    const replacementId=Number(inserted.meta.last_row_id);await audit(account,"media.replaced","media",replacementId,{replacesId:id,mimeType:mime,size:file.size});return Response.json({id:replacementId,replacesId:id,status:"pending"});
  }catch(error){return jsonError(error)}
}
