import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFile } from "node:fs/promises";
import test from "node:test";

const auth = await import("../app/server/auth.ts");

async function database() {
  const sqlite = new DatabaseSync(":memory:");
  for (const migration of ["0000_bumpy_vanisher", "0001_lame_elektra", "0002_great_mastermind", "0003_steep_tomorrow_man", "0004_curved_meggan"]) {
    const sql = await awaitText(`../drizzle/${migration}.sql`);
    for (const statement of sql.split("--> statement-breakpoint").map(value => value.trim()).filter(Boolean)) sqlite.exec(statement);
  }
  return new D1(sqlite);
}

function request(cookie = "") {
  return new Request("http://localhost/api/auth/login", { headers: { origin: "http://localhost", "sec-fetch-site": "same-origin", "user-agent": "Blaj Azi test", ...(cookie ? { cookie } : {}) } });
}

const ordinaryInput = {
  name: "Utilizator Test",
  email: "  TEST.User@Example.COM ",
  password: "Parola-locala-foarte-buna-2026",
  passwordConfirmation: "Parola-locala-foarte-buna-2026",
  acceptTerms: true,
  acceptPrivacy: true,
  role: "platform_owner",
  admin: true,
  ownerUserId: 999,
};

test("registration creates only an ordinary user, normalizes email, and never stores plaintext", async () => {
  const db = await database();
  const result = await auth.registerCredentialUser(ordinaryInput, request(), db);
  assert.equal(result.account.global_role, "user");
  assert.equal(result.account.normalized_email, "test.user@example.com");
  const credential = await db.prepare("SELECT * FROM password_credentials WHERE user_id=?").bind(result.account.id).first();
  assert.equal(credential.hash_version, "pbkdf2-sha256-v1");
  assert.equal(credential.iterations, 600000);
  assert.notEqual(credential.password_hash, ordinaryInput.password);
  assert.equal(await auth.verifyPassword(ordinaryInput.password, credential), true);
  const identity = await db.prepare("SELECT * FROM auth_identities WHERE user_id=?").bind(result.account.id).first();
  assert.equal(identity.provider, "password");
  assert.equal(identity.email_verified, 0);
});

test("duplicate normalized email is rejected without changing the original user", async () => {
  const db = await database();
  await auth.registerCredentialUser(ordinaryInput, request(), db);
  await assert.rejects(() => auth.registerCredentialUser({ ...ordinaryInput, email: "test.user@example.com" }, request(), db), error => error.code === "registration_unavailable");
  assert.equal((await db.prepare("SELECT COUNT(*) count FROM users").first()).count, 1);
});

test("valid login creates a hashed persistent session and invalid login creates none", async () => {
  const db = await database();
  const registered = await auth.registerCredentialUser(ordinaryInput, request(), db);
  await auth.revokeSessionToken(registered.session.token, db);
  const before = (await db.prepare("SELECT COUNT(*) count FROM auth_sessions").first()).count;
  await assert.rejects(() => auth.authenticateCredentialUser({ email: ordinaryInput.email, password: "parola-gresita" }, request(), db), error => error.code === "invalid_credentials");
  assert.equal((await db.prepare("SELECT COUNT(*) count FROM auth_sessions").first()).count, before);
  const loggedIn = await auth.authenticateCredentialUser({ email: ordinaryInput.email, password: ordinaryInput.password, remember: true }, request(), db);
  const stored = await db.prepare("SELECT * FROM auth_sessions WHERE user_id=? AND revoked_at IS NULL").bind(loggedIn.account.id).first();
  assert.notEqual(stored.token_hash, loggedIn.session.token);
  assert.equal(stored.remember, 1);
  assert.equal((await auth.resolveSessionToken(loggedIn.session.token, db)).id, loggedIn.account.id);
});

test("revoked and expired sessions are rejected, while refresh-style resolution survives", async () => {
  const db = await database();
  const registered = await auth.registerCredentialUser(ordinaryInput, request(), db);
  assert.equal((await auth.resolveSessionToken(registered.session.token, db)).email, ordinaryInput.email.trim());
  assert.equal((await auth.resolveSessionToken(registered.session.token, db)).email, ordinaryInput.email.trim());
  await auth.revokeSessionToken(registered.session.token, db);
  assert.equal(await auth.resolveSessionToken(registered.session.token, db), null);
  const loggedIn = await auth.authenticateCredentialUser({ email: ordinaryInput.email, password: ordinaryInput.password }, request(), db);
  await db.prepare("UPDATE auth_sessions SET expires_at=datetime('now','-1 minute') WHERE token_hash=?").bind(await auth.sha256(loggedIn.session.token)).run();
  assert.equal(await auth.resolveSessionToken(loggedIn.session.token, db), null);
  assert.match(auth.clearedSessionCookieHeaders().join("\n"), /Max-Age=0/);
});

test("admin entry uses the same credentials but rejects an ordinary role", async () => {
  const db = await database();
  const registered = await auth.registerCredentialUser(ordinaryInput, request(), db);
  await assert.rejects(() => auth.authenticateCredentialUser({ email: ordinaryInput.email, password: ordinaryInput.password, admin: true }, request(), db), error => error.code === "invalid_credentials");
  await db.prepare("UPDATE users SET global_role='admin' WHERE id=?").bind(registered.account.id).run();
  const admin = await auth.authenticateCredentialUser({ email: ordinaryInput.email, password: ordinaryInput.password, admin: true }, request(), db);
  assert.equal(admin.account.global_role, "admin");
});

test("return paths and cookie policy reject open redirects and expose no identity", async () => {
  assert.equal(auth.safeReturnPath("https://evil.example/steal", "/cont"), "/cont");
  assert.equal(auth.safeReturnPath("//evil.example/steal", "/cont"), "/cont");
  assert.equal(auth.safeReturnPath("/conectare", "/cont"), "/cont");
  assert.equal(auth.safeReturnPath("/cont/continut?q=nou", "/"), "/cont/continut?q=nou");
  const db = await database();
  const registered = await auth.registerCredentialUser(ordinaryInput, request(), db);
  const cookie = auth.sessionCookieHeader(new Request("https://blaj-azi.example/"), registered.session);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /; Secure/);
  assert.doesNotMatch(cookie, /test\.user|platform_owner/i);
});

async function awaitText(path) { return readFile(new URL(path, import.meta.url), "utf8"); }

class D1 {
  constructor(sqlite) { this.sqlite = sqlite; }
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
  constructor(sqlite, sql) { this.sqlite = sqlite; this.sql = sql; this.values = []; }
  bind(...values) { this.values = values; return this; }
  async first() { return this.sqlite.prepare(this.sql).get(...this.values) || null; }
  async all() { return { results: this.sqlite.prepare(this.sql).all(...this.values) }; }
  async run() { return this.execute(); }
  execute() {
    const result = this.sqlite.prepare(this.sql).run(...this.values);
    return { success: true, meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } };
  }
}
