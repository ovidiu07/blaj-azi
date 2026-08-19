import { randomBytes, randomUUID, scrypt } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { execFileSync } from "node:child_process";

const derive = promisify(scrypt);
const args = process.argv.slice(2);
const localIndex = args.indexOf("--local-file");
const remoteIndex = args.indexOf("--remote");
const localFile = localIndex >= 0 ? args[localIndex + 1] : "";
const remoteName = remoteIndex >= 0 ? args[remoteIndex + 1] : "";
const email = String(process.env.ADMIN_EMAIL || "").trim().toLocaleLowerCase("ro-RO");
const password = String(process.env.ADMIN_PASSWORD || "");

if ((!localFile && !remoteName) || (localFile && remoteName)) fail("Alege exact o țintă: --local-file <cale.sqlite> sau --remote <nume-bază-D1>.");
if (!/^\S+@\S+\.\S+$/.test(email) || email === "owner@example.com") fail("Configurează ADMIN_EMAIL cu adresa reală a operatorului.");
if (password.length < 12 || password.length > 128) fail("Configurează ADMIN_PASSWORD cu o parolă de 12–128 de caractere.");

const query = "SELECT COUNT(*) owner_count,(SELECT id FROM users WHERE normalized_email=" + quote(email) + " LIMIT 1) target_id,(SELECT global_role FROM users WHERE normalized_email=" + quote(email) + " LIMIT 1) target_role FROM users WHERE global_role='platform_owner' AND account_status='active'";
const state = readState(query);
if (Number(state.owner_count) > 0 && state.target_role !== "platform_owner") fail("Există deja un proprietar activ. Conectează-te cu acel cont și acordă rolul din administrare.");

const salt = randomBytes(16);
const cost = 16_384;
const hash = await derive(password, salt, 32, { N: cost, r: 8, p: 1, maxmem: 32 * 1024 * 1024 });
const subject = randomUUID();
const externalId = `password:${subject}`;
const statements = [];
if (!state.target_id) {
  statements.push(`INSERT INTO users (external_user_id,email,normalized_email,display_name,global_role,account_status,terms_accepted_at,privacy_accepted_at) VALUES (${quote(externalId)},${quote(email)},${quote(email)},'Administrator Blaj Azi','platform_owner','active',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`);
} else if (state.target_role !== "platform_owner") {
  statements.push(`UPDATE users SET global_role='platform_owner',updated_at=CURRENT_TIMESTAMP WHERE id=${Number(state.target_id)}`);
  statements.push(`INSERT INTO role_history (user_id,previous_role,new_role,changed_by,reason) VALUES (${Number(state.target_id)},${quote(String(state.target_role))},'platform_owner',${Number(state.target_id)},'Provisioning controlat al primului proprietar')`);
}
statements.push(`INSERT INTO auth_identities (user_id,provider,provider_subject,provider_email,email_verified) SELECT id,'password',${quote(subject)},${quote(email)},0 FROM users WHERE normalized_email=${quote(email)} ON CONFLICT(provider,provider_subject) DO NOTHING`);
statements.push(`INSERT INTO password_credentials (user_id,hash_version,password_hash,salt,iterations,updated_at) SELECT id,'scrypt-v1',${quote(base64url(hash))},${quote(base64url(salt))},${cost},CURRENT_TIMESTAMP FROM users WHERE normalized_email=${quote(email)} ON CONFLICT(user_id) DO UPDATE SET hash_version=excluded.hash_version,password_hash=excluded.password_hash,salt=excluded.salt,iterations=excluded.iterations,updated_at=CURRENT_TIMESTAMP`);
statements.push(`INSERT INTO audit_logs (actor_user_id,action,entity_type,entity_id,metadata) SELECT id,'admin.credential_provisioned','user',CAST(id AS TEXT),'${JSON.stringify({ source: "operator_cli" }).replaceAll("'", "''")}' FROM users WHERE normalized_email=${quote(email)}`);
await executeSql(`${statements.join(";\n")};`);
process.stdout.write(`Credentialele administrative au fost provisionate pentru ${email}. Parola nu a fost salvată în clar.\n`);

function readState(sql) {
  if (localFile) {
    const output = execFileSync("sqlite3", ["-json", localFile, sql], { encoding: "utf8" });
    return JSON.parse(output || "[]")[0] || {};
  }
  const output = execFileSync("npx", ["wrangler", "d1", "execute", remoteName, "--remote", "--command", sql, "--json"], { encoding: "utf8" });
  const parsed = JSON.parse(output);
  return parsed?.[0]?.results?.[0] || parsed?.result?.[0]?.results?.[0] || {};
}

function executeSql(sql) {
  if (localFile) {
    execFileSync("sqlite3", [localFile], { input: sql, stdio: ["pipe", "inherit", "inherit"] });
    return;
  }
  const directoryPromise = mkdtemp(join(tmpdir(), "blaj-admin-"));
  return directoryPromise.then(async directory => {
    const file = join(directory, "provision.sql");
    try {
      await writeFile(file, sql, { mode: 0o600 });
      execFileSync("npx", ["wrangler", "d1", "execute", remoteName, "--remote", "--file", file], { stdio: "inherit" });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
}

function quote(value) { return `'${String(value).replaceAll("'", "''")}'`; }
function base64url(value) { return Buffer.from(value).toString("base64url"); }
function fail(message) { process.stderr.write(`${message}\n`); process.exit(1); }
