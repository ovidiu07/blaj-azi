import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const legacyAudit = {
  status: text("status").notNull().default("draft"),
  sourceUrl: text("source_url"),
  lastVerifiedAt: text("last_verified_at"),
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
  updatedAt: text("updated_at").notNull().default("CURRENT_TIMESTAMP"),
};

const now = sql`CURRENT_TIMESTAMP`;

export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    externalUserId: text("external_user_id").notNull(),
    email: text("email").notNull(),
    normalizedEmail: text("normalized_email").notNull(),
    displayName: text("display_name").notNull(),
    avatarUrl: text("avatar_url"),
    globalRole: text("global_role").notNull().default("user"),
    accountStatus: text("account_status").notNull().default("active"),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
    lastLoginAt: text("last_login_at").notNull().default(now),
    suspendedAt: text("suspended_at"),
    suspensionReason: text("suspension_reason"),
  },
  (table) => [
    uniqueIndex("users_external_user_id_unique").on(table.externalUserId),
    uniqueIndex("users_normalized_email_unique").on(table.normalizedEmail),
    index("idx_users_role_status").on(table.globalRole, table.accountStatus),
  ],
);

export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  type: text("type").notNull(),
});

export const businesses = sqliteTable(
  "businesses",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    categoryId: integer("category_id"),
    locality: text("locality").notNull(),
    address: text("address"),
    latitude: real("latitude"),
    longitude: real("longitude"),
    phone: text("phone"),
    website: text("website"),
    description: text("description"),
    verified: integer("verified", { mode: "boolean" }).notNull().default(false),
    creatorUserId: integer("creator_user_id"),
    moderationStatus: text("moderation_status").notNull().default("draft"),
    verificationStatus: text("verification_status").notNull().default("unverified"),
    verifiedAt: text("verified_at"),
    verifiedBy: integer("verified_by"),
    primaryImageId: integer("primary_image_id"),
    email: text("contact_email"),
    whatsapp: text("whatsapp"),
    socialLinks: text("social_links"),
    visibility: text("visibility").notNull().default("public"),
    archivedAt: text("archived_at"),
    deletedAt: text("deleted_at"),
    deletedBy: integer("deleted_by"),
    deletionReason: text("deletion_reason"),
    version: integer("version").notNull().default(1),
    isDemo: integer("is_demo", { mode: "boolean" }).notNull().default(false),
    ...legacyAudit,
  },
  (table) => [
    index("idx_businesses_public").on(table.status, table.visibility, table.deletedAt),
    index("idx_businesses_creator").on(table.creatorUserId),
  ],
);

export const businessHours = sqliteTable(
  "business_hours",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    businessId: integer("business_id").notNull(),
    weekday: integer("weekday").notNull(),
    opensAt: text("opens_at"),
    closesAt: text("closes_at"),
    closed: integer("closed", { mode: "boolean" }).notNull().default(false),
  },
  (table) => [uniqueIndex("business_hours_business_weekday_unique").on(table.businessId, table.weekday)],
);

export const businessMemberships = sqliteTable(
  "business_memberships",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    businessId: integer("business_id").notNull(),
    userId: integer("user_id"),
    inviteEmail: text("invite_email"),
    membershipRole: text("membership_role").notNull().default("manager"),
    membershipStatus: text("membership_status").notNull().default("invited"),
    permissions: text("permissions"),
    invitedBy: integer("invited_by"),
    invitedAt: text("invited_at").notNull().default(now),
    acceptedAt: text("accepted_at"),
    revokedAt: text("revoked_at"),
  },
  (table) => [
    uniqueIndex("business_memberships_business_user_unique").on(table.businessId, table.userId),
    index("idx_business_memberships_user_status").on(table.userId, table.membershipStatus),
    index("idx_business_memberships_invite_email").on(table.inviteEmail, table.membershipStatus),
  ],
);

