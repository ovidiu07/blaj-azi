import { env } from "cloudflare:workers";
import {
  DEMO_DELETE_CONFIRMATION,
  DEMO_GENERATOR_VERSION,
  DEMO_VISIBILITY_SETTING,
  buildDemoFixture,
  demoBatchId,
  demoManifest,
  expectedDemoCount,
  validateResolvedDemoManifest,
  type DemoFixture,
  type DemoVisibility,
  type ResolvedDemoCategory,
  type ResolvedDemoMatrixRow,
} from "../demo-data";
import { getRuntimeDb } from "../../db/runtime";
import { inspectImage } from "./media";
import { cleanText, isAdmin, PlatformError, safeSlug, type LocalAccount } from "./platform";
import { createPublishedDemoContent, refreshPublishedDemoContent, type ContentType } from "./content";

type DemoBatchRow = {
  id: string;
  status: "creating" | "active" | "deleting" | "deleted" | "failed";
  generator_version: string;
  created_by: number;
  created_at: string;
  updated_at: string;
  generated_at: string | null;
  deleted_at: string | null;
  error_summary: string | null;
  content_count: number;
  media_count: number;
  operation_token: string | null;
  operation_started_at: string | null;
  cleanup_token: string | null;
  cleanup_previewed_at: string | null;
};

type DemoItemRow = {
  id: number;
  batch_id: string;
  seed_key: string;
  content_id: number | null;
  entity_id: number | null;
  media_asset_id: number | null;
  r2_key: string;
  content_type: string;
  category: string;
  fixture_hash: string;
  cleanup_status: string;
};

type GenerateOptions = {
  visibility: DemoVisibility;
  refreshExisting: boolean;
  generatorVersion: string;
  now?: Date;
};

type GenerationCounters = {
  created: number;
  updated: number;
  unchanged: number;
  mediaCreated: number;
  byType: Record<string, number>;
  byCategory: Record<string, number>;
  warnings: string[];
};

type GeneratedReference = { contentId: number; entityId: number; mediaId: number; category: string };

const DEMO_PREFIX = "demo-data/";

export function demoDataCapabilityEnabled() {
  const value = String(env.DEMO_DATA_ADMIN_ENABLED ?? "").trim().toLowerCase();
  return value === "true" || value === "1" || value === "enabled";
}

export function assertDemoDataAdmin(account: LocalAccount, capabilityEnabled = demoDataCapabilityEnabled()) {
  if (!capabilityEnabled) throw new PlatformError(404, "Funcționalitatea pentru date demonstrative nu este activată.", "demo_data_disabled");
  if (!isAdmin(account)) throw new PlatformError(403, "Doar administratorii pot gestiona datele demonstrative.", "demo_data_forbidden");
}

export async function resolveDemoMatrix(db = getRuntimeDb()): Promise<ResolvedDemoMatrixRow[]> {
  const cache = new Map<string, ResolvedDemoCategory[]>();
  const rows: ResolvedDemoMatrixRow[] = [];
  for (const manifest of demoManifest) {
    let categories: ResolvedDemoCategory[];
    if (manifest.categoryStrategy.source === "demo-only") {
      categories = manifest.categoryStrategy.labels.map(label => ({ id:null, label, source:"demo-only" }));
    } else {
      const key = manifest.categoryStrategy.databaseType;
      const cached = cache.get(key);
      if (cached) categories = cached;
      else {
        const result = await db.prepare("SELECT id,name FROM categories WHERE type=? ORDER BY name COLLATE NOCASE,id").bind(key).all<{id:number;name:string}>();
        categories = result.results.length
          ? result.results.map(row => ({ id:row.id, label:row.name, source:"database" as const }))
          : manifest.categoryStrategy.fallback.map(label => ({ id:null, label, source:"demo-only" as const }));
        cache.set(key,categories);
      }
    }
    rows.push({ type:manifest.type, route:manifest.route, categories, recordsPerCategory:2, expectedCount:categories.length*2, imagePath:manifest.imagePath });
  }
  validateResolvedDemoManifest(rows);
  return rows;
}

