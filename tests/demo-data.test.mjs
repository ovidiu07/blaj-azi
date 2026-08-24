import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFile } from "node:fs/promises";
import test from "node:test";

class D1 {
  constructor(database){this.sqlite=database}
  prepare(sql){return new Statement(this.sqlite,sql)}
  async batch(statements){this.sqlite.exec("BEGIN");try{const results=statements.map(statement=>statement.execute());this.sqlite.exec("COMMIT");return results}catch(error){this.sqlite.exec("ROLLBACK");throw error}}
}
class Statement {
  constructor(database,sql){this.sqlite=database;this.sql=sql;this.values=[]}
  bind(...values){this.values=values.map(value=>typeof value==="boolean"?Number(value):value===undefined?null:value);return this}
  async first(){return this.sqlite.prepare(this.sql).get(...this.values)||null}
  async all(){return{results:this.sqlite.prepare(this.sql).all(...this.values)}}
  async run(){return this.execute()}
  execute(){const result=this.sqlite.prepare(this.sql).run(...this.values);return{success:true,meta:{changes:Number(result.changes),last_row_id:Number(result.lastInsertRowid)}}}
}
class R2 {
  objects=new Map();
  failDeleteOnce=null;
  async put(key,value,options){this.objects.set(key,{bytes:new Uint8Array(value),options})}
  async get(key){const found=this.objects.get(key);return found?{body:new Blob([found.bytes]).stream()}:null}
  async head(key){return this.objects.has(key)?{key}:null}
  async delete(key){if(this.failDeleteOnce===key){this.failDeleteOnce=null;throw new Error("simulated R2 failure")}this.objects.delete(key)}
  async list({prefix=""}={}){return{objects:[...this.objects.keys()].filter(key=>key.startsWith(prefix)).map(key=>({key})),truncated:false}}
}

const migrations=["0000_bumpy_vanisher","0001_lame_elektra","0002_great_mastermind","0003_steep_tomorrow_man","0004_curved_meggan","0005_robust_namor","0006_lowly_silverclaw","0007_curly_mandrill","0008_theme_site","0009_content_primary_media","0010_demo_data_batches"];
const sqlite=new DatabaseSync(":memory:");
for(const name of migrations){const sql=await readFile(new URL(`../drizzle/${name}.sql`,import.meta.url),"utf8");for(const statement of sql.split("--> statement-breakpoint").map(value=>value.trim()).filter(Boolean))sqlite.exec(statement)}
const db=new D1(sqlite);const r2=new R2();
globalThis.__BLAJ_TEST_ENV__={DB:db,MEDIA:r2,DEMO_DATA_ADMIN_ENABLED:"true",ASSETS:{async fetch(request){const path=new URL(request.url).pathname;try{const bytes=await readFile(new URL(`../public${path}`,import.meta.url));return new Response(bytes,{headers:{"content-type":"image/png"}})}catch{return new Response("missing",{status:404})}}}};

const demo=await import("../app/server/demo-data.ts");
const manifest=await import("../app/demo-data.ts");
const publicData=await import("../app/server/public-data.ts");
const {inspectImage}=await import("../app/server/media.ts");
const admin=account(701,"admin");const user=account(702,"user");const businessOwner=account(703,"business_owner");
for(const item of [admin,user,businessOwner])await db.prepare("INSERT INTO users (id,external_user_id,email,normalized_email,display_name,global_role,account_status) VALUES (?,?,?,?,?,?,'active')").bind(item.id,item.externalUserId,item.email,item.normalizedEmail,item.displayName,item.globalRole).run();
const sentinel=await db.prepare("INSERT INTO places (title,slug,address,description,accessibility,locality,status,source_url) VALUES ('Santinelă reală','santinela-reala','Adresă reală','Conținut real',NULL,'Blaj','published','https://example.com/source')").run();
await db.prepare("INSERT INTO content_records (type,entity_id,title,slug,status,moderation_state,visibility,is_demo) VALUES ('place',?,'Santinelă reală','santinela-reala-content','published','approved','public',0)").bind(Number(sentinel.meta.last_row_id)).run();

