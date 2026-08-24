import { getDemoDataStatus, deleteDemoData } from "../../../server/demo-data";
import { assertSameOrigin, cleanText, jsonError, requireAuthenticatedUser } from "../../../server/platform";

export async function GET(){try{return Response.json(await getDemoDataStatus(await requireAuthenticatedUser()));}catch(error){return jsonError(error)}}

export async function DELETE(request:Request){try{assertSameOrigin(request);const account=await requireAuthenticatedUser();const body=await request.json() as Record<string,unknown>;return Response.json(await deleteDemoData(account,{confirmation:cleanText(body.confirmation,80),previewToken:cleanText(body.previewToken,80),batchIds:Array.isArray(body.batchIds)?body.batchIds.map(String):undefined}));}catch(error){return jsonError(error)}}