export async function getDemoDataStatus(account: LocalAccount) {
  assertDemoDataAdmin(account);
  const db = getRuntimeDb();
  const matrix = await resolveDemoMatrix(db);
  const [visibilityRow,batches,counts,mediaCount,legacyDemo] = await Promise.all([
    db.prepare("SELECT value FROM platform_settings WHERE key=?").bind(DEMO_VISIBILITY_SETTING).first<{value:string}>(),
    db.prepare("SELECT * FROM demo_data_batches ORDER BY created_at DESC").all<DemoBatchRow>(),
    db.prepare("SELECT di.content_type,di.category,COUNT(c.id) count FROM demo_data_items di LEFT JOIN content_records c ON c.id=di.content_id AND c.is_demo=1 AND c.deleted_at IS NULL WHERE di.cleanup_status='active' GROUP BY di.content_type,di.category ORDER BY di.content_type,di.category").all<{content_type:string;category:string;count:number}>(),
    db.prepare("SELECT COUNT(m.id) count FROM demo_data_items di JOIN media_assets m ON m.id=di.media_asset_id AND m.media_status='active' WHERE di.cleanup_status='active'").first<{count:number}>(),
    db.prepare("SELECT COUNT(*) count FROM content_records c WHERE c.is_demo=1 AND NOT EXISTS (SELECT 1 FROM demo_data_items di WHERE di.content_id=c.id AND di.cleanup_status='active')").first<{count:number}>(),
  ]);
  const activeBatches = batches.results.filter(batch => batch.status !== "deleted");
  const orphanWarnings: string[] = [];
  let orphanObjectCount = 0;
  for (const batch of activeBatches) {
    const listed = await listBatchKeys(batch.id);
    if (!listed) continue;
    const manifestKeys = new Set((await db.prepare("SELECT r2_key FROM demo_data_items WHERE batch_id=? AND cleanup_status='active'").bind(batch.id).all<{r2_key:string}>()).results.map(row=>row.r2_key));
    const orphaned = listed.filter(key => !manifestKeys.has(key));
    orphanObjectCount += orphaned.length;
    if (orphaned.length) orphanWarnings.push(`Lotul ${batch.id} are ${orphaned.length} obiecte R2 fără manifest activ.`);
  }
  const byType: Record<string,number> = {};
  const byCategory: Record<string,number> = {};
  for (const row of counts.results) { byType[row.content_type]=(byType[row.content_type]||0)+row.count;byCategory[`${row.content_type}:${row.category}`]=row.count; }
  const warnings = [...orphanWarnings];
  if ((legacyDemo?.count??0)>0) warnings.push(`${legacyDemo?.count} înregistrări demo vechi nu aparțin unui lot și sunt protejate de curățarea automată.`);
  if (Object.values(byCategory).some(count=>count!==2)) warnings.push("Cel puțin o pereche tip/categorie nu conține exact două înregistrări active.");
  const busy = activeBatches.some(batch => batch.status === "creating" || batch.status === "deleting");
  const visibility:DemoVisibility=visibilityRow?.value === "public" ? "public" : "hidden";
  return {
    enabled:true,
    generatorVersion:DEMO_GENERATOR_VERSION,
    visibility,
    expectedTotal:expectedDemoCount(matrix),
    expectedMedia:expectedDemoCount(matrix),
    actualTotal:Object.values(byType).reduce((sum,value)=>sum+value,0),
    mediaCount:mediaCount?.count??0,
    orphanObjectCount,
    protectedUnownedDemoCount:legacyDemo?.count??0,
    matrix,
    byType,
    byCategory,
    batches:batches.results.map(batch=>({ id:batch.id,status:batch.status,generatorVersion:batch.generator_version,generatedAt:batch.generated_at,deletedAt:batch.deleted_at,contentCount:batch.content_count,mediaCount:batch.media_count,errorSummary:batch.error_summary })),
    activeBatch:activeBatches[0]?{ id:activeBatches[0].id,status:activeBatches[0].status,generatorVersion:activeBatches[0].generator_version,generatedAt:activeBatches[0].generated_at,contentCount:activeBatches[0].content_count,mediaCount:activeBatches[0].media_count,errorSummary:activeBatches[0].error_summary }:null,
    warnings,
    canGenerate:!busy,
    canDelete:!busy&&activeBatches.some(batch=>batch.status==="active"||batch.status==="failed"),
  };
}

