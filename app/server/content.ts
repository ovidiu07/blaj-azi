/* eslint-disable @typescript-eslint/no-explicit-any -- type-specific D1 rows are narrowed by the content type */
import {
  canManageEntity,
  cleanText,
  enforceRateLimit,
  isAdmin,
  LocalAccount,
  notify,
  PlatformError,
  requireBusinessMembership,
  safeSlug,
} from "./platform";
import { getRuntimeDb } from "../../db/runtime";
import { safeExternalHref } from "../site-content";

export const contentTypes = [
  "business",
  "community_post",
  "local_story",
  "article",
  "business_update",
  "event",
  "offer",
  "job",
  "restaurant",
  "daily_menu",
  "place",
] as const;
export type ContentType = (typeof contentTypes)[number];

const userTypes = new Set<ContentType>(["business", "community_post", "local_story", "event", "place"]);
const businessTypes = new Set<ContentType>(["business_update", "offer", "event", "job", "restaurant", "daily_menu"]);
const postTypes = new Set<ContentType>(["community_post", "local_story", "article", "business_update"]);

export type ContentInput = {
  type: ContentType;
  title: string;
  slug?: string;
  excerpt?: string;
  body?: string;
  locality?: string;
  categoryId?: number | null;
  businessId?: number | null;
  sourceUrl?: string;
  seoTitle?: string;
  seoDescription?: string;
  details?: Record<string, unknown>;
};

type ContentRow = {
  id: number;
  type: ContentType;
  entity_id: number | null;
  title: string;
  slug: string;
  excerpt: string | null;
  owner_user_id: number | null;
  business_id: number | null;
  status: string;
  moderation_state: string;
  featured: number;
  version: number;
  published_snapshot: string | null;
  deleted_at: string | null;
};

function randomId(): number {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return 100_000_000 + (values[0] % 1_900_000_000);
}

