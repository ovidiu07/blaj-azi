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
  "0000_bumpy_vanisher", "0001_lame_elektra", "0002_great_mastermind", "0003_steep_tomorrow_man",
  "0004_curved_meggan", "0005_robust_namor", "0006_lowly_silverclaw", "0007_curly_mandrill",
  "0008_theme_site", "0009_content_primary_media", "0010_demo_data_batches",
];
const testEnvironment = { DB:null };
globalThis.__BLAJ_TEST_ENV__ = testEnvironment;
const content = await import("../app/server/content.ts");
const publicData = await import("../app/server/public-data.ts");
const adminRoute = await readFile(new URL("../app/api/admin/moderation/route.ts", import.meta.url), "utf8");
const submissionRoute = await readFile(new URL("../app/api/submissions/route.ts", import.meta.url), "utf8");

test("authenticated event submission atomically reaches the canonical administrator queue and stays private", async () => {
  const { db, sqlite } = await setup();
  try {
    const user = account(501, "user");
    await insertAccount(db, user);
    const created = await content.submitAuthenticatedEvent(user, {
      ...validEvent(), ownerUserId:999, globalRole:"platform_owner", status:"published", visibility:"public",
    }, new Date("2026-08-28T09:00:00Z"));

    assert.equal(created.status, "pending_review");
    assert.equal(created.moderationState, "pending_review");
    assert.equal(created.visibility, "private");
    assert.match(created.reference, /^BA-\d{6,}$/);

    const record = await db.prepare("SELECT * FROM content_records WHERE id=?").bind(created.contentId).first();
    const event = await db.prepare("SELECT * FROM events WHERE id=?").bind(created.entityId).first();
    const submission = await db.prepare("SELECT * FROM submissions WHERE id=?").bind(created.submissionId).first();
    assert.deepEqual(
      [record.type, record.owner_user_id, record.status, record.moderation_state, record.visibility],
      ["event", user.id, "pending_review", "pending_review", "private"],
    );
    assert.deepEqual(
      [event.title, event.locality, event.venue, event.organizer, event.starts_at, event.ends_at, event.status],
      [validEvent().title, "Blaj", "Palatul Cultural", "Asociația TEST", "2026-10-10T15:30:00.000Z", "2026-10-10T17:00:00.000Z", "pending_review"],
    );
    assert.deepEqual(
      [submission.user_id, submission.content_item_id, submission.status, submission.email],
      [user.id, created.contentId, "pending_review", user.email],
    );
    assert.equal(JSON.parse(submission.payload).bookingUrl, "https://example.test/rezervare");

    const queued = (await content.listModerationQueue()).results.find(item => item.id === created.contentId);
    assert.ok(queued);
    assert.equal(queued.submission_reference, created.reference);
    assert.equal(queued.author_name, user.displayName);
    assert.equal(queued.submission_category, "Cultură");
    assert.equal(queued.event_starts_at, "2026-10-10T15:30:00.000Z");
    assert.equal(queued.event_venue, "Palatul Cultural");
    assert.equal(queued.event_organizer, "Asociația TEST");

    assert.equal((await publicData.loadPublicCatalog(new Date("2026-08-28T09:00:00Z"))).events.some(item => item.contentId === created.contentId), false);
    assert.equal((await db.prepare("SELECT COUNT(*) count FROM audit_logs WHERE entity_id=? AND action IN ('content.created','content.submit')").bind(String(created.contentId)).first()).count, 2);
    assert.equal((await db.prepare("SELECT COUNT(*) count FROM notifications WHERE user_id=? AND related_entity_id=? AND notification_type='content_submitted'").bind(user.id,String(created.contentId)).first()).count, 1);
  } finally { sqlite.close(); }
});

test("event validation uses Europe/Bucharest and invalid input creates no partial rows", async () => {
  const { db, sqlite } = await setup();
  try {
    const user = account(502, "user");
    await insertAccount(db, user);
    assert.equal(content.normalizeBucharestDateTime("2026-01-10T18:30"), "2026-01-10T16:30:00.000Z");
    assert.equal(content.normalizeBucharestDateTime("2026-10-10T18:30"), "2026-10-10T15:30:00.000Z");
    const before = await totals(db);
    await assert.rejects(
      () => content.submitAuthenticatedEvent(user, { ...validEvent(), startsAt:"2026-08-27T18:30" }, new Date("2026-08-28T09:00:00Z")),
      error => error.status === 400 && error.code === "event_in_past",
    );
    await assert.rejects(
      () => content.submitAuthenticatedEvent(user, { ...validEvent(), endsAt:"2026-10-10T17:00", startsAt:"2026-10-10T18:30" }, new Date("2026-08-28T09:00:00Z")),
      error => error.status === 400 && error.code === "event_range_invalid",
    );
    assert.deepEqual(await totals(db), before);
  } finally { sqlite.close(); }
});