export const businessClaims = sqliteTable(
  "business_claims",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    businessId: integer("business_id").notNull(),
    requesterUserId: integer("requester_user_id").notNull(),
    claimType: text("claim_type").notNull().default("existing_business"),
    explanation: text("explanation").notNull(),
    evidenceUrl: text("evidence_url"),
    contactInformation: text("contact_information"),
    status: text("status").notNull().default("pending_review"),
    reviewerId: integer("reviewer_id"),
    reviewerNote: text("reviewer_note"),
    submittedAt: text("submitted_at").notNull().default(now),
    reviewedAt: text("reviewed_at"),
  },
  (table) => [
    index("idx_business_claims_status_submitted").on(table.status, table.submittedAt),
    index("idx_business_claims_requester").on(table.requesterUserId),
    uniqueIndex("business_claims_active_unique")
      .on(table.businessId, table.requesterUserId)
      .where(sql`${table.status} IN ('pending_review', 'needs_changes')`),
  ],
);

export const contentRecords = sqliteTable(
  "content_records",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    type: text("type").notNull(),
    entityId: integer("entity_id"),
    title: text("title").notNull(),
    slug: text("slug").notNull().unique(),
    excerpt: text("excerpt"),
    ownerUserId: integer("owner_user_id"),
    businessId: integer("business_id"),
    status: text("status").notNull().default("draft"),
    moderationState: text("moderation_state").notNull().default("draft"),
    visibility: text("visibility").notNull().default("public"),
    featured: integer("featured", { mode: "boolean" }).notNull().default(false),
    promotedTier: text("promoted_tier"),
    isDemo: integer("is_demo", { mode: "boolean" }).notNull().default(false),
    createdBy: integer("created_by"),
    lastEditedBy: integer("last_edited_by"),
    publishedBy: integer("published_by"),
    submittedAt: text("submitted_at"),
    publishedAt: text("published_at"),
    scheduledAt: text("scheduled_at"),
    archivedAt: text("archived_at"),
    deletedAt: text("deleted_at"),
    deletedBy: integer("deleted_by"),
    deletionReason: text("deletion_reason"),
    expiresAt: text("expires_at"),
    publishedSnapshot: text("published_snapshot"),
    version: integer("version").notNull().default(1),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (table) => [
    index("idx_content_records_public").on(table.status, table.visibility, table.deletedAt, table.type),
    index("idx_content_records_owner_status").on(table.ownerUserId, table.status),
    index("idx_content_records_business_status").on(table.businessId, table.status),
    uniqueIndex("content_records_type_entity_unique").on(table.type, table.entityId),
  ],
);

export const posts = sqliteTable(
  "posts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    contentItemId: integer("content_item_id").notNull(),
    postType: text("post_type").notNull(),
    authorUserId: integer("author_user_id"),
    businessId: integer("business_id"),
    body: text("body").notNull(),
    coverMediaId: integer("cover_media_id"),
    categoryId: integer("category_id"),
    locality: text("locality"),
    sourceInformation: text("source_information"),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
  },
  (table) => [
    uniqueIndex("posts_content_item_unique").on(table.contentItemId),
    index("idx_posts_type_business").on(table.postType, table.businessId),
  ],
);

export const contentRevisions = sqliteTable(
  "content_revisions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    entityType: text("entity_type").notNull(),
    entityId: integer("entity_id").notNull(),
    revisionNumber: integer("revision_number").notNull(),
    snapshot: text("snapshot").notNull(),
    createdBy: integer("created_by").notNull(),
    createdAt: text("created_at").notNull().default(now),
    moderationStatus: text("moderation_status").notNull().default("draft"),
    moderatorId: integer("moderator_id"),
    moderatorNote: text("moderator_note"),
  },
  (table) => [
    uniqueIndex("content_revisions_entity_number_unique").on(table.entityType, table.entityId, table.revisionNumber),
    index("idx_content_revisions_moderation").on(table.moderationStatus, table.createdAt),
  ],
);