function numberOrNull(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

async function uniqueSlug(requested: string, title: string, excludeId?: number): Promise<string> {
  const base = safeSlug(requested || title);
  const existing = await getRuntimeDb().prepare("SELECT id FROM content_records WHERE slug=? AND (? IS NULL OR id!=?) LIMIT 1").bind(base, excludeId ?? null, excludeId ?? null).first();
  return existing ? `${base}-${crypto.randomUUID().slice(0, 6)}` : base;
}

function externalOrNull(value: unknown, label: string): string | null {
  const cleaned = cleanText(value, 800);
  if (!cleaned) return null;
  const safe = safeExternalHref(cleaned);
  if (!safe) throw new PlatformError(400, `${label} trebuie să fie un URL HTTP sau HTTPS valid.`);
  return safe;
}

async function assertCreationScope(account: LocalAccount, type: ContentType, businessId: number | null): Promise<void> {
  if (isAdmin(account)) return;
  if (businessId) {
    await requireBusinessMembership(account, businessId);
    if (!businessTypes.has(type) && type !== "community_post" && type !== "local_story") {
      throw new PlatformError(403, "Acest tip de conținut nu poate fi legat de afacere.");
    }
    return;
  }
  if (!userTypes.has(type)) throw new PlatformError(403, "Ai nevoie de o afacere administrată pentru acest tip de conținut.");
}

function typeInsert(db: D1Database, input: ContentInput, entityId: number, contentId: number, slug: string, account: LocalAccount) {
  const details = input.details ?? {};
  const title = cleanText(input.title, 240, true);
  const locality = cleanText(input.locality || details.locality || "Blaj", 120, true);
  const body = cleanText(input.body || details.description, 30_000, postTypes.has(input.type));
  const businessId = numberOrNull(input.businessId);
  const categoryId = numberOrNull(input.categoryId);
  const sourceUrl = externalOrNull(input.sourceUrl, "Sursa");

  if (postTypes.has(input.type)) {
    return db.prepare("INSERT INTO posts (id,content_item_id,post_type,author_user_id,business_id,body,category_id,locality,source_information,seo_title,seo_description) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
      .bind(entityId, contentId, input.type, account.id, businessId, body, categoryId, locality, sourceUrl || null, cleanText(input.seoTitle, 180) || null, cleanText(input.seoDescription, 300) || null);
  }
  if (input.type === "business") {
    return db.prepare("INSERT INTO businesses (id,name,slug,category_id,locality,address,phone,website,contact_email,whatsapp,social_links,description,creator_user_id,moderation_status,verification_status,visibility,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'draft','unverified','private','draft')")
      .bind(entityId, title, slug, categoryId, locality, cleanText(details.address, 300) || null, cleanText(details.phone, 60) || null, externalOrNull(details.website, "Website-ul"), cleanText(details.contactEmail,254)||null, cleanText(details.whatsapp,60)||null, cleanText(details.socialLinks,2000)||null, cleanText(input.excerpt || details.description, 6000) || null, account.id);
  }
  if (input.type === "event") {
    const startsAt = cleanText(details.startsAt, 40, true);
    return db.prepare("INSERT INTO events (id,title,slug,category_id,organizer,locality,venue,starts_at,ends_at,ticket_info,description,family_friendly,accessibility,address,image_url,status,source_url) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .bind(entityId, title, slug, categoryId, cleanText(details.organizer, 240) || null, locality, cleanText(details.venue, 240) || null, startsAt, cleanText(details.endsAt, 40) || null, cleanText(details.ticketInfo, 500) || null, cleanText(input.excerpt || details.description, 6000) || null, details.familyFriendly ? 1 : 0, cleanText(details.accessibility, 500) || null, cleanText(details.address, 300) || null, externalOrNull(details.imageUrl, "Imaginea externă"), "draft", sourceUrl);
  }
  if (input.type === "offer") {
    if (!businessId) throw new PlatformError(400, "Selectează afacerea ofertei.");
    return db.prepare("INSERT INTO offers (id,business_id,title,slug,starts_at,ends_at,price,old_price,terms,description,availability,image_url,status,source_url) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .bind(entityId, businessId, title, slug, cleanText(details.startsAt, 40, true), cleanText(details.endsAt, 40, true), numberOrNull(details.price), numberOrNull(details.oldPrice), cleanText(details.terms, 3000) || null, cleanText(input.excerpt || details.description, 6000) || null, cleanText(details.availability, 120) || "active", externalOrNull(details.imageUrl, "Imaginea externă"), "draft", sourceUrl);
  }
  if (input.type === "job") {
    if (!businessId) throw new PlatformError(400, "Selectează afacerea jobului.");
    return db.prepare("INSERT INTO jobs (id,business_id,title,slug,company,locality,contract_type,work_arrangement,schedule,shift,salary_min,salary_max,transport_provided,responsibilities,requirements,benefits,apply_url,application_method,deadline,status,source_url) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .bind(entityId, businessId, title, slug, cleanText(details.company, 240, true), locality, cleanText(details.contractType, 120) || null, cleanText(details.workArrangement, 120) || null, cleanText(details.schedule, 300) || null, cleanText(details.shift, 120) || null, numberOrNull(details.salaryMin), numberOrNull(details.salaryMax), details.transport ? 1 : 0, cleanText(details.responsibilities, 8000) || null, cleanText(details.requirements, 8000) || null, cleanText(details.benefits, 8000) || null, externalOrNull(details.applyUrl, "Linkul de aplicare"), cleanText(details.applicationMethod, 1000) || null, cleanText(details.deadline, 40) || null, "draft", sourceUrl);
  }
  if (input.type === "restaurant") {
    if (!businessId) throw new PlatformError(400, "Selectează afacerea restaurantului.");
    return db.prepare("INSERT INTO restaurants (id,business_id,name,slug,cuisine,delivery,pickup,dietary_options,description,image_url,status,source_url) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
      .bind(entityId, businessId, title, slug, cleanText(details.cuisine, 200) || null, details.delivery ? 1 : 0, details.pickup ? 1 : 0, cleanText(details.dietaryOptions, 600) || null, cleanText(input.excerpt || details.description, 6000) || null, externalOrNull(details.imageUrl, "Imaginea externă"), "draft", sourceUrl);
  }
  if (input.type === "daily_menu") {
    if (!businessId) throw new PlatformError(400, "Selectează restaurantul.");
    const restaurant = numberOrNull(details.restaurantId);
    if (!restaurant) throw new PlatformError(400, "Selectează restaurantul.");
    return db.prepare("INSERT INTO daily_menus (id,restaurant_id,menu_date,soup,main_dish,side_dish,dessert,price,order_deadline,availability,owner_user_id,status) VALUES (?,?,?,?,?,?,?,?,?,? ,?,'draft')")
      .bind(entityId, restaurant, cleanText(details.menuDate, 40, true), cleanText(details.soup, 500) || null, cleanText(details.mainDish, 500) || null, cleanText(details.sideDish, 500) || null, cleanText(details.dessert, 500) || null, numberOrNull(details.price), cleanText(details.orderDeadline, 80) || null, cleanText(details.availability, 100) || "active", account.id);
  }
  if (input.type === "place") {
    return db.prepare("INSERT INTO places (id,title,slug,address,description,accessibility,locality,image_url,status,source_url) VALUES (?,?,?,?,?,?,?,?,?,?)")
      .bind(entityId, title, slug, cleanText(details.address, 300) || null, cleanText(input.excerpt || details.description, 6000) || null, cleanText(details.accessibility, 500) || null, locality, externalOrNull(details.imageUrl, "Imaginea externă"), "draft", sourceUrl);
  }
  throw new PlatformError(400, "Tip de conținut neacceptat.");
}

function typeUpdate(db:D1Database,input:ContentInput,entityId:number,title:string,account:LocalAccount){
  const details=input.details??{};const locality=cleanText(input.locality||details.locality||"Blaj",120,true);const businessId=numberOrNull(input.businessId);const categoryId=numberOrNull(input.categoryId);const sourceUrl=externalOrNull(input.sourceUrl,"Sursa");const excerpt=cleanText(input.excerpt,6000);
  if(postTypes.has(input.type))return db.prepare("UPDATE posts SET body=?,business_id=?,category_id=?,locality=?,source_information=?,seo_title=?,seo_description=? WHERE id=?").bind(cleanText(input.body,30000,true),businessId,categoryId,locality,sourceUrl||null,cleanText(input.seoTitle,180)||null,cleanText(input.seoDescription,300)||null,entityId);
  if(input.type==="business")return db.prepare("UPDATE businesses SET name=?,category_id=?,locality=?,address=?,phone=?,website=?,contact_email=?,whatsapp=?,social_links=?,description=?,updated_at=CURRENT_TIMESTAMP,version=version+1 WHERE id=?").bind(title,categoryId,locality,cleanText(details.address,300)||null,cleanText(details.phone,60)||null,externalOrNull(details.website,"Website-ul"),cleanText(details.contactEmail,254)||null,cleanText(details.whatsapp,60)||null,cleanText(details.socialLinks,2000)||null,excerpt||null,entityId);
  if(input.type==="event")return db.prepare("UPDATE events SET title=?,category_id=?,organizer=?,locality=?,venue=?,starts_at=?,ends_at=?,ticket_info=?,description=?,family_friendly=?,accessibility=?,address=?,image_url=?,source_url=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(title,categoryId,cleanText(details.organizer,240)||null,locality,cleanText(details.venue,240)||null,cleanText(details.startsAt,40,true),cleanText(details.endsAt,40)||null,cleanText(details.ticketInfo,500)||null,excerpt||null,details.familyFriendly?1:0,cleanText(details.accessibility,500)||null,cleanText(details.address,300)||null,externalOrNull(details.imageUrl,"Imaginea externă"),sourceUrl,entityId);
  if(input.type==="offer")return db.prepare("UPDATE offers SET business_id=?,title=?,starts_at=?,ends_at=?,price=?,old_price=?,terms=?,description=?,availability=?,image_url=?,source_url=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(businessId,title,cleanText(details.startsAt,40,true),cleanText(details.endsAt,40,true),numberOrNull(details.price),numberOrNull(details.oldPrice),cleanText(details.terms,3000)||null,excerpt||null,cleanText(details.availability,120)||"active",externalOrNull(details.imageUrl,"Imaginea externă"),sourceUrl,entityId);
  if(input.type==="job")return db.prepare("UPDATE jobs SET business_id=?,title=?,company=?,locality=?,contract_type=?,work_arrangement=?,schedule=?,shift=?,salary_min=?,salary_max=?,transport_provided=?,responsibilities=?,requirements=?,benefits=?,apply_url=?,application_method=?,deadline=?,source_url=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(businessId,title,cleanText(details.company,240,true),locality,cleanText(details.contractType,120)||null,cleanText(details.workArrangement,120)||null,cleanText(details.schedule,300)||null,cleanText(details.shift,120)||null,numberOrNull(details.salaryMin),numberOrNull(details.salaryMax),details.transport?1:0,cleanText(details.responsibilities,8000)||null,cleanText(details.requirements,8000)||null,cleanText(details.benefits,8000)||null,externalOrNull(details.applyUrl,"Linkul de aplicare"),cleanText(details.applicationMethod,1000)||null,cleanText(details.deadline,40)||null,sourceUrl,entityId);
  if(input.type==="restaurant")return db.prepare("UPDATE restaurants SET business_id=?,name=?,cuisine=?,delivery=?,pickup=?,dietary_options=?,description=?,image_url=?,source_url=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(businessId,title,cleanText(details.cuisine,200)||null,details.delivery?1:0,details.pickup?1:0,cleanText(details.dietaryOptions,600)||null,excerpt||null,externalOrNull(details.imageUrl,"Imaginea externă"),sourceUrl,entityId);
  if(input.type==="daily_menu")return db.prepare("UPDATE daily_menus SET restaurant_id=?,menu_date=?,soup=?,main_dish=?,side_dish=?,dessert=?,price=?,order_deadline=?,availability=?,owner_user_id=?,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(numberOrNull(details.restaurantId),cleanText(details.menuDate,40,true),cleanText(details.soup,500)||null,cleanText(details.mainDish,500)||null,cleanText(details.sideDish,500)||null,cleanText(details.dessert,500)||null,numberOrNull(details.price),cleanText(details.orderDeadline,80)||null,cleanText(details.availability,100)||"active",account.id,entityId);
  if(input.type==="place")return db.prepare("UPDATE places SET title=?,address=?,description=?,accessibility=?,locality=?,image_url=?,source_url=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(title,cleanText(details.address,300)||null,excerpt||null,cleanText(details.accessibility,500)||null,locality,externalOrNull(details.imageUrl,"Imaginea externă"),sourceUrl,entityId);
  throw new PlatformError(400,"Tip de conținut neacceptat.");
}

function typeSlugUpdate(db:D1Database,type:ContentType,entityId:number,slug:string){
  const tables:Partial<Record<ContentType,string>>={business:"businesses",event:"events",offer:"offers",job:"jobs",restaurant:"restaurants",place:"places"};
  const table=tables[type];
  return table?db.prepare(`UPDATE ${table} SET slug=? WHERE id=?`).bind(slug,entityId):db.prepare("SELECT 1");
}

export async function createContent(account: LocalAccount, raw: Partial<ContentInput>) {
  await enforceRateLimit(account,"content.created",20,60);
  const type = String(raw.type || "") as ContentType;
  if (!contentTypes.includes(type)) throw new PlatformError(400, "Tip de conținut neacceptat.");
  const businessId = numberOrNull(raw.businessId);
  await assertCreationScope(account, type, businessId);
  const title = cleanText(raw.title, 240, true);
  const slug = await uniqueSlug(cleanText(raw.slug, 120), title);
  const contentId = randomId();
  const entityId = randomId();
  const input = { ...raw, type, title } as ContentInput;
  const db = getRuntimeDb();
  await db.batch([
    db.prepare("INSERT INTO content_records (id,type,entity_id,title,slug,excerpt,seo_title,seo_description,owner_user_id,business_id,status,moderation_state,visibility,created_by,last_edited_by,version) VALUES (?,?,?,?,?,?,?,?,?,?,'draft','draft','private',?,?,1)")
      .bind(contentId, type, entityId, title, slug, cleanText(raw.excerpt, 600) || null, cleanText(raw.seoTitle,180)||null, cleanText(raw.seoDescription,300)||null, account.id, businessId, account.id, account.id),
    typeInsert(db, input, entityId, contentId, slug, account),
    db.prepare("INSERT INTO audit_logs (actor_user_id,action,entity_type,entity_id,metadata) VALUES (?,'content.created','content',?,?)")
      .bind(account.id, String(contentId), JSON.stringify({ type, status: "draft" })),
  ]);
  return { id: contentId, entityId, slug, status: "draft", version: 1 };
}

export async function updateContent(account: LocalAccount, id: number, raw: Partial<ContentInput> & { version?: number }) {
  const db = getRuntimeDb();
  const row = await db.prepare("SELECT * FROM content_records WHERE id=? AND deleted_at IS NULL").bind(id).first<ContentRow>();
  if (!row) throw new PlatformError(404, "Conținutul nu există.");
  if (!(await canManageEntity(account, id))) throw new PlatformError(403, "Nu poți edita acest conținut.");
  if (Number(raw.version) !== row.version) throw new PlatformError(409, "Conținutul a fost modificat între timp. Reîncarcă pagina și compară versiunea nouă.", "stale_version");
  if (row.status === "pending_review") throw new PlatformError(409, "Retrage mai întâi trimiterea înainte de editare.");

  const title = cleanText(raw.title ?? row.title, 240, true);
  const excerpt = cleanText(raw.excerpt ?? row.excerpt, 600);
  const slug = await uniqueSlug(cleanText(raw.slug ?? row.slug, 120), title, id);
  const snapshot = JSON.stringify({ ...raw, type: row.type, title, excerpt, version: row.version + 1 });

  if (row.status === "published") {
    const revision = await db.prepare("SELECT COALESCE(MAX(revision_number),0)+1 AS next FROM content_revisions WHERE entity_type='content' AND entity_id=?")
      .bind(id).first<{ next: number }>();
    await db.batch([
      db.prepare("INSERT INTO content_revisions (entity_type,entity_id,revision_number,snapshot,created_by,moderation_status) VALUES ('content',?,?,?,?, 'pending_review')")
        .bind(id, revision?.next ?? 1, snapshot, account.id),
      db.prepare("UPDATE content_records SET moderation_state='pending_review', submitted_at=CURRENT_TIMESTAMP, last_edited_by=?, updated_at=CURRENT_TIMESTAMP, version=version+1 WHERE id=? AND version=?")
        .bind(account.id, id, row.version),
      db.prepare("INSERT INTO audit_logs (actor_user_id,action,entity_type,entity_id,metadata) VALUES (?,'content.revision_submitted','content',?,?)")
        .bind(account.id, String(id), JSON.stringify({ revision: revision?.next ?? 1 })),
    ]);
    return { id, status: "published", moderationState: "pending_review", publicVersionPreserved: true, version: row.version + 1 };
  }

  if (!['draft', 'needs_changes', 'rejected'].includes(row.status)) throw new PlatformError(409, "Acest conținut nu poate fi editat în starea curentă.");
  await db.batch([
    db.prepare("UPDATE content_records SET title=?,slug=?,excerpt=?,seo_title=?,seo_description=?,last_edited_by=?,updated_at=CURRENT_TIMESTAMP,version=version+1 WHERE id=? AND version=?")
      .bind(title, slug, excerpt || null, cleanText(raw.seoTitle,180)||null, cleanText(raw.seoDescription,300)||null, account.id, id, row.version),
    typeUpdate(db,{...raw,type:row.type,title,excerpt} as ContentInput,row.entity_id as number,title,account),
    typeSlugUpdate(db,row.type,row.entity_id as number,slug),
    db.prepare("INSERT INTO content_revisions (entity_type,entity_id,revision_number,snapshot,created_by,moderation_status) VALUES ('content',?,?,?,?, 'draft')")
      .bind(id, row.version + 1, snapshot, account.id),
    db.prepare("INSERT INTO audit_logs (actor_user_id,action,entity_type,entity_id,metadata) VALUES (?,'content.updated','content',?,?)")
      .bind(account.id, String(id), JSON.stringify({ fromVersion: row.version, toVersion: row.version + 1 })),
  ]);
  return { id, status: row.status, version: row.version + 1 };
}

export async function contentAction(account: LocalAccount, id: number, action: string) {
  const db = getRuntimeDb();
  const row = await db.prepare("SELECT * FROM content_records WHERE id=?").bind(id).first<ContentRow>();
  if (!row) throw new PlatformError(404, "Conținutul nu există.");
  if (!(await canManageEntity(account, id))) throw new PlatformError(403, "Nu poți administra acest conținut.");
  if(row.deleted_at)throw new PlatformError(409,"Materialul trebuie recuperat înainte de alte acțiuni.");
  const now = "CURRENT_TIMESTAMP";
  let statement: D1PreparedStatement;
  let nextStatus = row.status;

  if (action === "submit" && ["draft", "needs_changes"].includes(row.status)) {
    statement = db.prepare(`UPDATE content_records SET status='pending_review',moderation_state='pending_review',visibility='private',submitted_at=${now},updated_at=${now},version=version+1 WHERE id=? AND version=?`).bind(id, row.version);
    nextStatus = "pending_review";
  } else if (action === "withdraw" && row.status === "pending_review") {
    statement = db.prepare(`UPDATE content_records SET status='draft',moderation_state='draft',submitted_at=NULL,updated_at=${now},version=version+1 WHERE id=? AND version=?`).bind(id, row.version);
    nextStatus = "draft";
  } else if (action === "archive" && row.status === "published") {
    statement = db.prepare(`UPDATE content_records SET status='archived',moderation_state='archived',visibility='private',archived_at=${now},updated_at=${now},version=version+1 WHERE id=? AND version=?`).bind(id, row.version);
    nextStatus = "archived";
  } else if (action === "restore" && row.status === "archived") {
    statement = db.prepare(`UPDATE content_records SET status='published',moderation_state='approved',visibility='public',archived_at=NULL,updated_at=${now},version=version+1 WHERE id=? AND version=?`).bind(id, row.version);
    nextStatus = "published";
  } else if (action === "delete" && ["draft", "needs_changes", "rejected"].includes(row.status)) {
    statement = db.prepare(`UPDATE content_records SET status='soft_deleted',moderation_state='soft_deleted',visibility='private',deleted_at=${now},deleted_by=?,deletion_reason='Șters de autor',updated_at=${now},version=version+1 WHERE id=? AND version=?`).bind(account.id, id, row.version);
    nextStatus = "soft_deleted";
  } else if (action === "duplicate") {
    return createContent(account, { type: row.type, title: `${row.title} — copie`, excerpt: row.excerpt || "", businessId: row.business_id });
  } else {
    throw new PlatformError(409, "Acțiunea nu este disponibilă în starea curentă.");
  }

  await db.batch([
    statement,
    db.prepare("INSERT INTO audit_logs (actor_user_id,action,entity_type,entity_id,metadata) VALUES (?,?,?,?,?)")
      .bind(account.id, `content.${action}`, "content", String(id), JSON.stringify({ previousState: row.status, newState: nextStatus })),
  ]);
  if (action === "submit") await notify(account.id, "content_submitted", "Conținut trimis", "Materialul a intrat în verificare.", "content", id, `/cont/continut/${id}`);
  return { id, status: nextStatus, version: row.version + 1 };
}

export async function listMyContent(account: LocalAccount, search = "", status = "", type = "") {
  const db = getRuntimeDb();
  const conditions = ["(c.owner_user_id=? OR bm.user_id=?)", "c.deleted_at IS NULL"];
  const bindings: unknown[] = [account.id, account.id];
  if (status) { conditions.push("c.status=?"); bindings.push(status); }
  if (type) { conditions.push("c.type=?"); bindings.push(type); }
  if (search) { conditions.push("(c.title LIKE ? OR c.excerpt LIKE ?)"); bindings.push(`%${search}%`, `%${search}%`); }
  return db.prepare(`SELECT DISTINCT c.* FROM content_records c LEFT JOIN business_memberships bm ON bm.business_id=c.business_id AND bm.membership_status='active' WHERE ${conditions.join(" AND ")} ORDER BY c.updated_at DESC LIMIT 200`)
    .bind(...bindings).all<ContentRow>();
}

export async function getContentForEditor(account: LocalAccount, id: number) {
  if (!isAdmin(account) && !(await canManageEntity(account, id))) throw new PlatformError(403, "Nu poți edita acest conținut.");
  const db=getRuntimeDb();const row=await db.prepare(isAdmin(account)?"SELECT * FROM content_records WHERE id=?":"SELECT * FROM content_records WHERE id=? AND deleted_at IS NULL").bind(id).first<ContentRow>();if(!row||!row.entity_id)return row;
  if(postTypes.has(row.type)){const details=await db.prepare("SELECT * FROM posts WHERE id=?").bind(row.entity_id).first<any>();return {...row,body:details?.body||"",locality:details?.locality||"Blaj",sourceUrl:details?.source_information||"",details:details||{}}}
  const tables:Partial<Record<ContentType,string>>={business:"businesses",event:"events",offer:"offers",job:"jobs",restaurant:"restaurants",daily_menu:"daily_menus",place:"places"};const table=tables[row.type];if(!table)return row;const details=await db.prepare(`SELECT * FROM ${table} WHERE id=?`).bind(row.entity_id).first<any>();return {...row,locality:details?.locality||"Blaj",sourceUrl:details?.source_url||"",details:details||{}};
}

export async function adminModerate(account: LocalAccount, id: number, action: string, note: string, scheduledAt = "") {
  if (!isAdmin(account)) throw new PlatformError(403, "Doar administratorii pot modera.");
  const db = getRuntimeDb();
  const row = await db.prepare("SELECT * FROM content_records WHERE id=?").bind(id).first<ContentRow>();
  if (!row) throw new PlatformError(404, "Conținutul nu există.");
  if(row.deleted_at&&action!=="restore_deleted")throw new PlatformError(409,"Materialul trebuie recuperat înainte de alte acțiuni.");
  if(!row.deleted_at&&action==="restore_deleted")throw new PlatformError(409,"Materialul nu este șters.");
  if(action==="feature"||action==="unfeature"){
    const featured=action==="feature"?1:0;await db.batch([db.prepare("UPDATE content_records SET featured=?,updated_at=CURRENT_TIMESTAMP,version=version+1 WHERE id=?").bind(featured,id),db.prepare("INSERT INTO audit_logs (actor_user_id,action,entity_type,entity_id,metadata) VALUES (?,?,?,?,?)").bind(account.id,`content.${action}`,"content",String(id),JSON.stringify({featured:Boolean(featured)}))]);return{id,status:row.status,featured:Boolean(featured),version:row.version+1};
  }
  if (["needs_changes", "reject", "soft_delete"].includes(action) && !cleanText(note, 2000)) throw new PlatformError(400, "Nota de moderare este obligatorie.");
  if (action === "schedule" && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(scheduledAt)) throw new PlatformError(400, "Alege data și ora publicării.");
  const transitions: Record<string, { status: string; moderation: string; visibility: string }> = {
    approve: { status: "approved", moderation: "approved", visibility: "private" },
    publish: { status: "published", moderation: "approved", visibility: "public" },
    needs_changes: { status: "needs_changes", moderation: "needs_changes", visibility: "private" },
    reject: { status: "rejected", moderation: "rejected", visibility: "private" },
    archive: { status: "archived", moderation: "archived", visibility: "private" },
    restore: { status: "published", moderation: "approved", visibility: "public" },
    schedule: { status: "scheduled", moderation: "approved", visibility: "public" },
    soft_delete: { status: "soft_deleted", moderation: "soft_deleted", visibility: "private" },
    restore_deleted: { status: "draft", moderation: "draft", visibility: "private" },
  };
  let target = transitions[action];
  if (!target) throw new PlatformError(400, "Acțiune de moderare neacceptată.");
  const pendingRevision=await db.prepare("SELECT * FROM content_revisions WHERE entity_type='content' AND entity_id=? AND moderation_status='pending_review' ORDER BY revision_number DESC LIMIT 1").bind(id).first<{id:number;snapshot:string}>();
  let revisionInput:ContentInput|null=null;
  if(pendingRevision&&row.status==="published"){
    try{revisionInput=JSON.parse(pendingRevision.snapshot) as ContentInput}catch{throw new PlatformError(400,"Revizia nu poate fi citită.")}
    if(action==="publish"||action==="approve")target={status:"published",moderation:"approved",visibility:"public"};
    else if(action==="needs_changes")target={status:"published",moderation:"needs_changes",visibility:"public"};
    else if(action==="reject")target={status:"published",moderation:"approved",visibility:"public"};
  }
  const publishedSnapshot = (action === "publish" || action === "restore" || (revisionInput&&action==="approve"))
    ? JSON.stringify({ title: row.title, excerpt: row.excerpt, type: row.type, entityId: row.entity_id, version: row.version + 1 })
    : row.published_snapshot;
  const statements:D1PreparedStatement[]=[
    db.prepare("UPDATE content_records SET status=?,moderation_state=?,visibility=?,published_by=CASE WHEN ?='published' THEN ? ELSE published_by END,published_at=CASE WHEN ?='published' THEN COALESCE(published_at,CURRENT_TIMESTAMP) ELSE published_at END,archived_at=CASE WHEN ?='archived' THEN CURRENT_TIMESTAMP WHEN ?='published' THEN NULL ELSE archived_at END,published_snapshot=?,updated_at=CURRENT_TIMESTAMP,version=version+1 WHERE id=? AND version=?")
      .bind(target.status, target.moderation, target.visibility, target.status, account.id, target.status, target.status, target.status, publishedSnapshot, id, row.version),
    db.prepare("INSERT INTO moderation_records (submission_id,entity_type,entity_id,previous_state,new_state,moderator_id,action,note) VALUES (0,'content',?,?,?,?,?,?)")
      .bind(id, row.status, target.status, String(account.id), action, cleanText(note, 2000) || null),
    db.prepare("INSERT INTO audit_logs (actor_user_id,action,entity_type,entity_id,metadata) VALUES (?,'moderation.decision','content',?,?)")
      .bind(account.id, String(id), JSON.stringify({ action, previousState: row.status, newState: target.status, note: cleanText(note, 2000) || null })),
  ];
  if(pendingRevision){
    const revisionState=action==="needs_changes"?"needs_changes":["reject","soft_delete"].includes(action)?"rejected":"approved";
    statements.push(db.prepare("UPDATE content_revisions SET moderation_status=?,moderator_id=?,moderator_note=? WHERE id=?").bind(revisionState,account.id,cleanText(note,2000)||null,pendingRevision.id));
    if(revisionInput&&(action==="publish"||action==="approve")){
      const revisionTitle=cleanText(revisionInput.title,240,true);const revisionExcerpt=cleanText(revisionInput.excerpt,600);const revisionSlug=await uniqueSlug(cleanText(revisionInput.slug||row.slug,120),revisionTitle,id);
      statements[0]=db.prepare("UPDATE content_records SET title=?,slug=?,excerpt=?,seo_title=?,seo_description=?,status='published',moderation_state='approved',visibility='public',published_by=?,published_at=COALESCE(published_at,CURRENT_TIMESTAMP),published_snapshot=?,updated_at=CURRENT_TIMESTAMP,version=version+1 WHERE id=? AND version=?").bind(revisionTitle,revisionSlug,revisionExcerpt||null,cleanText(revisionInput.seoTitle,180)||null,cleanText(revisionInput.seoDescription,300)||null,account.id,JSON.stringify({...revisionInput,title:revisionTitle,slug:revisionSlug,excerpt:revisionExcerpt}),id,row.version);
      statements.push(typeUpdate(db,{...revisionInput,type:row.type,title:revisionTitle,excerpt:revisionExcerpt},row.entity_id as number,revisionTitle,account));
      statements.push(typeSlugUpdate(db,row.type,row.entity_id as number,revisionSlug));
    }
  }
  if(action==="soft_delete")statements.push(db.prepare("UPDATE content_records SET deleted_at=CURRENT_TIMESTAMP,deleted_by=?,deletion_reason=? WHERE id=?").bind(account.id,cleanText(note,2000),id));
  if(action==="restore_deleted")statements.push(db.prepare("UPDATE content_records SET deleted_at=NULL,deleted_by=NULL,deletion_reason=NULL WHERE id=?").bind(id));
  if(action==="schedule")statements.push(db.prepare("UPDATE content_records SET scheduled_at=? WHERE id=?").bind(cleanText(scheduledAt,40,true),id));
  await db.batch(statements);
  if (row.owner_user_id) {
    const labels: Record<string, [string, string]> = {
      approve: ["Conținut aprobat", "Materialul a fost aprobat."], publish: ["Conținut publicat", "Materialul este acum public."], schedule: ["Publicare programată", `Materialul este programat pentru ${scheduledAt}.`], needs_changes: ["Sunt necesare modificări", note], reject: ["Conținut respins", note], archive: ["Conținut arhivat", "Un administrator a arhivat materialul."], restore: ["Conținut restaurat", "Materialul este din nou public."], soft_delete: ["Conținut eliminat", note], restore_deleted: ["Conținut recuperat", "Materialul a revenit ca ciornă privată."],
    };
    const message = labels[action];
    await notify(row.owner_user_id, `content_${action}`, message[0], message[1], "content", id, `/cont/continut/${id}`);
  }
  return { id, status: target.status, version: row.version + 1 };
}
