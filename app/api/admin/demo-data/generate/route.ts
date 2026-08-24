import { DEMO_GENERATOR_VERSION } from "../../../../demo-data";
import { generateDemoData } from "../../../../server/demo-data";
import { assertSameOrigin, jsonError, PlatformError, requireAuthenticatedUser } from "../../../../server/platform";

export async function POST(request:Request){try{assertSameOrigin(request);const account=await requireAuthenticatedUser();const body=await request.json() as Record<string,unknown>;if(body.visibility!=="hidden"&&body.visibility!=="public")throw new PlatformError(400,"Alege explicit dacă datele demonstrative rămân ascunse sau devin publice.","demo_visibility_invalid");if(typeof body.refreshExisting!=="boolean")throw new PlatformError(400,"Opțiunea de reîmprospătare trebuie să fie booleană.","demo_refresh_invalid");return Response.json(await generateDemoData(account,{visibility:body.visibility,refreshExisting:body.refreshExisting,generatorVersion:String(body.generatorVersion||DEMO_GENERATOR_VERSION)}));}catch(error){return jsonError(error)}}