export const events = sqliteTable("events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(), slug: text("slug").notNull().unique(), categoryId: integer("category_id"), organizer: text("organizer"), locality: text("locality").notNull(), venue: text("venue"), startsAt: text("starts_at").notNull(), endsAt: text("ends_at"), ticketInfo: text("ticket_info"), description: text("description"), familyFriendly: integer("family_friendly", { mode: "boolean" }).notNull().default(false), accessibility: text("accessibility"), address: text("address"), imageUrl: text("image_url"), ...legacyAudit,
});
export const offers = sqliteTable("offers", { id: integer("id").primaryKey({ autoIncrement: true }), businessId: integer("business_id"), title: text("title").notNull(), slug: text("slug").notNull().unique(), startsAt: text("starts_at").notNull(), endsAt: text("ends_at").notNull(), price: real("price"), oldPrice: real("old_price"), terms: text("terms"), description: text("description"), availability: text("availability"), imageUrl: text("image_url"), ...legacyAudit });
export const restaurants = sqliteTable("restaurants", { id: integer("id").primaryKey({ autoIncrement: true }), businessId: integer("business_id"), name: text("name").notNull(), slug: text("slug").notNull().unique(), cuisine: text("cuisine"), delivery: integer("delivery", { mode: "boolean" }).notNull().default(false), pickup: integer("pickup", { mode: "boolean" }).notNull().default(false), dietaryOptions: text("dietary_options"), description: text("description"), imageUrl: text("image_url"), ...legacyAudit });
export const dailyMenus = sqliteTable("daily_menus", { id: integer("id").primaryKey({ autoIncrement: true }), restaurantId: integer("restaurant_id").notNull(), menuDate: text("menu_date").notNull(), soup: text("soup"), mainDish: text("main_dish"), sideDish: text("side_dish"), dessert: text("dessert"), price: real("price"), orderDeadline: text("order_deadline"), availability: text("availability").notNull().default("active"), ownerUserId: integer("owner_user_id"), status: text("status").notNull().default("draft"), version: integer("version").notNull().default(1), updatedAt: text("updated_at").notNull().default("CURRENT_TIMESTAMP") });
export const jobs = sqliteTable("jobs", { id: integer("id").primaryKey({ autoIncrement: true }), businessId: integer("business_id"), title: text("title").notNull(), slug: text("slug").notNull().unique(), company: text("company").notNull(), locality: text("locality").notNull(), contractType: text("contract_type"), workArrangement: text("work_arrangement"), schedule: text("schedule"), shift: text("shift"), salaryMin: real("salary_min"), salaryMax: real("salary_max"), transportProvided: integer("transport_provided", { mode: "boolean" }).notNull().default(false), responsibilities: text("responsibilities"), requirements: text("requirements"), benefits: text("benefits"), applyUrl: text("apply_url"), applicationMethod: text("application_method"), deadline: text("deadline"), ...legacyAudit });
export const places = sqliteTable("places", { id: integer("id").primaryKey({ autoIncrement: true }), title: text("title").notNull(), slug: text("slug").notNull().unique(), address: text("address"), description: text("description"), accessibility: text("accessibility"), locality: text("locality"), imageUrl: text("image_url"), ...legacyAudit });
export const articles = sqliteTable("articles", { id: integer("id").primaryKey({ autoIncrement: true }), title: text("title").notNull(), slug: text("slug").notNull().unique(), author: text("author"), body: text("body").notNull(), publishedAt: text("published_at"), excerpt: text("excerpt"), categoryId: integer("category_id"), locality: text("locality"), coverMediaId: integer("cover_media_id"), ...legacyAudit });

export const mediaAssets = sqliteTable(
  "media_assets",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    r2Key: text("r2_key"), title: text("title"), description: text("description"), photographer: text("photographer"), sourceUrl: text("source_url"), license: text("license"), altText: text("alt_text"), location: text("location"), category: text("category"), featured: integer("featured", { mode: "boolean" }).notNull().default(false),
    ownerUserId: integer("owner_user_id"), originalFilename: text("original_filename"), mimeType: text("mime_type"), sizeBytes: integer("size_bytes"), approvalStatus: text("approval_status").notNull().default("pending"), mediaStatus: text("media_status").notNull().default("active"), archivedAt: text("archived_at"), orphanedAt: text("orphaned_at"), createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
  },
  (table) => [index("idx_media_assets_owner_status").on(table.ownerUserId, table.mediaStatus, table.approvalStatus)],
);