export async function generateDemoData(account: LocalAccount, options: GenerateOptions) {
  assertDemoDataAdmin(account);
  if (options.generatorVersion !== DEMO_GENERATOR_VERSION) throw new PlatformError(409,"Versiunea generatorului s-a schimbat. Reîncarcă pagina de administrare.","demo_generator_version_changed");
  if (options.visibility !== "hidden" && options.visibility !== "public") throw new PlatformError(400,"Alege vizibilitatea datelor demonstrative.","demo_visibility_invalid");
  const now = options.now ?? new Date();
  if (Number.isNaN(now.getTime())) throw new PlatformError(400,"Data de generare nu este validă.");
  const db = getRuntimeDb();
  const matrix = await resolveDemoMatrix(db);
  try { validateResolvedDemoManifest(matrix); }
  catch (error) { throw new PlatformError(422,error instanceof Error?error.message:"Manifest demonstrativ invalid.","demo_manifest_invalid"); }
  const batchId = demoBatchId();
  const token = crypto.randomUUID();
  const inserted = await db.prepare("INSERT OR IGNORE INTO demo_data_batches (id,status,generator_version,created_by,operation_token,operation_started_at) VALUES (?,'creating',?,?,?,CURRENT_TIMESTAMP)").bind(batchId,DEMO_GENERATOR_VERSION,account.id,token).run();
  let acquired = Number(inserted.meta.changes??0) === 1;
  if (!acquired) {
    const result = await db.prepare("UPDATE demo_data_batches SET status='creating',created_by=?,updated_at=CURRENT_TIMESTAMP,error_summary=NULL,operation_token=?,operation_started_at=CURRENT_TIMESTAMP,cleanup_token=NULL,cleanup_previewed_at=NULL WHERE id=? AND (status IN ('active','deleted','failed') OR (status='creating' AND operation_started_at<datetime('now','-10 minutes'))) ").bind(account.id,token,batchId).run();
    acquired = Number(result.meta.changes??0) === 1;
  }
  if (!acquired) throw new PlatformError(409,"O generare sau o curățare este deja în curs. Așteaptă finalizarea ei.","demo_operation_conflict");

  const counters: GenerationCounters = { created:0,updated:0,unchanged:0,mediaCreated:0,byType:{},byCategory:{},warnings:[] };
  const businesses: GeneratedReference[] = [];
  const restaurants: Array<GeneratedReference & { businessId:number }> = [];
  let relationIndex = 0;
  try {
    for (const row of matrix) {
      const manifest = demoManifest.find(item=>item.type===row.type)!;
      for (const category of row.categories) {
        for (const example of manifest.examples) {
          const business = businesses.length ? businesses[relationIndex % businesses.length] : undefined;
          const restaurant = restaurants.length ? restaurants[relationIndex % restaurants.length] : undefined;
          const fixture = buildDemoFixture(manifest,category,example,now,{
            businessId: row.type === "business" ? undefined : row.type === "daily_menu" ? restaurant?.businessId : business?.entityId,
            restaurantId: row.type === "daily_menu" ? restaurant?.entityId : undefined,
          });
          const generated = await upsertFixture(db,account,batchId,token,fixture,options.refreshExisting,counters);
          if (row.type === "business") businesses.push(generated);
          if (row.type === "restaurant") restaurants.push({ ...generated,businessId:Number(fixture.input.businessId) });
          relationIndex += 1;
          counters.byType[row.type]=(counters.byType[row.type]||0)+1;
          counters.byCategory[`${row.type}:${category.label}`]=(counters.byCategory[`${row.type}:${category.label}`]||0)+1;
        }
      }
    }
    const total = counters.created+counters.updated+counters.unchanged;
    const visibilityResult = await db.batch([
      db.prepare("INSERT INTO platform_settings (key,value,updated_by,updated_at) VALUES (?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP").bind(DEMO_VISIBILITY_SETTING,options.visibility,account.id),
      db.prepare("UPDATE demo_data_batches SET status='active',generated_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP,error_summary=NULL,content_count=?,media_count=(SELECT COUNT(*) FROM demo_data_items WHERE batch_id=? AND cleanup_status='active' AND media_asset_id IS NOT NULL),operation_token=NULL,operation_started_at=NULL WHERE id=? AND operation_token=?").bind(total,batchId,batchId,token),
      db.prepare("INSERT INTO audit_logs (actor_user_id,action,entity_type,entity_id,metadata) VALUES (?,'demo_data.generated','demo_data_batch',?,?)").bind(account.id,batchId,JSON.stringify({generatorVersion:DEMO_GENERATOR_VERSION,created:counters.created,updated:counters.updated,unchanged:counters.unchanged,mediaCreated:counters.mediaCreated,visibility:options.visibility,total})),
    ]);
    if (Number(visibilityResult[1]?.meta?.changes??0)!==1) throw new PlatformError(409,"Lotul demonstrativ a pierdut blocarea operației.","demo_operation_conflict");
    return { ok:true,batchId,generatorVersion:DEMO_GENERATOR_VERSION,...counters,visibility:options.visibility,total };
  } catch (error) {
    await db.prepare("UPDATE demo_data_batches SET status='failed',updated_at=CURRENT_TIMESTAMP,error_summary=?,operation_token=NULL,operation_started_at=NULL WHERE id=? AND operation_token=?").bind(safeError(error),batchId,token).run().catch(()=>undefined);
    throw error;
  }
}

