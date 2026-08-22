import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFile } from "node:fs/promises";
import test from "node:test";

const cms = await import("../app/site-content.ts");
const service = await import("../app/server/site-content.ts");

const admin = { id: 41, email:"admin@example.test", displayName:"Administrator", globalRole:"admin", accountStatus:"active", createdAt:"2026-01-01" };
const owner = { ...admin, id:42, globalRole:"platform_owner" };
const ordinary = { ...admin, id:43, globalRole:"user" };

test("every CMS default validates and Romanian/editorial schemas reject unsafe input", () => {
  assert.equal(cms.siteContentDefinitions.length, 24);
  for (const definition of cms.siteContentDefinitions) assert.deepEqual(cms.validateSiteContent(definition.key, definition.defaults), definition.defaults, definition.key);
  assert.equal(cms.safeInternalHref("/evenimente?period=weekend"), "/evenimente?period=weekend");
  assert.equal(cms.safeInternalHref("//evil.example"), null);
  assert.equal(cms.safeExternalHref("javascript:alert(1)"), null);
  assert.throws(() => cms.validateSiteContent("page.about", { ...cms.defaultSiteContent("page.about"), blocks:[{type:"paragraph",text:"<script>alert(1)</script>"}] }), /text invalid/);
  assert.throws(() => cms.validateSiteContent("home", { ...cms.defaultSiteContent("home"), primaryCtaHref:"javascript:alert(1)" }), /linkul intern nu este sigur/);
  assert.throws(() => cms.validateSiteContent("seo.defaults", { ...cms.defaultSiteContent("seo.defaults"), twitterCard:"player" }), /valoare neacceptată/);
  assert.match(JSON.stringify(cms.defaultSiteContent("home")), /Țetcu Mircea Rareș|Câmpia Libertății/);
});

test("CMS migrations are additive, seeded idempotently, and preserve integrity", async () => {
  const sqlite = new DatabaseSync(":memory:");
  try {
    for (let index=0; index<=7; index++) {
      const names = ["0000_bumpy_vanisher","0001_lame_elektra","0002_great_mastermind","0003_steep_tomorrow_man","0004_curved_meggan","0005_robust_namor","0006_lowly_silverclaw","0007_curly_mandrill"];
      sqlite.exec((await source(`../drizzle/${names[index]}.sql`)).replaceAll("--> statement-breakpoint", ""));
    }
    assert.equal(sqlite.prepare("SELECT COUNT(*) count FROM site_content_entries").get().count, cms.siteContentDefinitions.length);
    assert.equal(sqlite.prepare("SELECT COUNT(*) count FROM site_content_entries WHERE draft_json=published_json").get().count, cms.siteContentDefinitions.length);
    assert.equal(sqlite.prepare("SELECT COUNT(*) count FROM pragma_table_info('content_records') WHERE name IN ('seo_title','seo_description')").get().count, 2);
    const migration = await source("../drizzle/0006_lowly_silverclaw.sql");
    for (const statement of migration.split("--> statement-breakpoint").map(value=>value.trim()).filter(value=>value.startsWith("INSERT OR IGNORE"))) sqlite.exec(statement);
    assert.equal(sqlite.prepare("SELECT COUNT(*) count FROM site_content_entries").get().count, cms.siteContentDefinitions.length);
    assert.equal(sqlite.prepare("PRAGMA integrity_check").get().integrity_check, "ok");
  } finally { sqlite.close(); }
});

test("drafts stay private; admin and platform owner can publish, audit, conflict, and restore", async () => {
  const db = await database();
  await assert.rejects(() => service.loadAdminSiteContent(ordinary,"home",db), error => error.status === 403);
  await assert.rejects(() => service.saveSiteContentDraft(ordinary,"home",cms.defaultSiteContent("home"),1,db), error => error.status === 403);
  const before = await service.loadPublishedSiteContent("home",db);
  const draft = { ...before, titleLine:"Titlu de ciornă cu diacritice: Țară" };
  const saved = await service.saveSiteContentDraft(admin,"home",draft,1,db);
  assert.equal(saved.version,2);
  assert.equal((await service.loadPublishedSiteContent("home",db)).titleLine,before.titleLine);
  await assert.rejects(() => service.saveSiteContentDraft(admin,"home",draft,1,db), error => error.status === 409 && error.code === "stale_version");
  const published = await service.siteContentAction(owner,"home","publish",2,undefined,db);
  assert.equal(published.version,3);
  assert.equal((await service.loadPublishedSiteContent("home",db)).titleLine,draft.titleLine);
  const revisions = await service.listSiteContentRevisions(admin,"home",db);
  assert.ok(revisions.results.some(item=>item.action==="updated"));
  assert.ok(revisions.results.some(item=>item.action==="published"));
  const earlier = revisions.results.find(item=>item.action==="updated");
  await service.siteContentAction(admin,"home","restore",3,earlier.id,db);
  assert.ok((await db.prepare("SELECT COUNT(*) count FROM audit_logs WHERE action LIKE 'site_content.%'").first()).count >= 3);
});

test("publishing enforces approved active media while drafts may reference pending media", async () => {
  const db=await database();
  await db.prepare("INSERT INTO media_assets (id,r2_key,alt_text,owner_user_id,mime_type,size_bytes,approval_status,media_status) VALUES (900,'test/900.jpg','Imagine test',41,'image/jpeg',10,'pending','active')").run();
  const home=cms.defaultSiteContent("home");home.heroImage={...home.heroImage,src:"",mediaId:900,alt:"Imagine test",license:"Material propriu"};
  await service.saveSiteContentDraft(admin,"home",home,1,db);
  await assert.rejects(()=>service.siteContentAction(admin,"home","publish",2,undefined,db),error=>error.code==="media_not_approved");
  await db.prepare("UPDATE media_assets SET approval_status='approved' WHERE id=900").run();
  await service.siteContentAction(admin,"home","publish",2,undefined,db);
  assert.equal((await service.loadPublishedSiteContent("home",db)).heroImage.mediaId,900);
});

