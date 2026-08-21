import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = path => readFile(new URL(path, root), "utf8");

test("phase-two migration applies after the original schema and seeds public content once", async () => {
  const directory = await mkdtemp(join(tmpdir(), "blaj-azi-migration-"));
  const database = join(directory, "test.sqlite");
  const db = new DatabaseSync(database);
  try {
    for (const migration of [
      "drizzle/0000_bumpy_vanisher.sql",
      "drizzle/0001_lame_elektra.sql",
      "drizzle/0002_great_mastermind.sql",
      "drizzle/0003_steep_tomorrow_man.sql",
      "drizzle/0004_curved_meggan.sql",
      "drizzle/0005_robust_namor.sql",
    ]) {
      db.exec((await read(migration)).replaceAll("--> statement-breakpoint", ""));
    }
    const scalar = sql => String(Object.values(db.prepare(sql).get())[0]);
    const result = [
      scalar("SELECT COUNT(*) FROM content_records WHERE status='published' AND visibility='public' AND deleted_at IS NULL"),
      scalar("SELECT COUNT(*) FROM pragma_table_info('media_assets') WHERE name IN ('business_id','content_id')"),
      scalar("SELECT COUNT(*) FROM sqlite_schema WHERE type='table' AND name IN ('auth_identities','password_credentials','auth_sessions','auth_attempts')"),
      scalar("SELECT COUNT(*) FROM pragma_table_info('submissions') WHERE name='payload'"),
      scalar("SELECT COUNT(*) FROM content_records WHERE type='place' AND is_demo=0"),
      scalar("SELECT COUNT(*) FROM events WHERE created_at='CURRENT_TIMESTAMP' OR updated_at='CURRENT_TIMESTAMP'"),
      scalar("SELECT COUNT(*) FROM sqlite_schema WHERE type='index' AND name IN ('idx_content_records_public_discovery','idx_events_public_dates','idx_offers_public_dates','idx_jobs_public_deadline')"),
      scalar("PRAGMA integrity_check"),
    ];
    assert.equal(Number(result[0]), 20);
    assert.equal(Number(result[1]), 2);
    assert.equal(Number(result[2]), 4);
    assert.equal(Number(result[3]), 1);
    assert.equal(Number(result[4]), 4);
    assert.equal(Number(result[5]), 0);
    assert.equal(Number(result[6]), 4);
    assert.equal(result[7], "ok");
  } finally {
    db.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("mutation endpoints authenticate, authorize, and reject cross-site writes", async () => {
  const routes = [
    "app/api/account/content/route.ts",
    "app/api/account/content/[id]/route.ts",
    "app/api/account/content/[id]/actions/route.ts",
    "app/api/account/claims/route.ts",
    "app/api/account/businesses/route.ts",
    "app/api/account/notifications/route.ts",
    "app/api/admin/moderation/route.ts",
    "app/api/admin/claims/route.ts",
    "app/api/admin/users/route.ts",
    "app/api/admin/businesses/[id]/route.ts",
    "app/api/admin/content/[id]/permanent-delete/route.ts",
    "app/api/admin/categories/route.ts",
    "app/api/admin/reports/route.ts",
    "app/api/admin/promotions/route.ts",
    "app/api/admin/site-content/[key]/route.ts",
    "app/api/businesses/[id]/hours/route.ts",
    "app/api/businesses/[id]/team/route.ts",
    "app/api/media/route.ts",
    "app/api/media/[id]/route.ts",
  ];
  for (const route of routes) {
    const source = await read(route);
    assert.match(source, /requireAuthenticatedUser/);
    assert.match(source, /assertSameOrigin/);
  }
  for (const route of ["app/api/auth/register/route.ts", "app/api/auth/login/route.ts", "app/api/auth/logout/route.ts"]) {
    assert.match(await read(route), /assertSameOrigin/);
  }
  const platform = await read("app/server/platform.ts");
  assert.match(platform, /oai-authenticated|trusted_identity|external_user_id/);
  assert.match(platform, /business_memberships/);
  const auth = await read("app/server/auth.ts");
  assert.match(auth, /PASSWORD_HASH_VERSION = "scrypt-v1"/);
  assert.match(auth, /scryptCallback/);
  assert.match(auth, /token_hash/);
  assert.match(auth, /global_role.*'user'/s);
  assert.doesNotMatch(auth, /input\.(role|globalRole|ownerUserId|membershipId)/);
  assert.match(await read("app/api/admin/users/route.ts"), /Ultimul proprietar activ al platformei/);
  const cmsRoute = await read("app/api/admin/site-content/[key]/route.ts");
  assert.match(cmsRoute, /loadAdminSiteContent|saveSiteContentDraft|siteContentAction/);
  assert.match(await read("app/server/site-content.ts"), /stale_version|site_content\.published|media_not_approved/);
  assert.match(await read("app/api/submissions/route.ts"), /assertSameOrigin/);
  assert.match(await read("app/api/admin/claims/route.ts"), /owner_user_id=\?,business_id=\?/);
  assert.match(await read("app/api/media/[id]/route.ts"), /approval_status==="approved".*content_visibility==="public"/s);
});

test("content lifecycle preserves public revisions and blocks ownership escalation", async () => {
  const content = await read("app/server/content.ts");
  assert.match(content, /publicVersionPreserved: true/);
  assert.match(content, /Retrage mai întâi trimiterea înainte de editare/);
  assert.match(content, /scheduled_at|scheduledAt/);
  assert.match(content, /canManageEntity/);
  assert.doesNotMatch(content, /raw\.ownerUserId|raw\.createdBy|raw\.publishedBy/);
  const publicData = await read("app/server/public-data.ts");
  assert.match(publicData, /status='published'.*visibility='public'.*deleted_at IS NULL/);
  assert.match(publicData, /c\.is_demo=0/);
  assert.match(publicData, /e\.ends_at.*e\.starts_at.*bucharestDate/s);
  assert.match(publicData, /date\(o\.ends_at\).*date\(j\.deadline\)/s);
  assert.doesNotMatch(publicData, /pending_review'\s+AND\s+c\.visibility='public/);
  const submissions = await read("app/api/submissions/route.ts");
  assert.match(submissions, /validateTypePayload/);
  assert.match(submissions, /payload.*pending_review/s);
  assert.match(submissions, /targetContentId.*status='published'.*visibility='public'/s);
});