async function upsertFixture(
  db:D1Database,
  account:LocalAccount,
  batchId:string,
  operationToken:string,
  fixture:DemoFixture,
  refreshExisting:boolean,
  counters:GenerationCounters,
):Promise<GeneratedReference>{
  const existing=await db.prepare("SELECT di.*,c.version content_version,c.is_demo,c.deleted_at FROM demo_data_items di LEFT JOIN content_records c ON c.id=di.content_id WHERE di.seed_key=? LIMIT 1").bind(fixture.seedKey).first<DemoItemRow&{content_version:number|null;is_demo:number|null;deleted_at:string|null}>();
  const asset=await loadFixtureAsset(fixture);
  const fixtureHash=await hashFixture(fixture,asset.bytes);
  const r2Key=`${DEMO_PREFIX}${batchId}/${safeSlug(fixture.seedKey)}.${asset.format.extension}`;
  if(existing&&existing.cleanup_status!=="deleted"){
    if(existing.batch_id!==batchId||existing.content_type!==fixture.type||existing.r2_key!==r2Key)throw new PlatformError(409,`Cheia ${fixture.seedKey} este deținută de un alt manifest.`,`demo_ownership_mismatch`);
    if(existing.is_demo!==1||!existing.content_id||!existing.entity_id||!existing.media_asset_id||existing.deleted_at)throw new PlatformError(409,`Înregistrarea ${fixture.seedKey} nu mai poate fi dovedită ca demo activ.`,`demo_ownership_mismatch`);
    await ensureFixtureObject(r2Key,asset,fixture,account.id);
    if(existing.fixture_hash===fixtureHash){
      counters.unchanged+=1;
      return {contentId:existing.content_id,entityId:existing.entity_id,mediaId:existing.media_asset_id,category:fixture.category.label};
    }
    if(!refreshExisting){
      counters.unchanged+=1;
      counters.warnings.push(`${fixture.seedKey} diferă de versiunea curentă; bifează reîmprospătarea pentru actualizare.`);
      return {contentId:existing.content_id,entityId:existing.entity_id,mediaId:existing.media_asset_id,category:fixture.category.label};
    }
    const input={...fixture.input,primaryMediaId:existing.media_asset_id,primaryMediaState:"selected" as const};
    const snapshot=JSON.stringify({...JSON.parse(fixture.publishedSnapshot),primaryMediaId:existing.media_asset_id,primaryMediaState:"selected"});
    await refreshPublishedDemoContent(account,input,{contentId:existing.content_id,entityId:existing.entity_id,mediaId:existing.media_asset_id,version:Number(existing.content_version)},snapshot);
    const itemUpdate=await db.prepare("UPDATE demo_data_items SET fixture_hash=?,cleanup_status='active',updated_at=CURRENT_TIMESTAMP WHERE id=? AND batch_id=? AND fixture_hash=? AND EXISTS (SELECT 1 FROM demo_data_batches WHERE id=? AND operation_token=? AND status='creating')").bind(fixtureHash,existing.id,batchId,existing.fixture_hash,batchId,operationToken).run();
    if(Number(itemUpdate.meta.changes??0)!==1)throw new PlatformError(409,"Manifestul demonstrativ a fost modificat simultan.","demo_operation_conflict");
    counters.updated+=1;
    return {contentId:existing.content_id,entityId:existing.entity_id,mediaId:existing.media_asset_id,category:fixture.category.label};
  }

  const contentId=randomId(),entityId=randomId(),mediaId=randomId();
  const objectAlreadyExisted=Boolean(await env.MEDIA.head?.(r2Key));
  if(!objectAlreadyExisted)await putFixtureObject(r2Key,asset,fixture,account.id);
  try{
    const mediaResult=await db.prepare("INSERT INTO media_assets (id,r2_key,title,photographer,source_url,license,alt_text,category,owner_user_id,business_id,original_filename,mime_type,size_bytes,width,height,upload_id,approval_status,media_status,orphaned_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'approved','active',NULL)")
      .bind(mediaId,r2Key,fixture.input.title,fixture.imageCredit,fixture.imageSource,fixture.imageLicense,fixture.imageAlt,fixture.category.label,account.id,numberOrNull(fixture.input.businessId),fixture.imagePath.split('/').at(-1)||`${fixture.type}.png`,asset.format.mime,asset.bytes.byteLength,asset.format.width,asset.format.height,crypto.randomUUID()).run();
    if(Number(mediaResult.meta.changes??0)!==1)throw new PlatformError(409,"Metadatele imaginii demonstrative nu au fost create.");
    const input={...fixture.input,primaryMediaId:mediaId,primaryMediaState:"selected" as const};
    const snapshot=JSON.stringify({...JSON.parse(fixture.publishedSnapshot),primaryMediaId:mediaId,primaryMediaState:"selected"});
    await createPublishedDemoContent(account,input,{contentId,entityId,mediaId},snapshot);
    const item=existing
      ?await db.prepare("UPDATE demo_data_items SET content_id=?,entity_id=?,media_asset_id=?,r2_key=?,content_type=?,category=?,fixture_hash=?,cleanup_status='active',updated_at=CURRENT_TIMESTAMP WHERE id=? AND batch_id=? AND seed_key=? AND cleanup_status='deleted' AND EXISTS (SELECT 1 FROM demo_data_batches WHERE id=? AND operation_token=? AND status='creating')").bind(contentId,entityId,mediaId,r2Key,fixture.type,fixture.category.label,fixtureHash,existing.id,batchId,fixture.seedKey,batchId,operationToken).run()
      :await db.prepare("INSERT INTO demo_data_items (batch_id,seed_key,content_id,entity_id,media_asset_id,r2_key,content_type,category,fixture_hash,cleanup_status) SELECT ?,?,?,?,?,?,?,?,?,'active' WHERE EXISTS (SELECT 1 FROM demo_data_batches WHERE id=? AND operation_token=? AND status='creating')").bind(batchId,fixture.seedKey,contentId,entityId,mediaId,r2Key,fixture.type,fixture.category.label,fixtureHash,batchId,operationToken).run();
    if(Number(item.meta.changes??0)!==1)throw new PlatformError(409,"Lotul demonstrativ a pierdut blocarea operației.","demo_operation_conflict");
    counters.created+=1;counters.mediaCreated+=1;
    return {contentId,entityId,mediaId,category:fixture.category.label};
  }catch(error){
    await rollbackIncompleteFixture(db,{contentId,entityId,mediaId,type:fixture.type,r2Key});
    if(!objectAlreadyExisted)await env.MEDIA.delete(r2Key).catch(()=>undefined);
    throw error;
  }
}

