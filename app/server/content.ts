/* eslint-disable @typescript-eslint/no-explicit-any -- type-specific D1 rows are narrowed by the content type */
import {
  canManageEntity,
  cleanText,
  enforceRateLimit,
  isAdmin,
  type LocalAccount,
  notify,
  PlatformError,
  requireBusinessMembership,
  safeSlug,
} from "./platform";
import { getRuntimeDb } from "../../db/runtime";
import { safeExternalHref } from "../site-content";
import { richTextIsMeaningful, serializeRichText } from "../rich-text";

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
export const ordinaryUserContentTypes = contentTypes.filter((type) => type !== "article") as Exclude<ContentType, "article">[];

const userTypes = new Set<ContentType>(["business", "community_post", "local_story", "event", "place"]);
const businessTypes = new Set<ContentType>(["business_update", "offer", "event", "job", "restaurant", "daily_menu"]);
const postTypes = new Set<ContentType>(["community_post", "local_story", "article", "business_update"]);

export type ContentInput = {
  type: ContentType;
  title: string;
  slug?: string;
  excerpt?: unknown;
  body?: unknown;
  locality?: string;
  categoryId?: number | null;
  businessId?: number | null;
  sourceUrl?: string;
  seoTitle?: string;
  seoDescription?: string;
  primaryMediaId?: number | null;
  primaryMediaAltText?: string;
  primaryMediaState?: "legacy" | "selected" | "none";
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
  primary_media_id: number | null;
  primary_media_alt_text: string | null;
  primary_media_state: "legacy" | "selected" | "none";
  published_media_id: number | null;
  published_media_alt_text: string | null;
  published_media_state: "legacy" | "selected" | "none";
  deleted_at: string | null;
};

type MediaSelection = { state: "legacy" | "selected" | "none"; id: number | null; altText: string };
type EditorMedia = { id:number; url:string; altText:string; approvalStatus:string; mediaStatus:string; width:number|null; height:number|null };

function randomId(): number {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return 100_000_000 + (values[0] % 1_900_000_000);
}

