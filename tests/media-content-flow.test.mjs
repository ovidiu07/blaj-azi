import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFile } from "node:fs/promises";
import test from "node:test";

class D1 {
  constructor(database) { this.sqlite = database; }
  prepare(sql) { return new Statement(this.sqlite, sql); }
  async batch(statements) {
    this.sqlite.exec("BEGIN");
    try {
      const results = statements.map(statement => statement.execute());
      this.sqlite.exec("COMMIT");
      return results;
    } catch (error) {
      this.sqlite.exec("ROLLBACK");
      throw error;
    }
  }
}

class Statement {
  constructor(database, sql) { this.sqlite = database; this.sql = sql; this.values = []; }
  bind(...values) { this.values = values.map(value => typeof value === "boolean" ? Number(value) : value === undefined ? null : value); return this; }
  async first() { return this.sqlite.prepare(this.sql).get(...this.values) || null; }
  async all() { return { results:this.sqlite.prepare(this.sql).all(...this.values) }; }
  async run() { return this.execute(); }
  execute() {
    const result = this.sqlite.prepare(this.sql).run(...this.values);
    return { success:true, meta:{ changes:Number(result.changes), last_row_id:Number(result.lastInsertRowid) } };
  }
}

const migrationNames = [
  "0000_bumpy_vanisher",
  "0001_lame_elektra",
  "0002_great_mastermind",
  "0003_steep_tomorrow_man",
  "0004_curved_meggan",
  "0005_robust_namor",
  "0006_lowly_silverclaw",
  "0007_curly_mandrill",
  "0008_theme_site",
  "0009_content_primary_media",
  "0010_demo_data_batches",
];

const sqlite = new DatabaseSync(":memory:");
for (const name of migrationNames) {
  const sql = await readFile(new URL(`../drizzle/${name}.sql`, import.meta.url), "utf8");
  for (const statement of sql.split("--> statement-breakpoint").map(value => value.trim()).filter(Boolean)) sqlite.exec(statement);
}
const db = new D1(sqlite);
globalThis.__BLAJ_TEST_ENV__ = { DB: db };

const content = await import("../app/server/content.ts");
const publicData = await import("../app/server/public-data.ts");
const { ImageValidationError, inspectImage, MAX_IMAGE_BYTES } = await import("../app/server/media.ts");

const user = account(91, "user");
const other = account(92, "user");
const admin = account(93, "admin");
for (const item of [user, other, admin]) {
  await db.prepare("INSERT INTO users (id,external_user_id,email,normalized_email,display_name,global_role,account_status) VALUES (?,?,?,?,?,?,'active')")
    .bind(item.id, item.externalUserId, item.email, item.normalizedEmail, item.displayName, item.globalRole).run();
}
const business = await db.prepare("SELECT id FROM businesses ORDER BY id LIMIT 1").first();
const restaurant = await db.prepare("SELECT id FROM restaurants ORDER BY id LIMIT 1").first();
assert.ok(business?.id, "seed migrations must provide a business");
assert.ok(restaurant?.id, "seed migrations must provide a restaurant");
await db.prepare("INSERT INTO business_memberships (business_id,user_id,membership_role,membership_status) VALUES (?,?,'owner','active')").bind(business.id,user.id).run();

test("all ordinary-user content types persist a selected image through create and reload", async () => {
  assert.deepEqual(content.ordinaryUserContentTypes, ["business","community_post","local_story","business_update","event","offer","job","restaurant","daily_menu","place"]);
  for (const [index, type] of content.ordinaryUserContentTypes.entries()) {
    const mediaId = await media(user.id, `matrix-${type}.png`, `Imagine pentru ${type}`);
    const created = await content.createContent(user, payload(type, index, mediaId));
    assert.equal(created.primaryMediaId, mediaId, type);
    assert.equal(created.primaryMediaState, "selected", type);
    assert.equal(created.media?.altText, `Imagine pentru ${type}`, type);
    const row = await db.prepare("SELECT primary_media_id,primary_media_alt_text,primary_media_state,version FROM content_records WHERE id=?").bind(created.id).first();
    assert.equal(row.primary_media_id, mediaId, type);
    assert.equal(row.primary_media_alt_text, `Imagine pentru ${type}`, type);
    assert.equal(row.primary_media_state, "selected", type);
    assert.equal(row.version, 1, type);
    assert.equal((await db.prepare("SELECT content_id,orphaned_at FROM media_assets WHERE id=?").bind(mediaId).first()).content_id, created.id, type);
    const reloaded = await content.getContentForEditor(user, created.id);
    assert.equal(reloaded.media?.id, mediaId, type);
    assert.equal(reloaded.version, 1, type);
  }
});