export async function previewDemoDeletion(account:LocalAccount,batchIds?:string[]){
  assertDemoDataAdmin(account);
  const db=getRuntimeDb();
  const targets=await resolveCleanupBatches(db,batchIds);
  if(!targets.length)throw new PlatformError(409,"Nu există loturi demonstrative active pentru curățare.","demo_nothing_to_delete");
  const items=await loadCleanupItems(db,targets);
  const proof=await proveCleanupOwnership(db,targets,items);
  if(!proof.allTargetsProven)throw new PlatformError(409,"Curățarea a fost oprită: unele ținte nu mai pot fi dovedite ca aparținând lotului demonstrativ.","demo_cleanup_proof_failed");
  const previewToken=crypto.randomUUID();
  await db.batch(targets.map(id=>db.prepare("UPDATE demo_data_batches SET cleanup_token=?,cleanup_previewed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status IN ('active','failed')").bind(previewToken,id)));
  return {...proof,previewToken,batchIds:targets,confirmationPhrase:DEMO_DELETE_CONFIRMATION,expiresInMinutes:10};
}

export async function deleteDemoData(account:LocalAccount,options:{confirmation:string;previewToken:string;batchIds?:string[]}){
  assertDemoDataAdmin(account);
  if(options.confirmation!==DEMO_DELETE_CONFIRMATION)throw new PlatformError(400,`Scrie exact „${DEMO_DELETE_CONFIRMATION}” pentru confirmare.`,`demo_confirmation_invalid`);
  if(!/^[0-9a-f-]{36}$/i.test(options.previewToken||""))throw new PlatformError(400,"Previzualizarea curățării nu este validă.","demo_preview_invalid");
  const db=getRuntimeDb();
  const targets=await resolveCleanupBatches(db,options.batchIds);
  if(!targets.length)throw new PlatformError(409,"Nu există loturi demonstrative active pentru curățare.","demo_nothing_to_delete");
  const operationToken=crypto.randomUUID();
  const acquired=await db.batch(targets.map(id=>db.prepare("UPDATE demo_data_batches SET status='deleting',operation_token=?,operation_started_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status IN ('active','failed') AND cleanup_token=? AND cleanup_previewed_at>=datetime('now','-10 minutes')").bind(operationToken,id,options.previewToken)));
  if(acquired.some(result=>Number(result.meta.changes??0)!==1))throw new PlatformError(409,"Previzualizarea a expirat sau lotul s-a schimbat. Generează o previzualizare nouă.","demo_preview_expired");
  try{
    const items=await loadCleanupItems(db,targets);
    const proof=await proveCleanupOwnership(db,targets,items);
    if(!proof.allTargetsProven)throw new PlatformError(409,"Curățarea a fost oprită înainte de ștergere: dovada de proprietate nu mai este completă.","demo_cleanup_proof_failed");
    await db.prepare("INSERT INTO platform_settings (key,value,updated_by,updated_at) VALUES (?,'hidden',?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value='hidden',updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP").bind(DEMO_VISIBILITY_SETTING,account.id).run();
    const contentIds=items.map(item=>Number(item.content_id));
    const r2Keys=new Set<string>();let listingAvailable=true;
    for(const batchId of targets){const listed=await listBatchKeys(batchId);if(listed===null){listingAvailable=false;break}for(const key of listed)r2Keys.add(key);}
    if(!listingAvailable)for(const item of items)r2Keys.add(item.r2_key);
    const r2Failures:string[]=[];
    for(const key of r2Keys){try{await env.MEDIA.delete(key);}catch{r2Failures.push(key);}}
    if(r2Failures.length)throw new PlatformError(503,`${r2Failures.length} obiecte R2 nu au putut fi șterse. Baza de date a rămas intactă; poți reîncerca în siguranță.`,`demo_r2_cleanup_failed`);
    const byType:Record<string,number>={},byCategory:Record<string,number>={};
    for(const item of items){byType[item.content_type]=(byType[item.content_type]||0)+1;byCategory[`${item.content_type}:${item.category}`]=(byCategory[`${item.content_type}:${item.category}`]||0)+1;await deleteOwnedDatabaseItem(db,item,account.id);}
    for(const batchId of targets){const remaining=(await db.prepare("SELECT COUNT(*) count FROM demo_data_items di JOIN content_records c ON c.id=di.content_id WHERE di.batch_id=? AND di.cleanup_status='active' AND c.is_demo=1").bind(batchId).first<{count:number}>())?.count??0;if(remaining)throw new PlatformError(409,`Lotul ${batchId} mai are ${remaining} înregistrări active; curățarea poate fi reîncercată.`,`demo_cleanup_incomplete`);}
    await db.batch([
      ...targets.map(id=>db.prepare("UPDATE demo_data_batches SET status='deleted',deleted_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP,error_summary=NULL,operation_token=NULL,operation_started_at=NULL,cleanup_token=NULL,cleanup_previewed_at=NULL WHERE id=? AND operation_token=?").bind(id,operationToken)),
      db.prepare("INSERT INTO audit_logs (actor_user_id,action,entity_type,entity_id,metadata) VALUES (?,'demo_data.deleted','demo_data_batch',?,?)").bind(account.id,targets.join(','),JSON.stringify({batchIds:targets,contentCount:contentIds.length,mediaCount:items.length,r2Deleted:r2Keys.size,byType,byCategory})),
    ]);
    return {ok:true,batchIds:targets,deletedContent:contentIds.length,deletedMedia:items.length,deletedR2:r2Keys.size,r2Failures:[],byType,byCategory,protectedReal:proof.protectedReal,protectedUnownedDemo:proof.protectedUnownedDemo,visibility:"hidden" as const,reminder:"Dezactivează DEMO_DATA_ADMIN_ENABLED înainte de lansarea în producție."};
  }catch(error){
    await db.batch(targets.map(id=>db.prepare("UPDATE demo_data_batches SET status='failed',updated_at=CURRENT_TIMESTAMP,error_summary=?,operation_token=NULL,operation_started_at=NULL WHERE id=? AND operation_token=?").bind(safeError(error),id,operationToken))).catch(()=>undefined);
    throw error;
  }
}