test("manifestul canonic acoperă toate tipurile, exact două exemple per categorie și imagini bitmap valide",async()=>{
  const matrix=await demo.resolveDemoMatrix(db);const validated=manifest.validateResolvedDemoManifest(matrix);
  assert.deepEqual(validated.expectedTypes,["business","event","offer","job","restaurant","daily_menu","place","community_post","local_story","business_update","article"]);
  assert.equal(validated.expectedCount,58);assert.equal(validated.seedCount,58);
  for(const entry of manifest.demoManifest){const bytes=new Uint8Array(await readFile(new URL(`../public${entry.imagePath}`,import.meta.url)));const info=inspectImage(entry.imagePath,"image/png",bytes);assert.equal(info.mime,"image/png");assert.ok(info.width>=1200&&info.height>=800);assert.match(entry.imageAlt,/DEMO — IMAGINE DE TEST/)}
});

test("capability gate și rolul admin sunt aplicate server-side",()=>{
  assert.throws(()=>demo.assertDemoDataAdmin(user),error=>error.status===403&&error.code==="demo_data_forbidden");
  assert.throws(()=>demo.assertDemoDataAdmin(businessOwner),error=>error.status===403&&error.code==="demo_data_forbidden");
  assert.throws(()=>demo.assertDemoDataAdmin(admin,false),error=>error.status===404&&error.code==="demo_data_disabled");
  assert.doesNotThrow(()=>demo.assertDemoDataAdmin(admin,true));
});

test("generarea este completă, idempotentă și vizibilitatea publică este explicită",async()=>{
  const options={visibility:"hidden",refreshExisting:true,generatorVersion:manifest.DEMO_GENERATOR_VERSION,now:new Date("2026-08-24T09:00:00Z")};
  const first=await demo.generateDemoData(admin,options);assert.equal(first.created,58);assert.equal(first.updated,0);assert.equal(first.unchanged,0);assert.equal(first.mediaCreated,58);assert.equal(first.total,58);
  assert.equal((await db.prepare("SELECT COUNT(*) count FROM demo_data_items WHERE cleanup_status='active'").first()).count,58);
  assert.equal((await db.prepare("SELECT COUNT(*) count FROM content_records c JOIN demo_data_items di ON di.content_id=c.id WHERE c.is_demo=1 AND c.status='published' AND c.published_media_state='selected'").first()).count,58);
  assert.equal((await db.prepare("SELECT COUNT(*) count FROM media_assets m JOIN demo_data_items di ON di.media_asset_id=m.id WHERE m.approval_status='approved' AND m.media_status='active' AND length(m.alt_text)>20").first()).count,58);
  assert.equal((await db.prepare("SELECT COUNT(*) count FROM media_assets m JOIN demo_data_items di ON di.media_asset_id=m.id WHERE length(m.source_url)>20 AND length(m.photographer)>5 AND length(m.license)>10").first()).count,58);
  assert.equal((await db.prepare("SELECT COUNT(*) count FROM business_hours bh JOIN demo_data_items di ON di.entity_id=bh.business_id AND di.content_type='business'").first()).count,56);
  assert.equal(r2.objects.size,58);
  const hidden=await publicData.loadPublicCatalog(new Date("2026-08-24T09:00:00Z"));assert.equal([...hidden.events,...hidden.businesses,...hidden.offers,...hidden.restaurants,...hidden.jobs,...hidden.places,...hidden.posts].some(item=>item.isDemo),false);
  const second=await demo.generateDemoData(admin,options);assert.equal(second.created,0);assert.equal(second.updated,0);assert.equal(second.unchanged,58);assert.equal((await db.prepare("SELECT COUNT(*) count FROM demo_data_items").first()).count,58);assert.equal(r2.objects.size,58);
  const concurrent=await Promise.allSettled([demo.generateDemoData(admin,options),demo.generateDemoData(admin,options)]);assert.equal(concurrent.filter(result=>result.status==="fulfilled").length,1);assert.equal(concurrent.filter(result=>result.status==="rejected"&&result.reason?.status===409&&result.reason?.code==="demo_operation_conflict").length,1);assert.equal((await db.prepare("SELECT COUNT(*) count FROM demo_data_items").first()).count,58);
  const publicRun=await demo.generateDemoData(admin,{...options,visibility:"public"});assert.equal(publicRun.unchanged,58);
  const visible=await publicData.loadPublicCatalog(new Date("2026-08-24T09:00:00Z"));const demoItems=[...visible.events,...visible.businesses,...visible.offers,...visible.restaurants,...visible.jobs,...visible.places,...visible.posts].filter(item=>item.isDemo);assert.ok(demoItems.length>=56,"daily menus enrich restaurant cards instead of having their own public directory");assert.ok(demoItems.every(item=>item.image?.startsWith("/api/media/")));
  assert.deepEqual([...new Set(visible.offers.filter(item=>item.isDemo).map(item=>item.category))].sort(),["Gastronomie","Retail local","Servicii"]);assert.ok(visible.posts.filter(item=>item.isDemo).every(item=>item.author==="Autor demonstrativ Blaj Azi"));
});

