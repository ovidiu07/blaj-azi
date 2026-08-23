import { getRuntimeDb } from "../../db/runtime";
import {
  defaultSiteContent,
  mergeWithSiteDefaults,
  referencedMediaIds,
  siteContentByKey,
  siteContentDefinitions,
  validateSiteContent,
} from "../site-content";
import { isAdmin, type LocalAccount, PlatformError } from "./platform";
import { validateTheme } from "../theme";

export type SiteContentEntryRow = {
  key: string;
  scope: string;
  route: string;
  label: string;
  schema_version: number;
  draft_json: string;
  published_json: string;
  version: number;
  updated_by: number | null;
  updated_at: string;
  published_by: number | null;
  published_at: string | null;
  updated_by_name?: string | null;
  published_by_name?: string | null;
};

export type AdminSiteContentEntry = {
  key: string;
  scope: string;
  route: string;
  label: string;
  group: string;
  schemaVersion: number;
  draft: Record<string, unknown>;
  published: Record<string, unknown>;
  version: number;
  hasDraftChanges: boolean;
  updatedAt: string | null;
  updatedByName: string | null;
  publishedAt: string | null;
  publishedByName: string | null;
  fields: (typeof siteContentDefinitions)[number]["fields"];
};

export async function loadPublishedSiteContent(key: string, db?: D1Database): Promise<Record<string, unknown>> {
  const defaults = defaultSiteContent(key);
  try {
    const runtimeDb = db ?? getRuntimeDb();
    const row = await runtimeDb.prepare("SELECT published_json,schema_version FROM site_content_entries WHERE key=? LIMIT 1").bind(key).first<{ published_json: string; schema_version: number }>();
    if (!row) return defaults;
    const definition = siteContentByKey.get(key);
    if (!definition || row.schema_version > definition.schemaVersion) throw new Error("schema_version_mismatch");
    return mergeWithSiteDefaults(key, JSON.parse(row.published_json));
  } catch (error) {
    console.error("site_content_fallback", JSON.stringify({ key, reason: error instanceof Error ? error.message : "unknown" }));
    return defaults;
  }
}

export async function loadPublishedSiteContentSet(keys: readonly string[], db?: D1Database): Promise<Record<string, Record<string, unknown>>> {
  const entries = await Promise.all(keys.map(async key => [key, await loadPublishedSiteContent(key, db)] as const));
  return Object.fromEntries(entries);
}

export async function listAdminSiteContent(account: LocalAccount, db: D1Database = getRuntimeDb()): Promise<AdminSiteContentEntry[]> {
  requireCmsAdmin(account);
  const rows = await db.prepare("SELECT e.*,uu.display_name updated_by_name,up.display_name published_by_name FROM site_content_entries e LEFT JOIN users uu ON uu.id=e.updated_by LEFT JOIN users up ON up.id=e.published_by ORDER BY e.scope,e.key").all<SiteContentEntryRow>();
  const byKey = new Map(rows.results.map(row => [row.key, row]));
  return siteContentDefinitions.map(definition => mapAdminEntry(definition.key, byKey.get(definition.key)));
}

export async function loadAdminSiteContent(account: LocalAccount, key: string, db: D1Database = getRuntimeDb()): Promise<AdminSiteContentEntry> {
  requireCmsAdmin(account);
  if (!siteContentByKey.has(key)) throw new PlatformError(404, "Pagina CMS nu există.", "cms_entry_missing");
  const row = await db.prepare("SELECT e.*,uu.display_name updated_by_name,up.display_name published_by_name FROM site_content_entries e LEFT JOIN users uu ON uu.id=e.updated_by LEFT JOIN users up ON up.id=e.published_by WHERE e.key=? LIMIT 1").bind(key).first<SiteContentEntryRow>();
  return mapAdminEntry(key, row || undefined);
}

export async function listSiteContentRevisions(account: LocalAccount, key: string, db: D1Database = getRuntimeDb()) {
  requireCmsAdmin(account);
  if (!siteContentByKey.has(key)) throw new PlatformError(404, "Pagina CMS nu există.");
  return db.prepare("SELECT r.id,r.entry_key,r.revision_number,r.snapshot,r.action,r.actor_user_id,r.created_at,u.display_name actor_name FROM site_content_revisions r LEFT JOIN users u ON u.id=r.actor_user_id WHERE r.entry_key=? ORDER BY r.revision_number DESC LIMIT 100").bind(key).all<{ id: number; entry_key: string; revision_number: number; snapshot: string; action: string; actor_user_id: number; created_at: string; actor_name: string | null }>();
}