async function resolveCleanupBatches(db:D1Database,batchIds?:string[]){
  const requested=[...new Set((batchIds||[]).map(id=>cleanText(id,160)).filter(Boolean))];
  if(requested.length){
    const valid:string[]=[];
    for(const id of requested)if(await db.prepare("SELECT 1 ok FROM demo_data_batches WHERE id=? AND status IN ('active','failed')").bind(id).first())valid.push(id);
    if(valid.length!==requested.length)throw new PlatformError(409,"Un lot solicitat nu este activ sau nu există.","demo_batch_invalid");
    return valid;
  }
  return (await db.prepare("SELECT id FROM demo_data_batches WHERE status IN ('active','failed') ORDER BY created_at").all<{id:string}>()).results.map(row=>row.id);
}

async function loadCleanupItems(db:D1Database,batchIds:string[]){
  const rows:DemoItemRow[]=[];
  for(const id of batchIds)rows.push(...(await db.prepare("SELECT * FROM demo_data_items WHERE batch_id=? AND cleanup_status IN ('active','r2_delete_failed') ORDER BY id").bind(id).all<DemoItemRow>()).results);
  return rows;
}

async function proveCleanupOwnership(db:D1Database,batchIds:string[],items:DemoItemRow[]){
  let contentRows=0,mediaRows=0,revisionRows=0,moderationRows=0,domainRows=0;
  const failures:string[]=[];
  for(const item of items){
    const content=await db.prepare("SELECT id,type,entity_id,is_demo FROM content_records WHERE id=?").bind(item.content_id).first<{id:number;type:string;entity_id:number;is_demo:number}>();
    if(!content||content.is_demo!==1||content.type!==item.content_type||content.entity_id!==item.entity_id)failures.push(`${item.seed_key}: conținutul nu corespunde manifestului`);else contentRows+=1;
    const media=await db.prepare("SELECT id,r2_key FROM media_assets WHERE id=?").bind(item.media_asset_id).first<{id:number;r2_key:string}>();
    if(!media||media.r2_key!==item.r2_key||!item.r2_key.startsWith(`${DEMO_PREFIX}${item.batch_id}/`))failures.push(`${item.seed_key}: imaginea nu corespunde manifestului`);else mediaRows+=1;
    const table=domainTable(item.content_type as ContentType);
    const domain=table?await db.prepare(`SELECT id FROM ${table} WHERE id=?`).bind(item.entity_id).first():null;
    if(!domain)failures.push(`${item.seed_key}: rândul specific tipului lipsește`);else domainRows+=1;
    revisionRows+=(await db.prepare("SELECT COUNT(*) count FROM content_revisions WHERE entity_type='content' AND entity_id=?").bind(item.content_id).first<{count:number}>())?.count??0;
    moderationRows+=(await db.prepare("SELECT COUNT(*) count FROM moderation_records WHERE entity_type='content' AND entity_id=?").bind(item.content_id).first<{count:number}>())?.count??0;
  }
  const actualR2Keys=new Set<string>();let r2ListingAvailable=true;for(const batchId of batchIds){const listed=await listBatchKeys(batchId);if(listed===null){r2ListingAvailable=false;break}for(const key of listed)actualR2Keys.add(key);}
  const manifestKeys=new Set(items.map(item=>item.r2_key));const orphanR2Keys=r2ListingAvailable?[...actualR2Keys].filter(key=>!manifestKeys.has(key)).length:0;
  const protectedUnownedDemo=(await db.prepare("SELECT COUNT(*) count FROM content_records c WHERE c.is_demo=1 AND NOT EXISTS (SELECT 1 FROM demo_data_items di WHERE di.content_id=c.id AND di.batch_id IN (SELECT id FROM demo_data_batches))").first<{count:number}>())?.count??0;
  const protectedReal=(await db.prepare("SELECT COUNT(*) count FROM content_records WHERE is_demo=0").first<{count:number}>())?.count??0;
  return {allTargetsProven:failures.length===0,failures,batchCount:batchIds.length,itemCount:items.length,contentRows,domainRows,mediaRows,revisionRows,moderationRows,r2Keys:r2ListingAvailable?actualR2Keys.size:items.length,r2ListingAvailable,orphanR2Keys,protectedReal,protectedUnownedDemo};
}