test("curățarea cere previzualizare și fraza exactă, apoi păstrează santinelele și demo-ul vechi fără lot",async()=>{
  await assert.rejects(()=>demo.deleteDemoData(admin,{confirmation:"șterge",previewToken:crypto.randomUUID()}),error=>error.status===400&&error.code==="demo_confirmation_invalid");
  await assert.rejects(()=>demo.deleteDemoData(admin,{confirmation:manifest.DEMO_DELETE_CONFIRMATION,previewToken:crypto.randomUUID()}),error=>error.status===409&&error.code==="demo_preview_expired");
  const owned=await db.prepare("SELECT content_id FROM demo_data_items WHERE cleanup_status='active' ORDER BY id LIMIT 1").first();await db.prepare("UPDATE content_records SET is_demo=0 WHERE id=?").bind(owned.content_id).run();await assert.rejects(()=>demo.previewDemoDeletion(admin),error=>error.status===409&&error.code==="demo_cleanup_proof_failed");await db.prepare("UPDATE content_records SET is_demo=1 WHERE id=?").bind(owned.content_id).run();
  await r2.put("users/real/unrelated.png",new Uint8Array([1,2,3]));const unrelatedMedia=await db.prepare("INSERT INTO media_assets (r2_key,alt_text,owner_user_id,original_filename,mime_type,size_bytes,width,height,approval_status,media_status) VALUES ('users/real/unrelated.png','Imagine reală neasociată',?,'unrelated.png','image/png',3,1,1,'approved','active')").bind(user.id).run();
  const protectedUsers=(await db.prepare("SELECT COUNT(*) count FROM users").first()).count;const protectedSettings=(await db.prepare("SELECT COUNT(*) count FROM platform_settings WHERE key!='demo_visibility'").first()).count;const protectedCms=(await db.prepare("SELECT COUNT(*) count FROM site_content_entries").first()).count;
  const legacyBefore=(await db.prepare("SELECT COUNT(*) count FROM content_records c WHERE c.is_demo=1 AND NOT EXISTS (SELECT 1 FROM demo_data_items di WHERE di.content_id=c.id)").first()).count;
  const preview=await demo.previewDemoDeletion(admin);assert.equal(preview.allTargetsProven,true);assert.equal(preview.contentRows,58);assert.equal(preview.mediaRows,58);assert.equal(preview.r2Keys,58);assert.ok(preview.protectedReal>=5);assert.equal(preview.protectedUnownedDemo,legacyBefore);
  r2.failDeleteOnce=[...r2.objects.keys()][0];
  await assert.rejects(()=>demo.deleteDemoData(admin,{confirmation:manifest.DEMO_DELETE_CONFIRMATION,previewToken:preview.previewToken,batchIds:preview.batchIds}),error=>error.status===503&&error.code==="demo_r2_cleanup_failed");
  assert.equal((await db.prepare("SELECT COUNT(*) count FROM content_records c JOIN demo_data_items di ON di.content_id=c.id WHERE di.cleanup_status='active'").first()).count,58,"un eșec R2 nu șterge rândurile D1");
  const retryPreview=await demo.previewDemoDeletion(admin);const removed=await demo.deleteDemoData(admin,{confirmation:manifest.DEMO_DELETE_CONFIRMATION,previewToken:retryPreview.previewToken,batchIds:retryPreview.batchIds});assert.equal(removed.ok,true);assert.equal(removed.deletedContent,58);assert.equal(removed.deletedMedia,58);assert.equal(removed.deletedR2,1);assert.equal(r2.objects.size,1);assert.ok(r2.objects.has("users/real/unrelated.png"));
  assert.equal((await db.prepare("SELECT COUNT(*) count FROM content_records c JOIN demo_data_items di ON di.content_id=c.id").first()).count,0);
  assert.equal((await db.prepare("SELECT COUNT(*) count FROM content_records c WHERE c.is_demo=1 AND NOT EXISTS (SELECT 1 FROM demo_data_items di WHERE di.content_id=c.id)").first()).count,legacyBefore);
  assert.equal((await db.prepare("SELECT COUNT(*) count FROM content_records WHERE slug='santinela-reala-content' AND is_demo=0").first()).count,1);
  assert.equal((await db.prepare("SELECT COUNT(*) count FROM users").first()).count,protectedUsers);assert.equal((await db.prepare("SELECT COUNT(*) count FROM platform_settings WHERE key!='demo_visibility'").first()).count,protectedSettings);assert.equal((await db.prepare("SELECT COUNT(*) count FROM site_content_entries").first()).count,protectedCms);assert.ok(await db.prepare("SELECT id FROM media_assets WHERE id=? AND r2_key='users/real/unrelated.png'").bind(Number(unrelatedMedia.meta.last_row_id)).first());
  assert.equal((await db.prepare("SELECT value FROM platform_settings WHERE key='demo_visibility'").first()).value,"hidden");
  const regenerated=await demo.generateDemoData(admin,{visibility:"hidden",refreshExisting:true,generatorVersion:manifest.DEMO_GENERATOR_VERSION,now:new Date("2026-08-24T09:00:00Z")});assert.equal(regenerated.created,58);assert.equal((await db.prepare("SELECT COUNT(*) count FROM demo_data_items WHERE cleanup_status='active'").first()).count,58);const finalPreview=await demo.previewDemoDeletion(admin);const finalCleanup=await demo.deleteDemoData(admin,{confirmation:manifest.DEMO_DELETE_CONFIRMATION,previewToken:finalPreview.previewToken,batchIds:finalPreview.batchIds});assert.equal(finalCleanup.deletedContent,58);assert.equal(r2.objects.size,1);await assert.rejects(()=>demo.previewDemoDeletion(admin),error=>error.status===409&&error.code==="demo_nothing_to_delete");
  assert.ok((await db.prepare("SELECT COUNT(*) count FROM audit_logs WHERE action='demo_data.generated'").first()).count>=2);assert.ok((await db.prepare("SELECT COUNT(*) count FROM audit_logs WHERE action='demo_data.deleted'").first()).count>=2);
  assert.equal((await db.prepare("PRAGMA integrity_check").first()).integrity_check,"ok");
});

