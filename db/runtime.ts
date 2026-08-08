import { env } from "cloudflare:workers";

/**
 * Migrations are the only schema authority. This helper deliberately performs
 * no CREATE or seed work at request time.
 */
export function getRuntimeDb(): D1Database {
  if (!env.DB) throw new Error("D1 binding DB indisponibil");
  return env.DB;
}

export async function verifyMigratedSchema(): Promise<D1Database> {
  const db = getRuntimeDb();
  await db.prepare("SELECT id FROM content_records LIMIT 1").first();
  return db;
}