async function deleteOwnedDatabaseItem(db:D1Database,item:DemoItemRow,actorId:number){
  const table=domainTable(item.content_type as ContentType);
  if(!table)throw new PlatformError(409,`Tip neacceptat la curățare: ${item.content_type}.`);
  const contentId=Number(item.content_id),entityId=Number(item.entity_id),mediaId=Number(item.media_asset_id);
  const statements:D1PreparedStatement[]=[
    db.prepare("DELETE FROM content_revisions WHERE entity_type='content' AND entity_id=? AND EXISTS (SELECT 1 FROM content_records WHERE id=? AND is_demo=1)").bind(contentId,contentId),
    db.prepare("DELETE FROM moderation_records WHERE entity_type='content' AND entity_id=? AND EXISTS (SELECT 1 FROM content_records WHERE id=? AND is_demo=1)").bind(contentId,contentId),
    db.prepare("DELETE FROM promoted_placements WHERE entity_type='content' AND entity_id=? AND EXISTS (SELECT 1 FROM content_records WHERE id=? AND is_demo=1)").bind(contentId,contentId),
    db.prepare("DELETE FROM content_reports WHERE entity_type='content' AND entity_id=? AND EXISTS (SELECT 1 FROM content_records WHERE id=? AND is_demo=1)").bind(contentId,contentId),
  ];
  if(item.content_type==="business")statements.push(db.prepare("DELETE FROM business_hours WHERE business_id=? AND EXISTS (SELECT 1 FROM content_records WHERE id=? AND is_demo=1 AND entity_id=?)").bind(entityId,contentId,entityId));
  statements.push(
    db.prepare(`DELETE FROM ${table} WHERE id=? AND EXISTS (SELECT 1 FROM content_records WHERE id=? AND is_demo=1 AND entity_id=? AND type=?)`).bind(entityId,contentId,entityId,item.content_type),
    db.prepare("DELETE FROM media_assets WHERE id=? AND r2_key=? AND EXISTS (SELECT 1 FROM content_records WHERE id=? AND is_demo=1 AND published_media_id=?)").bind(mediaId,item.r2_key,contentId,mediaId),
  );
  const contentDeleteIndex=statements.length;
  statements.push(
    db.prepare("DELETE FROM content_records WHERE id=? AND is_demo=1 AND entity_id=? AND type=? AND EXISTS (SELECT 1 FROM demo_data_items WHERE id=? AND content_id=? AND entity_id=? AND media_asset_id=? AND r2_key=?)").bind(contentId,entityId,item.content_type,item.id,contentId,entityId,mediaId,item.r2_key),
    db.prepare("UPDATE demo_data_items SET cleanup_status='deleted',updated_at=CURRENT_TIMESTAMP WHERE id=? AND batch_id=? AND content_id=? AND entity_id=? AND media_asset_id=? AND r2_key=?").bind(item.id,item.batch_id,contentId,entityId,mediaId,item.r2_key),
    db.prepare("INSERT INTO audit_logs (actor_user_id,action,entity_type,entity_id,metadata) VALUES (?,'demo_content.deleted','content',?,?)").bind(actorId,String(contentId),JSON.stringify({seedKey:item.seed_key,batchId:item.batch_id,type:item.content_type,mediaId})),
  );
  const results=await db.batch(statements);
  if(Number(results[contentDeleteIndex]?.meta?.changes??0)!==1)throw new PlatformError(409,`Curățarea pentru ${item.seed_key} a fost oprită de verificarea de proprietate.`,`demo_cleanup_proof_failed`);
}