test("API-urile mutative cer autentificare și same-origin, iar interfața nu expune capabilitatea implicit",async()=>{
  for(const path of ["../app/api/admin/demo-data/route.ts","../app/api/admin/demo-data/generate/route.ts","../app/api/admin/demo-data/delete-preview/route.ts"]){const source=await readFile(new URL(path,import.meta.url),"utf8");assert.match(source,/requireAuthenticatedUser/);if(!path.endsWith("demo-data/route.ts")||source.includes("DELETE"))assert.match(source,/assertSameOrigin/)}
  const adminSource=await readFile(new URL("../app/admin/AdminExperience.tsx",import.meta.url),"utf8");assert.match(adminSource,/demoDataCapabilityEnabled/);assert.match(adminSource,/date-demonstrative.*demoEnabled/s);
  const publicPages=await readFile(new URL("../app/ui/PublicPages.tsx",import.meta.url),"utf8");assert.match(publicPages,/if\(item\.isDemo\)return null/);assert.match(publicPages,/Verificare demonstrativă/);
  const statusApi=await import("../app/api/admin/demo-data/route.ts");assert.equal((await statusApi.GET()).status,401);
  const generateApi=await import("../app/api/admin/demo-data/generate/route.ts");const crossOrigin=await generateApi.POST(new Request("https://blaj-azi.local/api/admin/demo-data/generate",{method:"POST",headers:{origin:"https://atacator.invalid","content-type":"application/json"},body:JSON.stringify({visibility:"public",refreshExisting:true})}));assert.equal(crossOrigin.status,403);
});

function account(id,globalRole){return{id,externalUserId:`demo-${id}`,email:`demo-${id}@example.test`,normalizedEmail:`demo-${id}@example.test`,displayName:`Demo ${id}`,avatarUrl:null,globalRole,accountStatus:"active",createdAt:"2026-08-24",lastLoginAt:"2026-08-24"}}