test("add, replace, remove, save, and reopen preserve explicit media state", async () => {
  const first = await media(user.id, "first.png", "Prima fotografie");
  const created = await content.createContent(user, payload("community_post", 20, first));
  const second = await media(user.id, "second.png", "A doua fotografie");
  const replaced = await content.updateContent(user, created.id, { ...payload("community_post", 20, second), version: created.version });
  assert.equal(replaced.version, 2);
  assert.equal((await content.getContentForEditor(user, created.id)).media?.id, second);
  const removed = await content.updateContent(user, created.id, { ...payload("community_post", 20, null), primaryMediaState:"none", primaryMediaAltText:"", version: replaced.version });
  assert.equal(removed.version, 3);
  const reopened = await content.getContentForEditor(user, created.id);
  assert.equal(reopened.primaryMediaState, "none");
  assert.equal(reopened.primaryMediaId, null);
  assert.equal(reopened.media, null);
  const list = await content.listMyContent(user);
  assert.equal(list.results.find(item => item.id === created.id).editor_media_id, null);
});

test("published revision reload uses the authoritative content version instead of the stale snapshot version", async () => {
  const first = await media(user.id, "revision-one.png", "Fotografie publicabilă");
  const created = await content.createContent(user, payload("event", 30, first));
  const submitted = await content.contentAction(user, created.id, "submit", created.version);
  const published = await content.adminModerate(admin, created.id, "publish", "Verificat");
  assert.equal(submitted.version, 2);
  assert.equal(published.version, 3);
  assert.equal((await db.prepare("SELECT approval_status FROM media_assets WHERE id=?").bind(first).first()).approval_status, "approved");
  assert.equal((await db.prepare("SELECT COUNT(*) count FROM audit_logs WHERE action='media.approved_via_content' AND entity_id=?").bind(String(first)).first()).count, 1);
  const publicEvent = (await publicData.loadPublicCatalog(new Date("2026-08-24T10:00:00Z"))).events.find(item => item.contentId === created.id);
  assert.equal(publicEvent?.image, `/api/media/${first}`);
  assert.equal(publicEvent?.imageAlt, "Imagine pentru event");

  const replacement = await media(user.id, "revision-two.png", "Fotografie revizuită");
  const draftRevision = await content.updateContent(user, created.id, { ...payload("event", 31, replacement), version: published.version });
  const submittedRevision = await content.contentAction(user, created.id, "submit", draftRevision.version);
  const needsChanges = await content.adminModerate(admin, created.id, "needs_changes", "Clarifică detaliile evenimentului.");
  assert.equal(submittedRevision.version, 5);
  assert.equal(needsChanges.version, 6);

  const reopened = await content.getContentForEditor(user, created.id);
  assert.equal(reopened.version, 6, "row version must override revision snapshot version 4");
  assert.equal(reopened.media?.id, replacement);
  const saved = await content.updateContent(user, created.id, { ...payload("event", 32, replacement), version: reopened.version });
  assert.equal(saved.version, 7);
});

test("moderation refuses rejected selected media instead of silently publishing without it", async () => {
  const selected = await media(user.id, "rejected.png", "Imagine respinsă");
  const created = await content.createContent(user, payload("community_post", 35, selected));
  await content.contentAction(user, created.id, "submit", created.version);
  await db.prepare("UPDATE media_assets SET approval_status='rejected' WHERE id=?").bind(selected).run();
  await assert.rejects(
    () => content.adminModerate(admin, created.id, "publish", "Imagine neverificată"),
    error => error.status === 409 && error.code === "media_rejected",
  );
  const row = await db.prepare("SELECT status,moderation_state,published_media_id FROM content_records WHERE id=?").bind(created.id).first();
  assert.equal(row.status, "pending_review");
  assert.equal(row.moderation_state, "pending_review");
  assert.equal(row.published_media_id, null);
});

