import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = path => readFile(new URL(path, root), "utf8");

test("phase-two migration applies after the original schema and seeds public content once", async () => {
  const directory = await mkdtemp(join(tmpdir(), "blaj-azi-migration-"));
  const database = join(directory, "test.sqlite");
  try {
    execFileSync("sqlite3", [database], { input: await read("drizzle/0000_bumpy_vanisher.sql") });
    execFileSync("sqlite3", [database], { input: await read("drizzle/0001_lame_elektra.sql") });
    execFileSync("sqlite3", [database], { input: await read("drizzle/0002_great_mastermind.sql") });
    execFileSync("sqlite3", [database], { input: await read("drizzle/0003_steep_tomorrow_man.sql") });
    execFileSync("sqlite3", [database], { input: await read("drizzle/0004_curved_meggan.sql") });
    const result = execFileSync("sqlite3", [database, "SELECT COUNT(*) FROM content_records WHERE status='published' AND visibility='public' AND deleted_at IS NULL; SELECT COUNT(*) FROM pragma_table_info('media_assets') WHERE name IN ('business_id','content_id'); SELECT COUNT(*) FROM sqlite_schema WHERE type='table' AND name IN ('auth_identities','password_credentials','auth_sessions','auth_attempts'); PRAGMA integrity_check;"], { encoding: "utf8" }).trim().split("\n");
    assert.equal(Number(result[0]), 20);
    assert.equal(Number(result[1]), 2);
    assert.equal(Number(result[2]), 4);
    assert.equal(result[3], "ok");
  } finally {
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
  assert.doesNotMatch(publicData, /pending_review'\s+AND\s+c\.visibility='public/);
});