function numberOrNull(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

async function normalizeMediaSelection(account: LocalAccount, raw: Partial<ContentInput>, current?: MediaSelection): Promise<MediaSelection> {
  const supplied = Object.prototype.hasOwnProperty.call(raw, "primaryMediaState") || Object.prototype.hasOwnProperty.call(raw, "primaryMediaId") || Object.prototype.hasOwnProperty.call(raw, "primaryMediaAltText");
  if (!supplied && current) return current;
  const id = numberOrNull(raw.primaryMediaId);
  const state = raw.primaryMediaState === "none" || !id ? "none" : "selected";
  const altText = cleanText(raw.primaryMediaAltText, 500);
  if (state === "none") return { state, id: null, altText: "" };
  const media = await getRuntimeDb().prepare("SELECT owner_user_id,media_status FROM media_assets WHERE id=? LIMIT 1").bind(id).first<{owner_user_id:number|null;media_status:string}>();
  if (!media || media.media_status !== "active") throw new PlatformError(409, "Imaginea selectată nu mai este disponibilă.", "media_unavailable");
  if (!isAdmin(account) && media.owner_user_id !== account.id) throw new PlatformError(403, "Nu ai permisiunea să modifici acest conținut.", "media_forbidden");
  return { state, id, altText };
}

async function editorMedia(db: D1Database, contentId: number, selection: MediaSelection): Promise<EditorMedia | null> {
  if (selection.state === "none") return null;
  const row = selection.state === "selected" && selection.id
    ? await db.prepare("SELECT id,alt_text,approval_status,media_status,width,height FROM media_assets WHERE id=? AND media_status='active' LIMIT 1").bind(selection.id).first<{id:number;alt_text:string|null;approval_status:string;media_status:string;width:number|null;height:number|null}>()
    : await db.prepare("SELECT id,alt_text,approval_status,media_status,width,height FROM media_assets WHERE content_id=? AND media_status='active' ORDER BY created_at DESC,id DESC LIMIT 1").bind(contentId).first<{id:number;alt_text:string|null;approval_status:string;media_status:string;width:number|null;height:number|null}>();
  return row ? { id:row.id, url:`/api/media/${row.id}`, altText:selection.altText || row.alt_text || "", approvalStatus:row.approval_status, mediaStatus:row.media_status, width:row.width, height:row.height } : null;
}

function attachMedia(db:D1Database, media:MediaSelection, contentId:number, businessId:number|null, mutationId?:string) {
  if (media.state !== "selected" || !media.id) return null;
  const guard = mutationId ? " AND EXISTS (SELECT 1 FROM content_records WHERE id=? AND last_mutation_id=?)" : "";
  return db.prepare(`UPDATE media_assets SET content_id=?,business_id=COALESCE(business_id,?),alt_text=?,orphaned_at=NULL WHERE id=?${guard}`)
    .bind(contentId,businessId,media.altText,media.id,...(mutationId?[contentId,mutationId]:[]));
}

function richValue(value: unknown, label: string, maxCharacters: number, required = false): string {
  try { return serializeRichText(value ?? "", { label, maxCharacters, required }); }
  catch (error) { throw new PlatformError(400, error instanceof Error ? error.message : `${label}: conținut invalid.`, "rich_text_invalid"); }
}

function detailValue(details: Record<string, unknown>, camel: string, snake = camel): unknown {
  return Object.prototype.hasOwnProperty.call(details, camel) ? details[camel] : details[snake];
}

function validRomanianPhone(value: unknown): boolean {
  const display = cleanText(value, 60);
  if (!display || !/^[+\d][\d\s().\-/]{6,24}$/.test(display)) return false;
  const digits = display.replace(/\D/g, "");
  return digits.length >= 9 && digits.length <= 15;
}

export function validateBusinessPublicationInput(input: Partial<ContentInput>) {
  const details = input.details ?? {};
  const errors: Record<string, string> = {};
  if (!cleanText(input.title, 240)) errors.title = "Introdu un titlu.";
  if (!cleanText(input.locality ?? detailValue(details, "locality"), 120)) errors.locality = "Selectează localitatea.";
  try { if (!richTextIsMeaningful(input.excerpt ?? "")) errors.excerpt = "Adaugă un rezumat."; }
  catch { errors.excerpt = "Adaugă un rezumat."; }
  if (!cleanText(detailValue(details, "address"), 300)) errors.address = "Introdu adresa.";
  if (!validRomanianPhone(detailValue(details, "phone"))) errors.phone = "Introdu un număr de telefon valid.";
  if (Object.keys(errors).length) {
    const first = Object.values(errors)[0];
    throw new PlatformError(400, first, "publication_incomplete");
  }
  return input;
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
  const businessDraft = input.type === "business";
  const title = cleanText(input.title, 240, !businessDraft);
  const localitySource = input.locality !== undefined ? input.locality : detailValue(details, "locality");
  const locality = cleanText(localitySource, 120, !businessDraft);
  const body = richValue(input.body ?? detailValue(details, "description"), "Conținut", 30_000, postTypes.has(input.type));
  const excerpt = richValue(input.excerpt ?? detailValue(details, "description"), "Rezumat", 6_000);
  const businessId = numberOrNull(input.businessId);
  const categoryId = numberOrNull(input.categoryId);
  const sourceUrl = externalOrNull(input.sourceUrl, "Sursa");

  if (postTypes.has(input.type)) {
    return db.prepare("INSERT INTO posts (id,content_item_id,post_type,author_user_id,business_id,body,category_id,locality,source_information,seo_title,seo_description) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
      .bind(entityId, contentId, input.type, account.id, businessId, body, categoryId, locality, sourceUrl || null, cleanText(input.seoTitle, 180) || null, cleanText(input.seoDescription, 300) || null);
  }
  if (input.type === "business") {
    return db.prepare("INSERT INTO businesses (id,name,slug,category_id,locality,address,phone,website,contact_email,whatsapp,social_links,description,creator_user_id,moderation_status,verification_status,visibility,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'draft','unverified','private','draft')")
      .bind(entityId, title, slug, categoryId, locality, cleanText(detailValue(details,"address"), 300) || null, cleanText(detailValue(details,"phone"), 60) || null, externalOrNull(detailValue(details,"website"), "Website-ul"), cleanText(detailValue(details,"contactEmail","contact_email"),254)||null, cleanText(detailValue(details,"whatsapp"),60)||null, cleanText(detailValue(details,"socialLinks","social_links"),2000)||null, excerpt, account.id);
  }
  if (input.type === "event") {
    const startsAt = cleanText(details.startsAt, 40, true);
    return db.prepare("INSERT INTO events (id,title,slug,category_id,organizer,locality,venue,starts_at,ends_at,ticket_info,description,family_friendly,accessibility,address,image_url,status,source_url) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .bind(entityId, title, slug, categoryId, cleanText(details.organizer, 240) || null, locality, cleanText(details.venue, 240) || null, startsAt, cleanText(details.endsAt, 40) || null, cleanText(details.ticketInfo, 500) || null, excerpt, details.familyFriendly ? 1 : 0, cleanText(details.accessibility, 500) || null, cleanText(details.address, 300) || null, externalOrNull(details.imageUrl, "Imaginea externă"), "draft", sourceUrl);
  }
  if (input.type === "offer") {
    if (!businessId) throw new PlatformError(400, "Selectează afacerea ofertei.");
    return db.prepare("INSERT INTO offers (id,business_id,title,slug,starts_at,ends_at,price,old_price,terms,description,availability,image_url,status,source_url) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .bind(entityId, businessId, title, slug, cleanText(details.startsAt, 40, true), cleanText(details.endsAt, 40, true), numberOrNull(details.price), numberOrNull(details.oldPrice), richValue(details.terms, "Condiții", 3_000), excerpt, cleanText(details.availability, 120) || "active", externalOrNull(details.imageUrl, "Imaginea externă"), "draft", sourceUrl);
  }
  if (input.type === "job") {
    if (!businessId) throw new PlatformError(400, "Selectează afacerea jobului.");
    return db.prepare("INSERT INTO jobs (id,business_id,title,slug,company,locality,contract_type,work_arrangement,schedule,shift,salary_min,salary_max,transport_provided,responsibilities,requirements,benefits,apply_url,application_method,deadline,status,source_url) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .bind(entityId, businessId, title, slug, cleanText(details.company, 240, true), locality, cleanText(details.contractType, 120) || null, cleanText(details.workArrangement, 120) || null, cleanText(details.schedule, 300) || null, cleanText(details.shift, 120) || null, numberOrNull(details.salaryMin), numberOrNull(details.salaryMax), details.transport ? 1 : 0, richValue(details.responsibilities, "Responsabilități", 8_000), richValue(details.requirements, "Cerințe", 8_000), richValue(details.benefits, "Beneficii", 8_000), externalOrNull(details.applyUrl, "Linkul de aplicare"), cleanText(details.applicationMethod, 1000) || null, cleanText(details.deadline, 40) || null, "draft", sourceUrl);
  }
  if (input.type === "restaurant") {
    if (!businessId) throw new PlatformError(400, "Selectează afacerea restaurantului.");
    return db.prepare("INSERT INTO restaurants (id,business_id,name,slug,cuisine,delivery,pickup,dietary_options,description,image_url,status,source_url) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
      .bind(entityId, businessId, title, slug, cleanText(details.cuisine, 200) || null, details.delivery ? 1 : 0, details.pickup ? 1 : 0, cleanText(details.dietaryOptions, 600) || null, excerpt, externalOrNull(details.imageUrl, "Imaginea externă"), "draft", sourceUrl);
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
      .bind(entityId, title, slug, cleanText(details.address, 300) || null, excerpt, cleanText(details.accessibility, 500) || null, locality, externalOrNull(details.imageUrl, "Imaginea externă"), "draft", sourceUrl);
  }
  throw new PlatformError(400, "Tip de conținut neacceptat.");
}

function typeUpdate(db: D1Database, input: ContentInput, entityId: number, title: string, account: LocalAccount, mutation?:{contentId:number;mutationId:string}) {
  const details = input.details ?? {};
  const locality = cleanText(input.locality ?? detailValue(details, "locality"), 120, input.type !== "business");
  const businessId = numberOrNull(input.businessId);
  const categoryId = numberOrNull(input.categoryId);
  const sourceUrl = externalOrNull(input.sourceUrl, "Sursa");
  const excerpt = richValue(input.excerpt, "Rezumat", 6_000);
  const guard=mutation?" AND EXISTS (SELECT 1 FROM content_records WHERE id=? AND last_mutation_id=?)":"";const guardValues=mutation?[mutation.contentId,mutation.mutationId]:[];
  if (postTypes.has(input.type)) return db.prepare(`UPDATE posts SET body=?,business_id=?,category_id=?,locality=?,source_information=?,seo_title=?,seo_description=? WHERE id=?${guard}`)
    .bind(richValue(input.body, "Conținut", 30_000, true), businessId, categoryId, locality, sourceUrl || null, cleanText(input.seoTitle,180)||null, cleanText(input.seoDescription,300)||null, entityId,...guardValues);
  if (input.type === "business") return db.prepare(`UPDATE businesses SET name=?,category_id=?,locality=?,address=?,phone=?,website=?,contact_email=?,whatsapp=?,social_links=?,description=?,updated_at=CURRENT_TIMESTAMP,version=version+1 WHERE id=?${guard}`)
    .bind(title, categoryId, locality, cleanText(detailValue(details,"address"),300)||null, cleanText(detailValue(details,"phone"),60)||null, externalOrNull(detailValue(details,"website"),"Website-ul"), cleanText(detailValue(details,"contactEmail","contact_email"),254)||null, cleanText(detailValue(details,"whatsapp"),60)||null, cleanText(detailValue(details,"socialLinks","social_links"),2000)||null, excerpt, entityId,...guardValues);
  if (input.type === "event") return db.prepare(`UPDATE events SET title=?,category_id=?,organizer=?,locality=?,venue=?,starts_at=?,ends_at=?,ticket_info=?,description=?,family_friendly=?,accessibility=?,address=?,image_url=?,source_url=?,updated_at=CURRENT_TIMESTAMP WHERE id=?${guard}`)
    .bind(title, categoryId, cleanText(details.organizer,240)||null, locality, cleanText(details.venue,240)||null, cleanText(details.startsAt,40,true), cleanText(details.endsAt,40)||null, cleanText(details.ticketInfo,500)||null, excerpt, details.familyFriendly?1:0, cleanText(details.accessibility,500)||null, cleanText(details.address,300)||null, externalOrNull(details.imageUrl,"Imaginea externă"), sourceUrl, entityId,...guardValues);
  if (input.type === "offer") return db.prepare(`UPDATE offers SET business_id=?,title=?,starts_at=?,ends_at=?,price=?,old_price=?,terms=?,description=?,availability=?,image_url=?,source_url=?,updated_at=CURRENT_TIMESTAMP WHERE id=?${guard}`)
    .bind(businessId, title, cleanText(details.startsAt,40,true), cleanText(details.endsAt,40,true), numberOrNull(details.price), numberOrNull(details.oldPrice), richValue(details.terms,"Condiții",3_000), excerpt, cleanText(details.availability,120)||"active", externalOrNull(details.imageUrl,"Imaginea externă"), sourceUrl, entityId,...guardValues);
  if (input.type === "job") return db.prepare(`UPDATE jobs SET business_id=?,title=?,company=?,locality=?,contract_type=?,work_arrangement=?,schedule=?,shift=?,salary_min=?,salary_max=?,transport_provided=?,responsibilities=?,requirements=?,benefits=?,apply_url=?,application_method=?,deadline=?,source_url=?,updated_at=CURRENT_TIMESTAMP WHERE id=?${guard}`)
    .bind(businessId, title, cleanText(details.company,240,true), locality, cleanText(details.contractType,120)||null, cleanText(details.workArrangement,120)||null, cleanText(details.schedule,300)||null, cleanText(details.shift,120)||null, numberOrNull(details.salaryMin), numberOrNull(details.salaryMax), details.transport?1:0, richValue(details.responsibilities,"Responsabilități",8_000), richValue(details.requirements,"Cerințe",8_000), richValue(details.benefits,"Beneficii",8_000), externalOrNull(details.applyUrl,"Linkul de aplicare"), cleanText(details.applicationMethod,1000)||null, cleanText(details.deadline,40)||null, sourceUrl, entityId,...guardValues);
  if (input.type === "restaurant") return db.prepare(`UPDATE restaurants SET business_id=?,name=?,cuisine=?,delivery=?,pickup=?,dietary_options=?,description=?,image_url=?,source_url=?,updated_at=CURRENT_TIMESTAMP WHERE id=?${guard}`)
    .bind(businessId, title, cleanText(details.cuisine,200)||null, details.delivery?1:0, details.pickup?1:0, cleanText(details.dietaryOptions,600)||null, excerpt, externalOrNull(details.imageUrl,"Imaginea externă"), sourceUrl, entityId,...guardValues);
  if (input.type === "daily_menu") return db.prepare(`UPDATE daily_menus SET restaurant_id=?,menu_date=?,soup=?,main_dish=?,side_dish=?,dessert=?,price=?,order_deadline=?,availability=?,owner_user_id=?,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?${guard}`)
    .bind(numberOrNull(details.restaurantId), cleanText(details.menuDate,40,true), cleanText(details.soup,500)||null, cleanText(details.mainDish,500)||null, cleanText(details.sideDish,500)||null, cleanText(details.dessert,500)||null, numberOrNull(details.price), cleanText(details.orderDeadline,80)||null, cleanText(details.availability,100)||"active", account.id, entityId,...guardValues);
  if (input.type === "place") return db.prepare(`UPDATE places SET title=?,address=?,description=?,accessibility=?,locality=?,image_url=?,source_url=?,updated_at=CURRENT_TIMESTAMP WHERE id=?${guard}`)
    .bind(title, cleanText(details.address,300)||null, excerpt, cleanText(details.accessibility,500)||null, locality, externalOrNull(details.imageUrl,"Imaginea externă"), sourceUrl, entityId,...guardValues);
  throw new PlatformError(400, "Tip de conținut neacceptat.");
}

function typeSlugUpdate(db:D1Database,type:ContentType,entityId:number,slug:string,mutation?:{contentId:number;mutationId:string}){
  const tables:Partial<Record<ContentType,string>>={business:"businesses",event:"events",offer:"offers",job:"jobs",restaurant:"restaurants",place:"places"};
  const table=tables[type];const guard=mutation?" AND EXISTS (SELECT 1 FROM content_records WHERE id=? AND last_mutation_id=?)":"";
  return table?db.prepare(`UPDATE ${table} SET slug=? WHERE id=?${guard}`).bind(slug,entityId,...(mutation?[mutation.contentId,mutation.mutationId]:[])):db.prepare("SELECT 1");
}

export async function createContent(account: LocalAccount, raw: Partial<ContentInput>) {
  await enforceRateLimit(account,"content.created",20,60);
  const type = String(raw.type || "") as ContentType;
  if (!contentTypes.includes(type)) throw new PlatformError(400, "Tip de conținut neacceptat.");
  const businessId = numberOrNull(raw.businessId);
  await assertCreationScope(account, type, businessId);
  const title = cleanText(raw.title, 240, type !== "business");
  const slug = await uniqueSlug(cleanText(raw.slug, 120), title);
  const contentId = randomId();
  const entityId = randomId();
  const input = {
    ...raw,
    type,
    title,
    excerpt: richValue(raw.excerpt, "Rezumat", 6_000),
    body: postTypes.has(type) ? richValue(raw.body, "Conținut", 30_000, true) : raw.body,
  } as ContentInput;
  const db = getRuntimeDb();
  const media = await normalizeMediaSelection(account, raw);
  input.primaryMediaId = media.id; input.primaryMediaAltText = media.altText; input.primaryMediaState = media.state;
  const statements = [
    db.prepare("INSERT INTO content_records (id,type,entity_id,title,slug,excerpt,seo_title,seo_description,primary_media_id,primary_media_alt_text,primary_media_state,published_media_state,owner_user_id,business_id,status,moderation_state,visibility,created_by,last_edited_by,version) VALUES (?,?,?,?,?,?,?,?,?,?,?,'none',?,?,'draft','draft','private',?,?,1)")
      .bind(contentId, type, entityId, title, slug, input.excerpt, cleanText(raw.seoTitle,180)||null, cleanText(raw.seoDescription,300)||null, media.id, media.altText||null, media.state, account.id, businessId, account.id, account.id),
    typeInsert(db, input, entityId, contentId, slug, account),
    db.prepare("INSERT INTO audit_logs (actor_user_id,action,entity_type,entity_id,metadata) VALUES (?,'content.created','content',?,?)")
      .bind(account.id, String(contentId), JSON.stringify({ type, status: "draft" })),
  ];
  const mediaAttach = attachMedia(db,media,contentId,businessId);if(mediaAttach)statements.push(mediaAttach);
  await db.batch(statements);
  return { id: contentId, entityId, slug, status: "draft", moderation_state:"draft", version: 1, primaryMediaId:media.id, primaryMediaAltText:media.altText, primaryMediaState:media.state, media:await editorMedia(db,contentId,media) };
}

export async function updateContent(account: LocalAccount, id: number, raw: Partial<ContentInput> & { version?: number }) {
  const db = getRuntimeDb();
  const row = await db.prepare("SELECT * FROM content_records WHERE id=? AND deleted_at IS NULL").bind(id).first<ContentRow>();
  if (!row) throw new PlatformError(404, "Conținutul nu există.");
  if (!(await canManageEntity(account, id))) throw new PlatformError(403, "Nu poți edita acest conținut.");
  if (Number(raw.version) !== row.version) throw staleContentVersion();
  if (row.status === "pending_review" || row.moderation_state === "pending_review") throw new PlatformError(409, "Retrage mai întâi trimiterea înainte de editare.");

  const existingDetails = await loadTypeDetails(db, row);
  const details = { ...existingDetails, ...(raw.details ?? {}) };
  const title = cleanText(raw.title ?? row.title, 240, row.type !== "business");
  const excerpt = raw.excerpt === undefined ? richValue(row.excerpt, "Rezumat", 6_000) : richValue(raw.excerpt, "Rezumat", 6_000);
  const body = postTypes.has(row.type) ? richValue(raw.body ?? existingDetails.body, "Conținut", 30_000, true) : raw.body;
  const slug = await uniqueSlug(cleanText(raw.slug ?? row.slug, 120), title, id);
  const media = await normalizeMediaSelection(account,raw,{state:row.primary_media_state,id:row.primary_media_id,altText:row.primary_media_alt_text||""});
  const normalizedInput = { ...raw, type: row.type, title, slug, excerpt, body, details, primaryMediaId:media.id, primaryMediaAltText:media.altText, primaryMediaState:media.state } as ContentInput;
  const snapshot = JSON.stringify({ ...normalizedInput, version: row.version + 1 });
  const mutationId=crypto.randomUUID();const mutation={contentId:id,mutationId};

  if (row.status === "published") {
    const revision = await db.prepare("SELECT COALESCE(MAX(revision_number),0)+1 AS next FROM content_revisions WHERE entity_type='content' AND entity_id=?")
      .bind(id).first<{ next: number }>();
    const statements=[
      db.prepare("UPDATE content_records SET moderation_state='draft',submitted_at=NULL,last_edited_by=?,last_mutation_id=?,updated_at=CURRENT_TIMESTAMP,version=version+1 WHERE id=? AND version=?").bind(account.id,mutationId,id,row.version),
      db.prepare("INSERT INTO content_revisions (entity_type,entity_id,revision_number,snapshot,created_by,moderation_status) SELECT 'content',?,?,?,?,'draft' WHERE EXISTS (SELECT 1 FROM content_records WHERE id=? AND last_mutation_id=?)").bind(id,revision?.next??1,snapshot,account.id,id,mutationId),
      db.prepare("INSERT INTO audit_logs (actor_user_id,action,entity_type,entity_id,metadata) SELECT ?,'content.revision_draft_saved','content',?,? WHERE EXISTS (SELECT 1 FROM content_records WHERE id=? AND last_mutation_id=?)").bind(account.id,String(id),JSON.stringify({revision:revision?.next??1}),id,mutationId),
    ];const mediaAttach=attachMedia(db,media,id,row.business_id,mutationId);if(mediaAttach)statements.push(mediaAttach);
    const results=await db.batch(statements);if(Number(results[0]?.meta?.changes??0)!==1)throw staleContentVersion();
    return { id, status: "published", moderation_state: "draft", moderationState: "draft", publicVersionPreserved: true, version: row.version + 1, primaryMediaId:media.id,primaryMediaAltText:media.altText,primaryMediaState:media.state,media:await editorMedia(db,id,media) };
  }

  if (!['draft', 'needs_changes', 'rejected'].includes(row.status)) throw new PlatformError(409, "Acest conținut nu poate fi editat în starea curentă.");
  const statements=[
    db.prepare("UPDATE content_records SET title=?,slug=?,excerpt=?,seo_title=?,seo_description=?,primary_media_id=?,primary_media_alt_text=?,primary_media_state=?,last_edited_by=?,last_mutation_id=?,updated_at=CURRENT_TIMESTAMP,version=version+1 WHERE id=? AND version=?")
      .bind(title,slug,excerpt,cleanText(raw.seoTitle,180)||null,cleanText(raw.seoDescription,300)||null,media.id,media.altText||null,media.state,account.id,mutationId,id,row.version),
    typeUpdate(db,normalizedInput,row.entity_id as number,title,account,mutation),
    typeSlugUpdate(db,row.type,row.entity_id as number,slug,mutation),
    db.prepare("INSERT INTO content_revisions (entity_type,entity_id,revision_number,snapshot,created_by,moderation_status) SELECT 'content',?,?,?,?, 'draft' WHERE EXISTS (SELECT 1 FROM content_records WHERE id=? AND last_mutation_id=?)").bind(id,row.version+1,snapshot,account.id,id,mutationId),
    db.prepare("INSERT INTO audit_logs (actor_user_id,action,entity_type,entity_id,metadata) SELECT ?,'content.updated','content',?,? WHERE EXISTS (SELECT 1 FROM content_records WHERE id=? AND last_mutation_id=?)").bind(account.id,String(id),JSON.stringify({fromVersion:row.version,toVersion:row.version+1}),id,mutationId),
  ];const mediaAttach=attachMedia(db,media,id,row.business_id,mutationId);if(mediaAttach)statements.push(mediaAttach);
  const results=await db.batch(statements);if(Number(results[0]?.meta?.changes??0)!==1)throw staleContentVersion();
  return { id, status: row.status, moderation_state:row.moderation_state, version: row.version + 1, primaryMediaId:media.id,primaryMediaAltText:media.altText,primaryMediaState:media.state,media:await editorMedia(db,id,media) };
}

function staleContentVersion(){return new PlatformError(409,"Conținutul a fost modificat într-o altă sesiune. Păstrăm modificările tale nesalvate; compară versiunea nouă înainte de a continua.","stale_version")}

async function loadTypeDetails(db: D1Database, row: ContentRow): Promise<Record<string, unknown>> {
  if (!row.entity_id) return {};
  if (postTypes.has(row.type)) return await db.prepare("SELECT * FROM posts WHERE id=?").bind(row.entity_id).first<Record<string, unknown>>() || {};
  const tables: Partial<Record<ContentType, string>> = { business:"businesses", event:"events", offer:"offers", job:"jobs", restaurant:"restaurants", daily_menu:"daily_menus", place:"places" };
  const table = tables[row.type];
  return table ? await db.prepare(`SELECT * FROM ${table} WHERE id=?`).bind(row.entity_id).first<Record<string, unknown>>() || {} : {};
}

async function inputForRow(db: D1Database, row: ContentRow): Promise<ContentInput> {
  const details = await loadTypeDetails(db, row);
  return {
    type: row.type,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt ?? "",
    body: details.body,
    locality: String(details.locality ?? ""),
    businessId: row.business_id,
    primaryMediaId: row.primary_media_id,
    primaryMediaAltText: row.primary_media_alt_text ?? "",
    primaryMediaState: row.primary_media_state,
    details,
  };
}

function assertPublicationReady(input: ContentInput) {
  if (input.type === "business") validateBusinessPublicationInput(input);
  if (input.primaryMediaState === "selected" && input.primaryMediaId && !cleanText(input.primaryMediaAltText,500)) throw new PlatformError(400,"Adaugă un text alternativ semnificativ pentru imagine.","media_alt_required");
}

export async function contentAction(account: LocalAccount, id: number, action: string, expectedVersion?:number) {
  const db = getRuntimeDb();
  const row = await db.prepare("SELECT * FROM content_records WHERE id=?").bind(id).first<ContentRow>();
  if (!row) throw new PlatformError(404, "Conținutul nu există.");
  if (!(await canManageEntity(account, id))) throw new PlatformError(403, "Nu poți administra acest conținut.");
  if(Number.isInteger(expectedVersion)&&expectedVersion!==row.version)throw staleContentVersion();
  if(row.deleted_at)throw new PlatformError(409,"Materialul trebuie recuperat înainte de alte acțiuni.");
  const now = "CURRENT_TIMESTAMP";
  let statement: D1PreparedStatement;
  let nextStatus = row.status;

  if (action === "submit" && row.status === "published") {
    const revision = await db.prepare("SELECT id,snapshot FROM content_revisions WHERE entity_type='content' AND entity_id=? AND moderation_status IN ('draft','needs_changes') ORDER BY revision_number DESC LIMIT 1").bind(id).first<{ id: number; snapshot: string }>();
    if (!revision) throw new PlatformError(409, "Salvează mai întâi modificările într-o ciornă.");
    let input: ContentInput;
    try { input = JSON.parse(revision.snapshot) as ContentInput; }
    catch { throw new PlatformError(400, "Revizia nu poate fi citită."); }
    assertPublicationReady(input);
    await db.batch([
      db.prepare("UPDATE content_revisions SET moderation_status='pending_review',moderator_id=NULL,moderator_note=NULL WHERE id=?").bind(revision.id),
      db.prepare("UPDATE content_records SET moderation_state='pending_review',submitted_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP,version=version+1 WHERE id=? AND version=?").bind(id,row.version),
      db.prepare("INSERT INTO audit_logs (actor_user_id,action,entity_type,entity_id,metadata) VALUES (?,'content.revision_submitted','content',?,?)").bind(account.id,String(id),JSON.stringify({ revisionId: revision.id })),
    ]);
    await notify(account.id, "content_submitted", "Revizie trimisă", "Modificările au intrat în verificare, iar versiunea publicată a rămas neschimbată.", "content", id, `/cont/continut/${id}`);
    return { id, status: "published", moderationState: "pending_review", publicVersionPreserved: true, version: row.version + 1 };
  }

  if (action === "submit" && ["draft", "needs_changes"].includes(row.status)) {
    assertPublicationReady(await inputForRow(db,row));
    statement = db.prepare(`UPDATE content_records SET status='pending_review',moderation_state='pending_review',visibility='private',submitted_at=${now},updated_at=${now},version=version+1 WHERE id=? AND version=?`).bind(id, row.version);
    nextStatus = "pending_review";
  } else if (action === "withdraw" && row.status === "published" && row.moderation_state === "pending_review") {
    const revision = await db.prepare("SELECT id FROM content_revisions WHERE entity_type='content' AND entity_id=? AND moderation_status='pending_review' ORDER BY revision_number DESC LIMIT 1").bind(id).first<{id:number}>();
    if (!revision) throw new PlatformError(409,"Revizia în verificare nu există.");
    await db.batch([
      db.prepare("UPDATE content_revisions SET moderation_status='draft' WHERE id=?").bind(revision.id),
      db.prepare("UPDATE content_records SET moderation_state='draft',submitted_at=NULL,updated_at=CURRENT_TIMESTAMP,version=version+1 WHERE id=? AND version=?").bind(id,row.version),
      db.prepare("INSERT INTO audit_logs (actor_user_id,action,entity_type,entity_id,metadata) VALUES (?,'content.withdraw','content',?,?)").bind(account.id,String(id),JSON.stringify({ publicVersionPreserved:true })),
    ]);
    return { id, status:"published", moderationState:"draft", publicVersionPreserved:true, version:row.version+1 };
  } else if (action === "withdraw" && row.status === "pending_review") {
    statement = db.prepare(`UPDATE content_records SET status='draft',moderation_state='draft',submitted_at=NULL,updated_at=${now},version=version+1 WHERE id=? AND version=?`).bind(id, row.version);
    nextStatus = "draft";
  } else if (action === "archive" && row.status === "published") {
    statement = db.prepare(`UPDATE content_records SET status='archived',moderation_state='archived',visibility='private',archived_at=${now},updated_at=${now},version=version+1 WHERE id=? AND version=?`).bind(id, row.version);
    nextStatus = "archived";
  } else if (action === "restore" && row.status === "archived") {
    assertPublicationReady(await inputForRow(db,row));
    statement = db.prepare(`UPDATE content_records SET status='published',moderation_state='approved',visibility='public',archived_at=NULL,updated_at=${now},version=version+1 WHERE id=? AND version=?`).bind(id, row.version);
    nextStatus = "published";
  } else if (action === "delete" && ["draft", "needs_changes", "rejected"].includes(row.status)) {
    statement = db.prepare(`UPDATE content_records SET status='soft_deleted',moderation_state='soft_deleted',visibility='private',deleted_at=${now},deleted_by=?,deletion_reason='Șters de autor',updated_at=${now},version=version+1 WHERE id=? AND version=?`).bind(account.id, id, row.version);
    nextStatus = "soft_deleted";
  } else if (action === "duplicate") {
    const source = await inputForRow(db,row);
    return createContent(account, { ...source, title: `${row.title} — copie`, slug: "" });
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
  return db.prepare(`SELECT DISTINCT c.*,CASE WHEN c.primary_media_state='none' THEN NULL WHEN c.primary_media_state='selected' THEN c.primary_media_id ELSE (SELECT id FROM media_assets WHERE content_id=c.id AND media_status='active' ORDER BY created_at DESC,id DESC LIMIT 1) END editor_media_id,CASE WHEN c.primary_media_state='selected' THEN c.primary_media_alt_text ELSE (SELECT alt_text FROM media_assets WHERE content_id=c.id AND media_status='active' ORDER BY created_at DESC,id DESC LIMIT 1) END editor_media_alt FROM content_records c LEFT JOIN business_memberships bm ON bm.business_id=c.business_id AND bm.membership_status='active' WHERE ${conditions.join(" AND ")} ORDER BY c.updated_at DESC LIMIT 200`)
    .bind(...bindings).all<ContentRow>();
}

export async function getContentForEditor(account: LocalAccount, id: number) {
  if (!isAdmin(account) && !(await canManageEntity(account, id))) throw new PlatformError(403, "Nu poți edita acest conținut.");
  const db=getRuntimeDb();const row=await db.prepare(isAdmin(account)?"SELECT * FROM content_records WHERE id=?":"SELECT * FROM content_records WHERE id=? AND deleted_at IS NULL").bind(id).first<ContentRow>();if(!row||!row.entity_id)return row;
  if(row.status==="published"){
    const revision=await db.prepare("SELECT snapshot,moderation_status,revision_number FROM content_revisions WHERE entity_type='content' AND entity_id=? AND moderation_status IN ('draft','pending_review','needs_changes') ORDER BY revision_number DESC LIMIT 1").bind(id).first<{snapshot:string;moderation_status:string;revision_number:number}>();
    if(revision){try{const input=JSON.parse(revision.snapshot) as ContentInput;const selection:MediaSelection={state:input.primaryMediaState??row.primary_media_state,id:numberOrNull(input.primaryMediaId)??row.primary_media_id,altText:cleanText(input.primaryMediaAltText??row.primary_media_alt_text,500)};return{...row,...input,version:row.version,status:row.status,moderation_state:revision.moderation_status,details:input.details||{},primaryMediaId:selection.id,primaryMediaAltText:selection.altText,primaryMediaState:selection.state,media:await editorMedia(db,id,selection),revisionNumber:revision.revision_number,publicVersionPreserved:true}}catch{/* Fall back to the published row when a legacy snapshot is unreadable. */}}
  }
  const selection:MediaSelection={state:row.primary_media_state,id:row.primary_media_id,altText:row.primary_media_alt_text||""};const media=await editorMedia(db,id,selection);
  if(postTypes.has(row.type)){const details=await db.prepare("SELECT * FROM posts WHERE id=?").bind(row.entity_id).first<any>();return {...row,body:details?.body??"",locality:details?.locality??"",sourceUrl:details?.source_information??"",details:details||{},primaryMediaId:media?.id??row.primary_media_id,primaryMediaAltText:media?.altText??selection.altText,primaryMediaState:media?"selected":selection.state,media}}
  const tables:Partial<Record<ContentType,string>>={business:"businesses",event:"events",offer:"offers",job:"jobs",restaurant:"restaurants",daily_menu:"daily_menus",place:"places"};const table=tables[row.type];if(!table)return{...row,media};const details=await db.prepare(`SELECT * FROM ${table} WHERE id=?`).bind(row.entity_id).first<any>();return {...row,locality:details?.locality??"",sourceUrl:details?.source_url??"",details:details||{},primaryMediaId:media?.id??row.primary_media_id,primaryMediaAltText:media?.altText??selection.altText,primaryMediaState:media?"selected":selection.state,media};
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
    if(action==="publish"||action==="approve")assertPublicationReady(revisionInput);
    if(action==="publish"||action==="approve")target={status:"published",moderation:"approved",visibility:"public"};
    else if(action==="needs_changes")target={status:"published",moderation:"needs_changes",visibility:"public"};
    else if(action==="reject")target={status:"published",moderation:"approved",visibility:"public"};
  }
  const publicationInput=!revisionInput&&["publish","approve","restore","schedule"].includes(action)?await inputForRow(db,row):revisionInput;
  if(publicationInput&&["publish","approve","restore","schedule"].includes(action))assertPublicationReady(publicationInput);
  const publishedSnapshot = (action === "publish" || action === "restore" || (revisionInput&&action==="approve"))
    ? JSON.stringify({ ...(publicationInput||{}), title: publicationInput?.title||row.title, excerpt: publicationInput?.excerpt||row.excerpt, type: row.type, entityId: row.entity_id, version: row.version + 1 })
    : row.published_snapshot;
  const publishMedia=["publish","approve","restore","schedule"].includes(action)&&publicationInput?{id:numberOrNull(publicationInput.primaryMediaId),alt:cleanText(publicationInput.primaryMediaAltText,500)||null,state:publicationInput.primaryMediaState||"none"}:null;
  const statements:D1PreparedStatement[]=[
    db.prepare("UPDATE content_records SET status=?,moderation_state=?,visibility=?,published_by=CASE WHEN ?='published' THEN ? ELSE published_by END,published_at=CASE WHEN ?='published' THEN COALESCE(published_at,CURRENT_TIMESTAMP) ELSE published_at END,archived_at=CASE WHEN ?='archived' THEN CURRENT_TIMESTAMP WHEN ?='published' THEN NULL ELSE archived_at END,published_snapshot=?,published_media_id=CASE WHEN ? THEN ? ELSE published_media_id END,published_media_alt_text=CASE WHEN ? THEN ? ELSE published_media_alt_text END,published_media_state=CASE WHEN ? THEN ? ELSE published_media_state END,updated_at=CURRENT_TIMESTAMP,version=version+1 WHERE id=? AND version=?")
      .bind(target.status,target.moderation,target.visibility,target.status,account.id,target.status,target.status,target.status,publishedSnapshot,Boolean(publishMedia),publishMedia?.id??null,Boolean(publishMedia),publishMedia?.alt??null,Boolean(publishMedia),publishMedia?.state??"none",id,row.version),
    db.prepare("INSERT INTO moderation_records (submission_id,entity_type,entity_id,previous_state,new_state,moderator_id,action,note) VALUES (0,'content',?,?,?,?,?,?)")
      .bind(id, row.status, target.status, String(account.id), action, cleanText(note, 2000) || null),
    db.prepare("INSERT INTO audit_logs (actor_user_id,action,entity_type,entity_id,metadata) VALUES (?,'moderation.decision','content',?,?)")
      .bind(account.id, String(id), JSON.stringify({ action, previousState: row.status, newState: target.status, note: cleanText(note, 2000) || null })),
  ];
  if(pendingRevision){
    const revisionState=action==="needs_changes"?"needs_changes":["reject","soft_delete"].includes(action)?"rejected":"approved";
    statements.push(db.prepare("UPDATE content_revisions SET moderation_status=?,moderator_id=?,moderator_note=? WHERE id=?").bind(revisionState,account.id,cleanText(note,2000)||null,pendingRevision.id));
    if(revisionInput&&(action==="publish"||action==="approve")){
      const revisionTitle=cleanText(revisionInput.title,240,true);const revisionExcerpt=richValue(revisionInput.excerpt,"Rezumat",6_000);const revisionSlug=await uniqueSlug(cleanText(revisionInput.slug||row.slug,120),revisionTitle,id);
      const revisionMedia={id:numberOrNull(revisionInput.primaryMediaId),alt:cleanText(revisionInput.primaryMediaAltText,500)||null,state:revisionInput.primaryMediaState||"none"};
      statements[0]=db.prepare("UPDATE content_records SET title=?,slug=?,excerpt=?,seo_title=?,seo_description=?,primary_media_id=?,primary_media_alt_text=?,primary_media_state=?,published_media_id=?,published_media_alt_text=?,published_media_state=?,status='published',moderation_state='approved',visibility='public',published_by=?,published_at=COALESCE(published_at,CURRENT_TIMESTAMP),published_snapshot=?,updated_at=CURRENT_TIMESTAMP,version=version+1 WHERE id=? AND version=?").bind(revisionTitle,revisionSlug,revisionExcerpt||null,cleanText(revisionInput.seoTitle,180)||null,cleanText(revisionInput.seoDescription,300)||null,revisionMedia.id,revisionMedia.alt,revisionMedia.state,revisionMedia.id,revisionMedia.alt,revisionMedia.state,account.id,JSON.stringify({...revisionInput,title:revisionTitle,slug:revisionSlug,excerpt:revisionExcerpt}),id,row.version);
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