export async function saveSiteContentDraft(account: LocalAccount, key: string, raw: unknown, expectedVersion: number, db: D1Database = getRuntimeDb()) {
  requireCmsAdmin(account);
  const definition = requireDefinition(key);
  const content = validateSiteContent(key, raw);
  await assertMediaReferences(content, false, db);
  const row = await db.prepare("SELECT version,published_json FROM site_content_entries WHERE key=? LIMIT 1").bind(key).first<{ version: number; published_json: string }>();
  if (!row) throw new PlatformError(409, "Migrarea CMS nu este aplicată. Aplică migrarea locală înainte de editare.", "cms_migration_required");
  if (row.version !== expectedVersion) throw staleVersion();
  const revision = await nextRevision(key, db);
  const snapshot = JSON.stringify(content);
  const capturesInitialPublished = revision === 1;
  const updatedRevision = capturesInitialPublished ? 2 : revision;
  const statements = [
    db.prepare("UPDATE site_content_entries SET draft_json=?,schema_version=?,updated_by=?,updated_at=CURRENT_TIMESTAMP,version=version+1 WHERE key=? AND version=?").bind(snapshot, definition.schemaVersion, account.id, key, expectedVersion),
    ...(capturesInitialPublished ? [guardedRevisionInsert(db, key, 1, row.published_json, "created", account.id, expectedVersion + 1)] : []),
    guardedRevisionInsert(db, key, updatedRevision, snapshot, "updated", account.id, expectedVersion + 1),
    db.prepare("INSERT INTO audit_logs (actor_user_id,action,entity_type,entity_id,metadata) SELECT ?,'site_content.draft_updated','site_content',?,? WHERE EXISTS (SELECT 1 FROM site_content_entries WHERE key=? AND version=?)").bind(account.id, key, JSON.stringify({ fromVersion: expectedVersion, toVersion: expectedVersion + 1 }), key, expectedVersion + 1),
  ];
  const results = await db.batch(statements);
  if (!results[0]?.meta?.changes) throw staleVersion();
  return { key, version: expectedVersion + 1, draft: content };
}

export async function siteContentAction(account: LocalAccount, key: string, action: string, expectedVersion: number, revisionId?: number, db: D1Database = getRuntimeDb()) {
  requireCmsAdmin(account);
  requireDefinition(key);
  const row = await db.prepare("SELECT * FROM site_content_entries WHERE key=? LIMIT 1").bind(key).first<SiteContentEntryRow>();
  if (!row) throw new PlatformError(409, "Migrarea CMS nu este aplicată.", "cms_migration_required");
  if (row.version !== expectedVersion) throw staleVersion();
  const next = await nextRevision(key, db);

  if (action === "publish") {
    const draft = mergeWithSiteDefaults(key, JSON.parse(row.draft_json));
    if (key === "theme.site") validateTheme(draft);
    await assertMediaReferences(draft, true, db);
    const snapshot = JSON.stringify(draft);
    const results = await db.batch([
      db.prepare("UPDATE site_content_entries SET published_json=?,draft_json=?,published_by=?,published_at=CURRENT_TIMESTAMP,updated_by=?,updated_at=CURRENT_TIMESTAMP,version=version+1 WHERE key=? AND version=?").bind(snapshot, snapshot, account.id, account.id, key, expectedVersion),
      guardedRevisionInsert(db, key, next, snapshot, "published", account.id, expectedVersion + 1),
      guardedAuditInsert(db, account.id, "site_content.published", key, { fromVersion: expectedVersion, toVersion: expectedVersion + 1 }, expectedVersion + 1),
    ]);
    if (!results[0]?.meta?.changes) throw staleVersion();
    return { key, version: expectedVersion + 1, published: true };
  }

  if (action === "discard") {
    const published = mergeWithSiteDefaults(key, JSON.parse(row.published_json));
    const results = await db.batch([
      db.prepare("UPDATE site_content_entries SET draft_json=published_json,updated_by=?,updated_at=CURRENT_TIMESTAMP,version=version+1 WHERE key=? AND version=?").bind(account.id, key, expectedVersion),
      guardedAuditInsert(db, account.id, "site_content.draft_discarded", key, { fromVersion: expectedVersion, toVersion: expectedVersion + 1 }, expectedVersion + 1),
    ]);
    if (!results[0]?.meta?.changes) throw staleVersion();
    return { key, version: expectedVersion + 1, draft: published };
  }

  if (action === "restore") {
    if (!Number.isInteger(revisionId) || Number(revisionId) <= 0) throw new PlatformError(400, "Alege o revizie validă.");
    const revision = await db.prepare("SELECT snapshot FROM site_content_revisions WHERE id=? AND entry_key=? LIMIT 1").bind(revisionId, key).first<{ snapshot: string }>();
    if (!revision) throw new PlatformError(404, "Revizia nu există.");
    const restored = mergeWithSiteDefaults(key, JSON.parse(revision.snapshot));
    if (key === "theme.site") validateTheme(restored);
    await assertMediaReferences(restored, true, db);
    const snapshot = JSON.stringify(restored);
    const results = await db.batch([
      db.prepare("UPDATE site_content_entries SET draft_json=?,published_json=?,updated_by=?,published_by=?,updated_at=CURRENT_TIMESTAMP,published_at=CURRENT_TIMESTAMP,version=version+1 WHERE key=? AND version=?").bind(snapshot, snapshot, account.id, account.id, key, expectedVersion),
      guardedRevisionInsert(db, key, next, snapshot, "restored", account.id, expectedVersion + 1),
      guardedAuditInsert(db, account.id, "site_content.restored", key, { revisionId, fromVersion: expectedVersion, toVersion: expectedVersion + 1 }, expectedVersion + 1),
    ]);
    if (!results[0]?.meta?.changes) throw staleVersion();
    return { key, version: expectedVersion + 1, restored: true };
  }

  throw new PlatformError(400, "Acțiune CMS neacceptată.");
}