test("an author cannot restore public content with a newly pending image", async () => {
  const approved = await media(user.id, "approved-before-archive.png", "Imagine aprobată");
  const created = await content.createContent(user, payload("local_story", 36, approved));
  await content.contentAction(user, created.id, "submit", created.version);
  const published = await content.adminModerate(admin, created.id, "publish", "Verificat");
  const archived = await content.contentAction(user, created.id, "archive", published.version);
  await db.prepare("UPDATE media_assets SET approval_status='pending' WHERE id=?").bind(approved).run();
  await assert.rejects(
    () => content.contentAction(user, created.id, "restore", archived.version),
    error => error.status === 409 && error.code === "media_not_approved",
  );
  assert.equal((await db.prepare("SELECT status FROM content_records WHERE id=?").bind(created.id).first()).status, "archived");
});

test("a genuine two-editor conflict returns 409 without overwriting the first save", async () => {
  const selected = await media(user.id, "conflict.png", "Imagine conflict");
  const created = await content.createContent(user, payload("community_post", 40, selected));
  const editorA = await content.getContentForEditor(user, created.id);
  const editorB = await content.getContentForEditor(user, created.id);
  const firstSave = await content.updateContent(user, created.id, { ...payload("community_post", 41, selected), title:"Salvarea editorului A", version:editorA.version });
  assert.equal(firstSave.version, 2);
  await assert.rejects(
    () => content.updateContent(user, created.id, { ...payload("community_post", 42, selected), title:"Salvarea editorului B", version:editorB.version }),
    error => error.status === 409 && error.code === "stale_version" && /Păstrăm modificările tale nesalvate/.test(error.message),
  );
  assert.equal((await db.prepare("SELECT title,version FROM content_records WHERE id=?").bind(created.id).first()).title, "Salvarea editorului A");
  const latest = await content.getContentForEditor(user, created.id);
  const rebased = await content.updateContent(user, created.id, { ...payload("community_post", 43, selected), title:"Salvarea editorului B după comparare", version:latest.version });
  assert.equal(rebased.version, 3);
});

test("ownership checks block cross-user content and media changes while administrators retain access", async () => {
  const owned = await media(user.id, "owned.png", "Imagine proprie");
  const created = await content.createContent(user, payload("place", 50, owned));
  const foreign = await media(other.id, "foreign.png", "Imagine străină");
  await assert.rejects(() => content.updateContent(user, created.id, { ...payload("place", 51, foreign), version:created.version }), error => error.status === 403 && error.code === "media_forbidden");
  await assert.rejects(() => content.updateContent(other, created.id, { ...payload("place", 52, foreign), version:created.version }), error => error.status === 403);
  const adminSave = await content.updateContent(admin, created.id, { ...payload("place", 53, foreign), version:created.version });
  assert.equal(adminSave.primaryMediaId, foreign);
});

test("image inspection accepts real PNG bytes and rejects empty, disguised, unsupported, oversized, and excessive-dimension files", () => {
  const png = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlGQAAAAASUVORK5CYII=", "base64"));
  assert.deepEqual(inspectImage("sigur.png", "image/png", png), { mime:"image/png", extension:"png", width:1, height:1 });
  rejectsImage(() => inspectImage("gol.png", "image/png", new Uint8Array()), "empty");
  rejectsImage(() => inspectImage("mascat.png", "image/png", new TextEncoder().encode("nu este o imagine")), "invalid");
  rejectsImage(() => inspectImage("mascat.jpg", "image/png", png), "unsupported");
  rejectsImage(() => inspectImage("vector.svg", "image/svg+xml", png), "unsupported");
  rejectsImage(() => inspectImage("mare.png", "image/png", new Uint8Array(MAX_IMAGE_BYTES + 1)), "too_large");
  const huge = png.slice();
  new DataView(huge.buffer, huge.byteOffset, huge.byteLength).setUint32(16, 10_000);new DataView(huge.buffer, huge.byteOffset, huge.byteLength).setUint32(20, 5_000);
  rejectsImage(() => inspectImage("dimensiuni.png", "image/png", huge), "dimensions");
});

test("additive media migration is complete and leaves SQLite integrity intact", async () => {
  const contentColumns = (await db.prepare("SELECT name FROM pragma_table_info('content_records')").all()).results.map(row => row.name);
  const mediaColumns = (await db.prepare("SELECT name FROM pragma_table_info('media_assets')").all()).results.map(row => row.name);
  for (const column of ["primary_media_id","primary_media_alt_text","primary_media_state","published_media_id","published_media_alt_text","published_media_state","last_mutation_id"]) assert.ok(contentColumns.includes(column), column);
  for (const column of ["width","height","upload_id"]) assert.ok(mediaColumns.includes(column), column);
  assert.ok(await db.prepare("SELECT name FROM sqlite_schema WHERE type='index' AND name='media_assets_upload_id_unique'").first());
  assert.equal((await db.prepare("PRAGMA integrity_check").first()).integrity_check, "ok");
});

