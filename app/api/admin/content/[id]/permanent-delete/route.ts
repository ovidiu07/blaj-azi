import { env } from "cloudflare:workers";
import { getRuntimeDb } from "../../../../../../db/runtime";
import { assertSameOrigin, audit, canPermanentlyDelete, cleanText, jsonError, PlatformError, requireAuthenticatedUser } from "../../../../../server/platform";

const entityTables:Record<string,string>={event:"events",offer:"offers",job:"jobs",restaurant:"restaurants",daily_menu:"daily_menus",place:"places"};

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    assertSameOrigin(request);const account=await requireAuthenticatedUser();if(!canPermanentlyDelete(account))throw new PlatformError(403,"Doar proprietarul platformei poate șterge permanent.");
    const id=Number((await params).id);const body=await request.json() as{confirmation?:string};const db=getRuntimeDb();
    const item=await db.prepare("SELECT id,title,type,entity_id,deleted_at FROM content_records WHERE id=? AND status='soft_deleted'").bind(id).first<{id:number;title:string;type:string;entity_id:number|null;deleted_at:string}>();
    if(!item)throw new PlatformError(404,"Materialul nu este eligibil pentru ștergere permanentă.");if(item.type==="business")throw new PlatformError(409,"Profilurile de afacere necesită o verificare separată a membrilor și a conținutului dependent.");if(cleanText(body.confirmation,240)!==item.title)throw new PlatformError(400,"Confirmarea nu corespunde titlului.");
    const retention=await db.prepare("SELECT value FROM platform_settings WHERE key='content_retention_days'").first<{value:string}>();const days=Math.max(1,Number(retention?.value||30));const eligible=await db.prepare("SELECT CASE WHEN datetime(?) <= datetime('now', ?) THEN 1 ELSE 0 END eligible").bind(item.deleted_at,`-${days} days`).first<{eligible:number}>();if(!eligible?.eligible)throw new PlatformError(409,`Perioada de retenție de ${days} zile nu s-a încheiat.`);
    const media=await db.prepare("SELECT id,r2_key FROM media_assets WHERE content_id=?").bind(id).all<{id:number;r2_key:string}>();for(const asset of media.results)await env.MEDIA.delete(asset.r2_key);
    await audit(account,"content.permanent_delete","content",id,{title:item.title,type:item.type,entityId:item.entity_id,mediaCount:media.results.length});
    const statements:D1PreparedStatement[]=[db.prepare("DELETE FROM content_revisions WHERE entity_type='content' AND entity_id=?").bind(id),db.prepare("DELETE FROM posts WHERE content_item_id=?").bind(id),db.prepare("DELETE FROM media_assets WHERE content_id=?").bind(id)];
    const table=entityTables[item.type];if(table&&item.entity_id)statements.push(db.prepare(`DELETE FROM ${table} WHERE id=?`).bind(item.entity_id));statements.push(db.prepare("DELETE FROM content_records WHERE id=?").bind(id));await db.batch(statements);
    return Response.json({ok:true});
  }catch(error){return jsonError(error)}
}