function mapAdminEntry(key: string, row?: SiteContentEntryRow): AdminSiteContentEntry {
  const definition = requireDefinition(key);
  const published = row ? parseAndMerge(key, row.published_json) : defaultSiteContent(key);
  const draft = row ? parseAndMerge(key, row.draft_json) : published;
  return {
    key, scope: definition.scope, route: definition.route, label: definition.label, group: definition.group, schemaVersion: definition.schemaVersion,
    draft, published, version: row?.version ?? 0, hasDraftChanges: JSON.stringify(draft) !== JSON.stringify(published),
    updatedAt: row?.updated_at ?? null, updatedByName: row?.updated_by_name ?? null, publishedAt: row?.published_at ?? null, publishedByName: row?.published_by_name ?? null,
    fields: definition.fields,
  };
}

function parseAndMerge(key: string, value: string): Record<string, unknown> {
  try { return mergeWithSiteDefaults(key, JSON.parse(value)); }
  catch { return defaultSiteContent(key); }
}

function requireDefinition(key: string) {
  const definition = siteContentByKey.get(key);
  if (!definition) throw new PlatformError(404, "Pagina CMS nu există.", "cms_entry_missing");
  return definition;
}

function requireCmsAdmin(account: LocalAccount) {
  if (!isAdmin(account)) throw new PlatformError(403, "Doar administratorii pot gestiona paginile site-ului.", "forbidden");
}

function staleVersion() {
  return new PlatformError(409, "Conținutul a fost modificat între timp. Reîncarcă pagina înainte de a continua.", "stale_version");
}

async function nextRevision(key: string, db: D1Database): Promise<number> {
  const row = await db.prepare("SELECT COALESCE(MAX(revision_number),0)+1 next FROM site_content_revisions WHERE entry_key=?").bind(key).first<{ next: number }>();
  return row?.next ?? 1;
}

function guardedRevisionInsert(db: D1Database, key: string, revision: number, snapshot: string, action: string, actorId: number, committedVersion: number) {
  return db.prepare("INSERT INTO site_content_revisions (entry_key,revision_number,snapshot,action,actor_user_id) SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM site_content_entries WHERE key=? AND version=?)")
    .bind(key, revision, snapshot, action, actorId, key, committedVersion);
}

function guardedAuditInsert(db: D1Database, actorId: number, action: string, key: string, metadata: unknown, committedVersion: number) {
  return db.prepare("INSERT INTO audit_logs (actor_user_id,action,entity_type,entity_id,metadata) SELECT ?,?,'site_content',?,? WHERE EXISTS (SELECT 1 FROM site_content_entries WHERE key=? AND version=?)")
    .bind(actorId, action, key, JSON.stringify(metadata), key, committedVersion);
}

async function assertMediaReferences(content: Record<string, unknown>, publishing: boolean, db: D1Database) {
  for (const id of referencedMediaIds(content)) {
    const row = await db.prepare("SELECT id,approval_status,media_status FROM media_assets WHERE id=? LIMIT 1").bind(id).first<{ id: number; approval_status: string; media_status: string }>();
    if (!row || row.media_status !== "active") throw new PlatformError(400, `Imaginea #${id} nu mai este disponibilă.`, "invalid_media_reference");
    if (publishing && row.approval_status !== "approved") throw new PlatformError(400, `Imaginea #${id} trebuie aprobată înainte de publicare.`, "media_not_approved");
  }
}