test("homepage accepts intentional blanks, optional links, cleared media, and upgrades legacy records by presence", async () => {
  const defaults = cms.defaultSiteContent("home");
  const blank = {
    ...defaults,
    titleLine: "",
    emphasizedTitleLine: "",
    primaryCtaLabel: "",
    primaryCtaHref: "",
    eventsLinkHref: "",
    heroImage: { src:"", mediaId:null, alt:"", decorative:false, caption:"", author:"", sourceUrl:"", license:"", objectPosition:"center", showCredit:false },
  };
  const validated = cms.validateSiteContent("home", blank);
  assert.equal(validated.titleLine, "");
  assert.equal(validated.primaryCtaHref, "");
  assert.deepEqual(validated.heroImage, blank.heroImage);
  assert.doesNotThrow(() => cms.validateSiteContent("home", { ...blank, editorialCtaHref:"" }));
  assert.throws(() => cms.validateSiteContent("home", { ...blank, editorialCtaHref:"https://evil.example" }), /linkul intern nu este sigur/);

  const db = await database();
  const legacy = { titleLine:"Titlu vechi", primaryCtaLabel:"", primaryCtaHref:"", quickCategories:[], restaurantFilters:["Toate"] };
  await db.prepare("UPDATE site_content_entries SET published_json=?,draft_json=?,schema_version=1 WHERE key='home'").bind(JSON.stringify(legacy),JSON.stringify(legacy)).run();
  const loaded = await service.loadPublishedSiteContent("home",db);
  assert.equal(loaded.titleLine,"Titlu vechi");
  assert.equal(loaded.kicker,defaults.kicker);
  assert.equal(loaded.primaryCtaLabel,"");
  assert.deepEqual(loaded.quickCategories,[]);
  assert.equal(loaded.restaurantFilters[0].value,"Toate");
  assert.equal(loaded.restaurantFilters[0].visible,true);
  assert.equal(loaded.restaurantFilters[0].deleted,false);
});

test("homepage snapshots preserve blank, hidden, deleted, reordered, and cleared states through publish and revision restore", async () => {
  const db = await database();
  const home = cms.defaultSiteContent("home");
  const clearedImage = { src:"", mediaId:null, alt:"", decorative:false, caption:"", author:"", sourceUrl:"", license:"", objectPosition:"center", showCredit:false };
  const target = {
    ...home,
    titleLine:"",
    primaryCtaLabel:"",
    primaryCtaHref:"",
    eventsVisible:false,
    editorialImage:clearedImage,
    quickCategories:[home.quickCategories[2],{...home.quickCategories[0],visible:false,deleted:true},home.quickCategories[1]],
    restaurantFilters:[home.restaurantFilters[2],{...home.restaurantFilters[0],visible:false,deleted:true}],
  };
  const saved = await service.saveSiteContentDraft(admin,"home",target,1,db);
  const adminDraft = await service.loadAdminSiteContent(admin,"home",db);
  assert.deepEqual(adminDraft.draft,target);
  assert.notDeepEqual(await service.loadPublishedSiteContent("home",db),target);

  await service.siteContentAction(admin,"home","publish",saved.version,undefined,db);
  assert.deepEqual(await service.loadPublishedSiteContent("home",db),target);

  const changed = { ...target, titleLine:"Schimbare ulterioară", eventsVisible:true, quickCategories:[] };
  await service.saveSiteContentDraft(admin,"home",changed,3,db);
  const revisions = await service.listSiteContentRevisions(admin,"home",db);
  const exact = revisions.results.find(item => item.action === "updated" && JSON.parse(item.snapshot).titleLine === "");
  assert.ok(exact);
  await service.siteContentAction(admin,"home","restore",4,exact.id,db);
  assert.deepEqual(await service.loadPublishedSiteContent("home",db),target);
  const restored = await service.loadAdminSiteContent(admin,"home",db);
  assert.deepEqual(restored.draft,target);
  assert.deepEqual(restored.published,target);
});

async function database(){const sqlite=new DatabaseSync(":memory:");for(const name of ["0000_bumpy_vanisher","0001_lame_elektra","0002_great_mastermind","0003_steep_tomorrow_man","0004_curved_meggan","0005_robust_namor","0006_lowly_silverclaw","0007_curly_mandrill"]){sqlite.exec((await source(`../drizzle/${name}.sql`)).replaceAll("--> statement-breakpoint",""));}return new D1(sqlite)}
async function source(path){return readFile(new URL(path,import.meta.url),"utf8")}
class D1{constructor(sqlite){this.sqlite=sqlite}prepare(sql){return new Statement(this.sqlite,sql)}async batch(statements){this.sqlite.exec("BEGIN");try{const results=statements.map(statement=>statement.execute());this.sqlite.exec("COMMIT");return results}catch(error){this.sqlite.exec("ROLLBACK");throw error}}}
class Statement{constructor(sqlite,sql){this.sqlite=sqlite;this.sql=sql;this.values=[]}bind(...values){this.values=values;return this}async first(){return this.sqlite.prepare(this.sql).get(...this.values)||null}async all(){return{results:this.sqlite.prepare(this.sql).all(...this.values)}}async run(){return this.execute()}execute(){const result=this.sqlite.prepare(this.sql).run(...this.values);return{success:true,meta:{changes:Number(result.changes),last_row_id:Number(result.lastInsertRowid)}}}}