export const submissions = sqliteTable("submissions", { id: integer("id").primaryKey({ autoIncrement: true }), type: text("type").notNull(), contributorName: text("contributor_name"), email: text("email").notNull(), title: text("title"), locality: text("locality"), category: text("category"), description: text("description"), sourceUrl: text("source_url"), mediaKey: text("media_key"), rightsConfirmed: integer("rights_confirmed", { mode: "boolean" }).notNull().default(false), consent: integer("consent", { mode: "boolean" }).notNull(), status: text("status").notNull().default("pending_review"), userId: integer("user_id"), contentItemId: integer("content_item_id"), createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP") });

export const moderationRecords = sqliteTable("moderation_records", { id: integer("id").primaryKey({ autoIncrement: true }), submissionId: integer("submission_id").notNull(), entityType: text("entity_type"), entityId: integer("entity_id"), previousState: text("previous_state"), newState: text("new_state"), moderatorId: text("moderator_id").notNull(), assignedTo: integer("assigned_to"), action: text("action").notNull(), note: text("note"), createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP") });

export const auditLogs = sqliteTable(
  "audit_logs",
  { id: integer("id").primaryKey({ autoIncrement: true }), actorUserId: integer("actor_user_id"), action: text("action").notNull(), entityType: text("entity_type").notNull(), entityId: text("entity_id"), metadata: text("metadata"), securityContext: text("security_context"), createdAt: text("created_at").notNull().default(now) },
  (table) => [index("idx_audit_logs_entity_created").on(table.entityType, table.entityId, table.createdAt), index("idx_audit_logs_actor_created").on(table.actorUserId, table.createdAt)],
);

export const notifications = sqliteTable(
  "notifications",
  { id: integer("id").primaryKey({ autoIncrement: true }), userId: integer("user_id").notNull(), notificationType: text("notification_type").notNull(), title: text("title").notNull(), message: text("message").notNull(), relatedEntityType: text("related_entity_type"), relatedEntityId: text("related_entity_id"), href: text("href"), readAt: text("read_at"), createdAt: text("created_at").notNull().default(now) },
  (table) => [index("idx_notifications_user_read_created").on(table.userId, table.readAt, table.createdAt)],
);

export const newsletterSubscriptions = sqliteTable("newsletter_subscriptions", { id: integer("id").primaryKey({ autoIncrement: true }), email: text("email").notNull().unique(), interests: text("interests"), consentAt: text("consent_at").notNull().default("CURRENT_TIMESTAMP"), status: text("status").notNull().default("pending_confirmation") });
export const promotedPlacements = sqliteTable("promoted_placements", { id: integer("id").primaryKey({ autoIncrement: true }), entityType: text("entity_type").notNull(), entityId: integer("entity_id").notNull(), tier: text("tier").notNull(), startsAt: text("starts_at").notNull(), endsAt: text("ends_at").notNull(), status: text("status").notNull().default("scheduled") });
export const contactMessages = sqliteTable("contact_messages", { id: integer("id").primaryKey({ autoIncrement: true }), name: text("name"), email: text("email").notNull(), message: text("message").notNull(), status: text("status").notNull().default("new"), createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP") });
export const contentReports = sqliteTable("content_reports", { id: integer("id").primaryKey({ autoIncrement: true }), entityType: text("entity_type"), entityId: integer("entity_id"), email: text("email"), reason: text("reason").notNull(), reporterUserId: integer("reporter_user_id"), assignedTo: integer("assigned_to"), resolutionNote: text("resolution_note"), status: text("status").notNull().default("new"), createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP") });

export const roleHistory = sqliteTable(
  "role_history",
  { id: integer("id").primaryKey({ autoIncrement: true }), userId: integer("user_id").notNull(), previousRole: text("previous_role"), newRole: text("new_role").notNull(), changedBy: integer("changed_by").notNull(), reason: text("reason"), createdAt: text("created_at").notNull().default(now) },
  (table) => [index("idx_role_history_user_created").on(table.userId, table.createdAt)],
);

export const platformSettings = sqliteTable("platform_settings", { key: text("key").primaryKey(), value: text("value").notNull(), updatedBy: integer("updated_by"), updatedAt: text("updated_at").notNull().default(now) });