test("upload, editor, moderation, and public rendering keep the media contract explicit", async () => {
  const uploadRoute = await source("app/api/media/route.ts");
  const mediaRoute = await source("app/api/media/[id]/route.ts");
  const editor = await source("app/ui/Management.tsx");
  const publicData = await source("app/server/public-data.ts");
  const publicPages = await source("app/ui/PublicPages.tsx");
  const styles = await source("app/globals.css");
  assert.match(uploadRoute, /uploadId.*media_assets.*upload_id/s);
  assert.match(uploadRoute, /crypto\.randomUUID\(\).*format\.extension/s);
  assert.match(uploadRoute, /Imaginea depășește dimensiunea maximă permisă/);
  assert.match(uploadRoute, /Formatul imaginii nu este acceptat/);
  assert.match(uploadRoute, /Fișierul selectat nu este o imagine validă/);
  assert.match(mediaRoute, /publishedSelection.*publiclyAvailable/s);
  assert.match(mediaRoute, /private, no-store/);
  assert.match(editor, /inFlightRef\.current.*submitInFlightRef\.current/s);
  assert.match(editor, /primaryMediaState.*selected.*none/s);
  assert.match(editor, /Elimină imaginea/);
  assert.match(publicData, /approval_status='approved'.*media_status='active'/s);
  assert.match(publicPages, /srcSet=\{mediaSrcSet/);
  assert.match(publicPages, /imageAlt/);
  assert.match(styles, /\.editor-media-preview img[^}]*max-height[^}]*object-fit:contain/s);
  assert.match(styles, /\.management-thumbnail/);
});

async function media(ownerId, filename, altText) {
  const result = await db.prepare("INSERT INTO media_assets (r2_key,alt_text,owner_user_id,original_filename,mime_type,size_bytes,width,height,approval_status,media_status,orphaned_at) VALUES (?,?,?,?,?,123,1,1,'pending','active',datetime('now','+7 days'))")
    .bind(`users/${ownerId}/${filename}`, altText, ownerId, filename, "image/png").run();
  return Number(result.meta.last_row_id);
}

function payload(type, index, mediaId) {
  const requiresBusiness = ["business_update","offer","job","restaurant","daily_menu"].includes(type);
  const details = type === "event" ? { startsAt:"2026-09-20T10:00", venue:"Blaj" }
    : type === "offer" ? { startsAt:"2026-09-01", endsAt:"2026-09-30", terms:"Condiții clare" }
    : type === "job" ? { company:"Companie locală", requirements:"Cerințe", responsibilities:"Responsabilități" }
    : type === "restaurant" ? { cuisine:"Românească" }
    : type === "daily_menu" ? { restaurantId:restaurant.id, menuDate:"2026-09-20", soup:"Ciorbă", mainDish:"Fel principal" }
    : type === "place" ? { address:"Piața 1848, Blaj" }
    : type === "business" ? { address:"Piața 1848, Blaj", phone:"+40 700 000 000" }
    : {};
  return {
    type,
    title:`Material ${type} ${index}`,
    excerpt:`Rezumat verificabil pentru ${type} ${index}`,
    body:["community_post","local_story","business_update"].includes(type) ? `Conținut complet pentru ${type} ${index}` : undefined,
    locality:"Blaj",
    businessId:requiresBusiness ? business.id : null,
    primaryMediaId:mediaId,
    primaryMediaAltText:mediaId ? `Imagine pentru ${type}` : "",
    primaryMediaState:mediaId ? "selected" : "none",
    details,
  };
}

function account(id, globalRole) {
  return { id, externalUserId:`test-${id}`, email:`test-${id}@example.test`, normalizedEmail:`test-${id}@example.test`, displayName:`Test ${id}`, avatarUrl:null, globalRole, accountStatus:"active", createdAt:"2026-08-23", lastLoginAt:"2026-08-23" };
}

function rejectsImage(action, reason) {
  assert.throws(action, error => error instanceof ImageValidationError && error.reason === reason);
}

function source(path) { return readFile(new URL(`../${path}`, import.meta.url), "utf8"); }
