import { env } from "cloudflare:workers";

const statements = [
  `CREATE TABLE IF NOT EXISTS submissions (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, contributor_name TEXT, email TEXT NOT NULL, title TEXT, locality TEXT, category TEXT, description TEXT, source_url TEXT, media_key TEXT, rights_confirmed INTEGER NOT NULL DEFAULT 0, consent INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending_review', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE INDEX IF NOT EXISTS idx_submissions_status_created ON submissions(status, created_at)`,
  `CREATE TABLE IF NOT EXISTS newsletter_subscriptions (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, interests TEXT, consent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, status TEXT NOT NULL DEFAULT 'pending_confirmation')`,
  `CREATE TABLE IF NOT EXISTS content_items (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, title TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'draft', promoted_tier TEXT, expires_at TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE INDEX IF NOT EXISTS idx_content_items_type_status ON content_items(type, status)`,
];

export async function ensureRuntimeSchema() {
  const db = env.DB;
  await db.batch(statements.map(sql => db.prepare(sql)));
  await db.prepare(`INSERT OR IGNORE INTO content_items (type,title,slug,status) VALUES ('business','Atelierul de Acasă','atelierul-de-acasa','demo'),('event','Atelierul micilor exploratori','atelier-micilor-exploratori','demo'),('offer','Revizie de bază pentru bicicletă','revizie-bicicleta','demo'),('job','Operator producție','operator-productie','demo')`).run();
  return db;
}