test("only an administrator can decide the linked event, and publication updates audit, intake, and public data", async () => {
  const { db, sqlite } = await setup();
  try {
    const user = account(503, "user");
    const admin = account(504, "admin");
    await insertAccount(db, user);
    await insertAccount(db, admin);
    const created = await content.submitAuthenticatedEvent(user, validEvent(), new Date("2026-08-28T09:00:00Z"));
    await assert.rejects(() => content.adminModerate(user, created.contentId, "publish", "încercare"), error => error.status === 403);
    assert.equal((await db.prepare("SELECT status FROM content_records WHERE id=?").bind(created.contentId).first()).status, "pending_review");

    const published = await content.adminModerate(admin, created.contentId, "publish", "Datele evenimentului au fost verificate local.");
    assert.equal(published.status, "published");
    assert.equal((await db.prepare("SELECT status FROM submissions WHERE id=?").bind(created.submissionId).first()).status, "published");
    assert.equal((await db.prepare("SELECT status FROM events WHERE id=?").bind(created.entityId).first()).status, "published");
    const moderation = await db.prepare("SELECT * FROM moderation_records WHERE entity_id=? ORDER BY id DESC LIMIT 1").bind(created.contentId).first();
    assert.equal(moderation.submission_id, created.submissionId);
    assert.equal(moderation.moderator_id, String(admin.id));
    assert.equal(moderation.action, "publish");
    assert.equal((await publicData.loadPublicCatalog(new Date("2026-08-28T09:00:00Z"))).events.some(item => item.contentId === created.contentId), true);

    assert.match(adminRoute, /requireAuthenticatedUser/);
    assert.match(adminRoute, /isAdmin/);
    assert.match(submissionRoute, /submitAuthenticatedEvent\(account/);
    assert.doesNotMatch(submissionRoute, /submitAuthenticatedEvent\([^)]*(ownerUserId|globalRole|status|visibility)/s);
  } finally { sqlite.close(); }
});

async function setup() {
  const sqlite = new DatabaseSync(":memory:");
  for (const name of migrationNames) {
    const sql = await readFile(new URL(`../drizzle/${name}.sql`, import.meta.url), "utf8");
    for (const statement of sql.split("--> statement-breakpoint").map(value => value.trim()).filter(Boolean)) sqlite.exec(statement);
  }
  const db = new D1(sqlite);
  testEnvironment.DB = db;
  return { db, sqlite };
}

async function insertAccount(db, value) {
  await db.prepare("INSERT INTO users (id,external_user_id,email,normalized_email,display_name,global_role,account_status) VALUES (?,?,?,?,?,?,'active')")
    .bind(value.id,value.externalUserId,value.email,value.normalizedEmail,value.displayName,value.globalRole).run();
}

function account(id, globalRole) {
  return { id, externalUserId:`event-test-${id}`, email:`event-${id}@example.test`, normalizedEmail:`event-${id}@example.test`, displayName:`Utilizator test ${id}`, avatarUrl:null, globalRole, accountStatus:"active", createdAt:"2026-08-28", lastLoginAt:"2026-08-28" };
}

function validEvent() {
  return {
    title:"[TEST MODERARE] Eveniment Codex 2026-08-28T12:00",
    locality:"Blaj", category:"Cultură", description:"Eveniment local fictiv, creat exclusiv în baza de date de test.",
    startsAt:"2026-10-10T18:30", endsAt:"2026-10-10T20:00", venue:"Palatul Cultural",
    address:"Strada Mihai Eminescu 3", organizer:"Asociația TEST", price:"Acces gratuit",
    bookingUrl:"https://example.test/rezervare", sourceUrl:"https://example.test/sursa",
    accessibility:"Acces de test", rightsConfirmed:true, consent:true,
  };
}

async function totals(db) {
  const row = await db.prepare("SELECT (SELECT COUNT(*) FROM submissions) submissions,(SELECT COUNT(*) FROM content_records) content,(SELECT COUNT(*) FROM events) events").first();
  return [row.submissions,row.content,row.events];
}
