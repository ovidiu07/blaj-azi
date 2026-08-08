import { getRuntimeDb } from "../../../../../db/runtime";
import { assertSameOrigin, audit, jsonError, PlatformError, requireAuthenticatedUser, requireBusinessMembership } from "../../../../server/platform";

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}) {
  try { const account=await requireAuthenticatedUser();const id=Number((await params).id);await requireBusinessMembership(account,id);const rows=await getRuntimeDb().prepare("SELECT weekday,opens_at,closes_at,closed FROM business_hours WHERE business_id=? ORDER BY weekday").bind(id).all();return Response.json({items:rows.results}); }
  catch(error){return jsonError(error)}
}

export async function PUT(request:Request,{params}:{params:Promise<{id:string}>}) {
  try {
    assertSameOrigin(request);const account=await requireAuthenticatedUser();const id=Number((await params).id);await requireBusinessMembership(account,id);
    const body=await request.json() as {hours?:Array<{weekday?:number;opensAt?:string;closesAt?:string;closed?:boolean}>};
    if(!Array.isArray(body.hours)||body.hours.length!==7)throw new PlatformError(400,"Completează programul pentru toate cele șapte zile.");
    const statements=body.hours.map(row=>{const weekday=Number(row.weekday);if(!Number.isInteger(weekday)||weekday<0||weekday>6)throw new PlatformError(400,"Zi invalidă.");const opens=String(row.opensAt||"");const closes=String(row.closesAt||"");if(!row.closed&&(!/^\d{2}:\d{2}$/.test(opens)||!/^\d{2}:\d{2}$/.test(closes)))throw new PlatformError(400,"Orele trebuie completate în format valid.");return getRuntimeDb().prepare("INSERT INTO business_hours (business_id,weekday,opens_at,closes_at,closed) VALUES (?,?,?,?,?) ON CONFLICT(business_id,weekday) DO UPDATE SET opens_at=excluded.opens_at,closes_at=excluded.closes_at,closed=excluded.closed").bind(id,weekday,row.closed?null:opens,row.closed?null:closes,row.closed?1:0)});
    await getRuntimeDb().batch(statements);await audit(account,"business.hours_updated","business",id);return Response.json({ok:true});
  } catch(error){return jsonError(error)}
}