function domainTable(type:ContentType){const tables:Record<ContentType,string>={business:"businesses",community_post:"posts",local_story:"posts",article:"posts",business_update:"posts",event:"events",offer:"offers",job:"jobs",restaurant:"restaurants",daily_menu:"daily_menus",place:"places"};return tables[type];}

async function loadFixtureAsset(fixture:DemoFixture){
  if(!env.ASSETS)throw new PlatformError(503,"Binding-ul ASSETS este necesar pentru imaginile demonstrative.","demo_assets_unavailable");
  const response=await env.ASSETS.fetch(new Request(new URL(fixture.imagePath,"https://blaj-azi.invalid")));
  if(!response.ok)throw new PlatformError(500,`Imaginea demonstrativă lipsește: ${fixture.imagePath}.`,`demo_fixture_missing`);
  const bytes=new Uint8Array(await response.arrayBuffer());
  const format=inspectImage(fixture.imagePath,response.headers.get("content-type")||"image/png",bytes);
  return {bytes,format};
}

async function ensureFixtureObject(key:string,asset:Awaited<ReturnType<typeof loadFixtureAsset>>,fixture:DemoFixture,ownerId:number){if(!(await env.MEDIA.head?.(key)))await putFixtureObject(key,asset,fixture,ownerId);}
async function putFixtureObject(key:string,asset:Awaited<ReturnType<typeof loadFixtureAsset>>,fixture:DemoFixture,ownerId:number){await env.MEDIA.put(key,asset.bytes,{httpMetadata:{contentType:asset.format.mime},customMetadata:{demo:"true",ownerUserId:String(ownerId),seedKey:fixture.seedKey,generatorVersion:DEMO_GENERATOR_VERSION}});}
async function hashFixture(fixture:DemoFixture,bytes:Uint8Array){const imageBuffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer;const imageDigest=await crypto.subtle.digest("SHA-256",imageBuffer);const imageHash=[...new Uint8Array(imageDigest)].map(value=>value.toString(16).padStart(2,"0")).join("");const payload=new TextEncoder().encode(JSON.stringify({generatorVersion:DEMO_GENERATOR_VERSION,fixture,imageHash}));const digest=await crypto.subtle.digest("SHA-256",payload);return [...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,"0")).join("");}
async function listBatchKeys(batchId:string){if(!env.MEDIA.list)return null;const keys:string[]=[];let cursor:string|undefined;do{const page=await env.MEDIA.list({prefix:`${DEMO_PREFIX}${batchId}/`,cursor});keys.push(...page.objects.map(object=>object.key));cursor=page.truncated?page.cursor:undefined;}while(cursor);return keys;}
async function rollbackIncompleteFixture(db:D1Database,ids:{contentId:number;entityId:number;mediaId:number;type:ContentType;r2Key:string}){const table=domainTable(ids.type);await db.batch([db.prepare("DELETE FROM content_revisions WHERE entity_type='content' AND entity_id=? AND EXISTS (SELECT 1 FROM content_records WHERE id=? AND is_demo=1 AND entity_id=?)").bind(ids.contentId,ids.contentId,ids.entityId),db.prepare("DELETE FROM moderation_records WHERE entity_type='content' AND entity_id=? AND EXISTS (SELECT 1 FROM content_records WHERE id=? AND is_demo=1 AND entity_id=?)").bind(ids.contentId,ids.contentId,ids.entityId),db.prepare(`DELETE FROM ${table} WHERE id=? AND EXISTS (SELECT 1 FROM content_records WHERE id=? AND is_demo=1 AND entity_id=? AND type=?)`).bind(ids.entityId,ids.contentId,ids.entityId,ids.type),db.prepare("DELETE FROM content_records WHERE id=? AND is_demo=1 AND entity_id=? AND type=?").bind(ids.contentId,ids.entityId,ids.type),db.prepare("DELETE FROM media_assets WHERE id=? AND r2_key=?").bind(ids.mediaId,ids.r2Key)]).catch(()=>undefined);}
function randomId(){const values=new Uint32Array(1);crypto.getRandomValues(values);return 100_000_000+(values[0]%1_900_000_000);}
function numberOrNull(value:unknown){const number=Number(value);return Number.isFinite(number)&&number>0?number:null;}
function safeError(error:unknown){return cleanText(error instanceof Error?error.message:String(error),1000)||"Eroare necunoscută";}
