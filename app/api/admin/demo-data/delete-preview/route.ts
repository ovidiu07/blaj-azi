import { previewDemoDeletion } from "../../../../server/demo-data";
import { assertSameOrigin, jsonError, requireAuthenticatedUser } from "../../../../server/platform";

export async function POST(request:Request){try{assertSameOrigin(request);const account=await requireAuthenticatedUser();const body=await request.json().catch(()=>({})) as Record<string,unknown>;return Response.json(await previewDemoDeletion(account,Array.isArray(body.batchIds)?body.batchIds.map(String):undefined));}catch(error){return jsonError(error)}}
