import { env } from "cloudflare:workers";
import { getRuntimeDb } from "../../../../db/runtime";
import { assertSameOrigin, audit, cleanText, isAdmin, jsonError, PlatformError, requireAuthenticatedUser } from "../../../server/platform";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = Number((await params).id);
    const media = await getRuntimeDb().prepare("SELECT m.*,c.status content_status,c.visibility content_visibility,c.scheduled_at,c.deleted_at content_deleted_at FROM media_assets m LEFT JOIN content_records c ON c.id=m.content_id WHERE m.id=? AND m.media_status='active'").bind(id).first<{ r2_key: string; mime_type: string; owner_user_id: number; approval_status: string;content_id:number|null;content_status:string|null;content_visibility:string|null;scheduled_at:string|null;content_deleted_at:string|null }>();
    if (!media) throw new PlatformError(404, "Imaginea nu există.");
    const scheduledPublic=media.content_status==="scheduled"&&media.scheduled_at&&new Date(media.scheduled_at).getTime()<=Date.now();const publiclyAvailable=media.approval_status==="approved"&&media.content_id&&media.content_visibility==="public"&&!media.content_deleted_at&&(media.content_status==="published"||scheduledPublic);
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
    const media = await getRuntimeDb().prepare("SELECT owner_user_id FROM media_assets WHERE id=? AND media_status='active'").bind(id).first<{ owner_user_id: number }>();
    if (!media) throw new PlatformError(404, "Imaginea nu există.");
    if (!isAdmin(account) && media.owner_user_id !== account.id) throw new PlatformError(403, "Nu poți arhiva această imagine.");
    await getRuntimeDb().prepare("UPDATE media_assets SET media_status='archived',archived_at=CURRENT_TIMESTAMP WHERE id=?").bind(id).run();
    await getRuntimeDb().prepare("INSERT INTO audit_logs (actor_user_id,action,entity_type,entity_id) VALUES (?,'media.archived','media',?)").bind(account.id, String(id)).run();
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
      await getRuntimeDb().prepare("UPDATE media_assets SET approval_status=?,title=COALESCE(?,title),photographer=COALESCE(?,photographer),source_url=COALESCE(?,source_url),license=COALESCE(?,license),alt_text=COALESCE(?,alt_text),orphaned_at=NULL WHERE id=?")
        .bind(status, cleanText(body.title,240)||null, cleanText(body.photographer,240)||null, cleanText(body.sourceUrl,800)||null, cleanText(body.license,120)||null, cleanText(body.altText,500)||null, id).run();
      await audit(account, `media.${action}`, "media", id, { previousStatus: media.approval_status });
      return Response.json({ id, approvalStatus: status });
    }
    if (action === "restore") {
      await getRuntimeDb().prepare("UPDATE media_assets SET media_status='active',archived_at=NULL WHERE id=?").bind(id).run();
      await audit(account, "media.restored", "media", id, { previousStatus: media.media_status });
      return Response.json({ id, mediaStatus: "active" });
    }
    throw new PlatformError(400, "Acțiune media invalidă.");
  } catch (error) { return jsonError(error); }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);const account=await requireAuthenticatedUser();const id=Number((await params).id);const db=getRuntimeDb();
    const media=await db.prepare("SELECT r2_key,owner_user_id FROM media_assets WHERE id=? AND media_status='active'").bind(id).first<{r2_key:string;owner_user_id:number}>();
    if(!media)throw new PlatformError(404,"Imaginea nu există.");if(!isAdmin(account)&&media.owner_user_id!==account.id)throw new PlatformError(403,"Nu poți înlocui această imagine.");
    const form=await request.formData();const file=form.get("file");if(!(file instanceof File)||!file.size)throw new PlatformError(400,"Alege o imagine.");if(file.size>8*1024*1024)throw new PlatformError(413,"Imaginea depășește limita de 8 MB.");const bytes=new Uint8Array(await file.arrayBuffer());
    const jpeg=bytes.length>=3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff;const png=bytes.length>=8&&[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a].every((value,index)=>bytes[index]===value);const webp=bytes.length>=12&&new TextDecoder().decode(bytes.slice(0,4))==="RIFF"&&new TextDecoder().decode(bytes.slice(8,12))==="WEBP";const mime=jpeg?"image/jpeg":png?"image/png":webp?"image/webp":"";if(!mime)throw new PlatformError(400,"Sunt acceptate doar imagini JPEG, PNG sau WebP valide.");
    const altText=cleanText(form.get("altText"),500,true);const extension=mime==="image/jpeg"?"jpg":mime==="image/png"?"png":"webp";const nextKey=`users/${media.owner_user_id}/${crypto.randomUUID()}.${extension}`;
    await env.MEDIA.put(nextKey,bytes,{httpMetadata:{contentType:mime},customMetadata:{originalName:file.name.slice(0,180),ownerUserId:String(media.owner_user_id)}});
    await db.prepare("UPDATE media_assets SET r2_key=?,original_filename=?,mime_type=?,size_bytes=?,alt_text=?,approval_status='pending',orphaned_at=datetime('now','+7 days') WHERE id=?").bind(nextKey,file.name.slice(0,180),mime,file.size,altText,id).run();
    await env.MEDIA.delete(media.r2_key);await audit(account,"media.replaced","media",id,{mimeType:mime,size:file.size});return Response.json({id,status:"pending"});
  }catch(error){return jsonError(error)}
}
