CREATE TABLE `audit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`actor_user_id` integer,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text,
	`metadata` text,
	`security_context` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_audit_logs_entity_created` ON `audit_logs` (`entity_type`,`entity_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_audit_logs_actor_created` ON `audit_logs` (`actor_user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `business_claims` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`business_id` integer NOT NULL,
	`requester_user_id` integer NOT NULL,
	`claim_type` text DEFAULT 'existing_business' NOT NULL,
	`explanation` text NOT NULL,
	`evidence_url` text,
	`contact_information` text,
	`status` text DEFAULT 'pending_review' NOT NULL,
	`reviewer_id` integer,
	`reviewer_note` text,
	`submitted_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`reviewed_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_business_claims_status_submitted` ON `business_claims` (`status`,`submitted_at`);--> statement-breakpoint
CREATE INDEX `idx_business_claims_requester` ON `business_claims` (`requester_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `business_claims_active_unique` ON `business_claims` (`business_id`,`requester_user_id`) WHERE "business_claims"."status" IN ('pending_review', 'needs_changes');--> statement-breakpoint
CREATE TABLE `business_memberships` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`business_id` integer NOT NULL,
	`user_id` integer,
	`invite_email` text,
	`membership_role` text DEFAULT 'manager' NOT NULL,
	`membership_status` text DEFAULT 'invited' NOT NULL,
	`permissions` text,
	`invited_by` integer,
	`invited_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`accepted_at` text,
	`revoked_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `business_memberships_business_user_unique` ON `business_memberships` (`business_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `idx_business_memberships_user_status` ON `business_memberships` (`user_id`,`membership_status`);--> statement-breakpoint
CREATE INDEX `idx_business_memberships_invite_email` ON `business_memberships` (`invite_email`,`membership_status`);--> statement-breakpoint
CREATE TABLE `content_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`entity_id` integer,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`excerpt` text,
	`owner_user_id` integer,
	`business_id` integer,
	`status` text DEFAULT 'draft' NOT NULL,
	`moderation_state` text DEFAULT 'draft' NOT NULL,
	`visibility` text DEFAULT 'public' NOT NULL,
	`featured` integer DEFAULT false NOT NULL,
	`promoted_tier` text,
	`is_demo` integer DEFAULT false NOT NULL,
	`created_by` integer,
	`last_edited_by` integer,
	`published_by` integer,
	`submitted_at` text,
	`published_at` text,
	`scheduled_at` text,
	`archived_at` text,
	`deleted_at` text,
	`deleted_by` integer,
	`deletion_reason` text,
	`expires_at` text,
	`published_snapshot` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `content_records_slug_unique` ON `content_records` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_content_records_public` ON `content_records` (`status`,`visibility`,`deleted_at`,`type`);--> statement-breakpoint
CREATE INDEX `idx_content_records_owner_status` ON `content_records` (`owner_user_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_content_records_business_status` ON `content_records` (`business_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `content_records_type_entity_unique` ON `content_records` (`type`,`entity_id`);--> statement-breakpoint
CREATE TABLE `content_revisions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` integer NOT NULL,
	`revision_number` integer NOT NULL,
	`snapshot` text NOT NULL,
	`created_by` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`moderation_status` text DEFAULT 'draft' NOT NULL,
	`moderator_id` integer,
	`moderator_note` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `content_revisions_entity_number_unique` ON `content_revisions` (`entity_type`,`entity_id`,`revision_number`);--> statement-breakpoint
CREATE INDEX `idx_content_revisions_moderation` ON `content_revisions` (`moderation_status`,`created_at`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`notification_type` text NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`related_entity_type` text,
	`related_entity_id` text,
	`href` text,
	`read_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_notifications_user_read_created` ON `notifications` (`user_id`,`read_at`,`created_at`);--> statement-breakpoint
CREATE TABLE `platform_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_by` integer,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `posts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`content_item_id` integer NOT NULL,
	`post_type` text NOT NULL,
	`author_user_id` integer,
	`business_id` integer,
	`body` text NOT NULL,
	`cover_media_id` integer,
	`category_id` integer,
	`locality` text,
	`source_information` text,
	`seo_title` text,
	`seo_description` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `posts_content_item_unique` ON `posts` (`content_item_id`);--> statement-breakpoint
CREATE INDEX `idx_posts_type_business` ON `posts` (`post_type`,`business_id`);--> statement-breakpoint
CREATE TABLE `role_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`previous_role` text,
	`new_role` text NOT NULL,
	`changed_by` integer NOT NULL,
	`reason` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_role_history_user_created` ON `role_history` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`external_user_id` text NOT NULL,
	`email` text NOT NULL,
	`normalized_email` text NOT NULL,
	`display_name` text NOT NULL,
	`avatar_url` text,
	`global_role` text DEFAULT 'user' NOT NULL,
	`account_status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_login_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`suspended_at` text,
	`suspension_reason` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_external_user_id_unique` ON `users` (`external_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_normalized_email_unique` ON `users` (`normalized_email`);--> statement-breakpoint
CREATE INDEX `idx_users_role_status` ON `users` (`global_role`,`account_status`);--> statement-breakpoint
ALTER TABLE `articles` ADD `excerpt` text;--> statement-breakpoint
ALTER TABLE `articles` ADD `category_id` integer;--> statement-breakpoint
ALTER TABLE `articles` ADD `locality` text;--> statement-breakpoint
ALTER TABLE `articles` ADD `cover_media_id` integer;--> statement-breakpoint
ALTER TABLE `businesses` ADD `creator_user_id` integer;--> statement-breakpoint
ALTER TABLE `businesses` ADD `moderation_status` text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE `businesses` ADD `verification_status` text DEFAULT 'unverified' NOT NULL;--> statement-breakpoint
ALTER TABLE `businesses` ADD `verified_at` text;--> statement-breakpoint
ALTER TABLE `businesses` ADD `verified_by` integer;--> statement-breakpoint
ALTER TABLE `businesses` ADD `primary_image_id` integer;--> statement-breakpoint
ALTER TABLE `businesses` ADD `contact_email` text;--> statement-breakpoint
ALTER TABLE `businesses` ADD `whatsapp` text;--> statement-breakpoint
ALTER TABLE `businesses` ADD `social_links` text;--> statement-breakpoint
ALTER TABLE `businesses` ADD `visibility` text DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE `businesses` ADD `archived_at` text;--> statement-breakpoint
ALTER TABLE `businesses` ADD `deleted_at` text;--> statement-breakpoint
ALTER TABLE `businesses` ADD `deleted_by` integer;--> statement-breakpoint
ALTER TABLE `businesses` ADD `deletion_reason` text;--> statement-breakpoint
ALTER TABLE `businesses` ADD `version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `businesses` ADD `is_demo` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_businesses_public` ON `businesses` (`status`,`visibility`,`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_businesses_creator` ON `businesses` (`creator_user_id`);--> statement-breakpoint
ALTER TABLE `content_reports` ADD `reporter_user_id` integer;--> statement-breakpoint
ALTER TABLE `content_reports` ADD `assigned_to` integer;--> statement-breakpoint
ALTER TABLE `content_reports` ADD `resolution_note` text;--> statement-breakpoint
ALTER TABLE `daily_menus` ADD `owner_user_id` integer;--> statement-breakpoint
ALTER TABLE `daily_menus` ADD `status` text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE `daily_menus` ADD `version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `events` ADD `family_friendly` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `events` ADD `accessibility` text;--> statement-breakpoint
ALTER TABLE `events` ADD `address` text;--> statement-breakpoint
ALTER TABLE `events` ADD `image_url` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `work_arrangement` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `shift` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `responsibilities` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `requirements` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `benefits` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `application_method` text;--> statement-breakpoint
ALTER TABLE `media_assets` ADD `owner_user_id` integer;--> statement-breakpoint
ALTER TABLE `media_assets` ADD `original_filename` text;--> statement-breakpoint
ALTER TABLE `media_assets` ADD `mime_type` text;--> statement-breakpoint
ALTER TABLE `media_assets` ADD `size_bytes` integer;--> statement-breakpoint
ALTER TABLE `media_assets` ADD `approval_status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `media_assets` ADD `media_status` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `media_assets` ADD `archived_at` text;--> statement-breakpoint
ALTER TABLE `media_assets` ADD `orphaned_at` text;--> statement-breakpoint
CREATE INDEX `idx_media_assets_owner_status` ON `media_assets` (`owner_user_id`,`media_status`,`approval_status`);--> statement-breakpoint
ALTER TABLE `moderation_records` ADD `entity_type` text;--> statement-breakpoint
ALTER TABLE `moderation_records` ADD `entity_id` integer;--> statement-breakpoint
ALTER TABLE `moderation_records` ADD `previous_state` text;--> statement-breakpoint
ALTER TABLE `moderation_records` ADD `new_state` text;--> statement-breakpoint
ALTER TABLE `moderation_records` ADD `assigned_to` integer;--> statement-breakpoint
ALTER TABLE `offers` ADD `description` text;--> statement-breakpoint
ALTER TABLE `offers` ADD `availability` text;--> statement-breakpoint
ALTER TABLE `offers` ADD `image_url` text;--> statement-breakpoint
ALTER TABLE `places` ADD `locality` text;--> statement-breakpoint
ALTER TABLE `places` ADD `image_url` text;--> statement-breakpoint
ALTER TABLE `restaurants` ADD `description` text;--> statement-breakpoint
ALTER TABLE `restaurants` ADD `image_url` text;--> statement-breakpoint
ALTER TABLE `submissions` ADD `user_id` integer;--> statement-breakpoint
ALTER TABLE `submissions` ADD `content_item_id` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `business_hours_business_weekday_unique` ON `business_hours` (`business_id`,`weekday`);--> statement-breakpoint
INSERT OR IGNORE INTO `categories` (`name`,`slug`,`type`) VALUES
('Copii','copii','event'),('Comunitate','comunitate','event'),('Cultură','cultura','event'),
('Reparații și amenajări','reparatii-si-amenajari','business'),('Sănătate','sanatate','business'),('Auto','auto','business'),('Educație și meditații','educatie-si-meditatii','business'),
('Povești locale','povesti-locale','post'),('Actualizări de afaceri','actualizari-afaceri','post');--> statement-breakpoint
INSERT OR IGNORE INTO `businesses` (`name`,`slug`,`category_id`,`locality`,`phone`,`description`,`verified`,`moderation_status`,`verification_status`,`visibility`,`is_demo`,`status`,`source_url`,`last_verified_at`) VALUES
('Atelierul de Acasă','atelierul-de-acasa',(SELECT id FROM categories WHERE slug='reparatii-si-amenajari'),'Blaj','07xx xxx xxx','Listare ilustrativă pentru demonstrarea platformei.',0,'approved','unverified','public',1,'published',NULL,'2026-08-08'),
('Cabinet Pediatrie Central','cabinet-pediatrie',(SELECT id FROM categories WHERE slug='sanatate'),'Blaj','07xx xxx xxx','Listare ilustrativă pentru demonstrarea platformei.',0,'approved','unverified','public',1,'published',NULL,'2026-08-08'),
('Service Auto Târnave','service-auto-tarnave',(SELECT id FROM categories WHERE slug='auto'),'Sâncel','07xx xxx xxx','Listare ilustrativă pentru demonstrarea platformei.',0,'approved','unverified','public',1,'published',NULL,'2026-08-08'),
('Lecții cu Ana','lectii-cu-ana',(SELECT id FROM categories WHERE slug='educatie-si-meditatii'),'Blaj','07xx xxx xxx','Listare ilustrativă pentru demonstrarea platformei.',0,'approved','unverified','public',1,'published',NULL,'2026-08-08');--> statement-breakpoint
INSERT OR IGNORE INTO `events` (`title`,`slug`,`category_id`,`organizer`,`locality`,`venue`,`starts_at`,`ticket_info`,`description`,`family_friendly`,`image_url`,`status`,`last_verified_at`) VALUES
('Atelierul micilor exploratori','atelier-micilor-exploratori',(SELECT id FROM categories WHERE slug='copii'),'Organizator demonstrativ','Blaj','Spațiu comunitar — locație demonstrativă','2026-08-15T10:30:00+03:00','Gratuit','Eveniment demonstrativ, neconfirmat public.',1,'/images/campia-libertatii.jpg','published','2026-08-08'),
('Seară de film în aer liber','seara-de-film',(SELECT id FROM categories WHERE slug='comunitate'),'Organizator demonstrativ','Blaj','Blaj — locație în curs de confirmare','2026-08-22T20:30:00+03:00','Acces liber','Eveniment demonstrativ, neconfirmat public.',1,'/images/palatul-cultural.jpg','published','2026-08-08'),
('Tur de arhitectură: centrul vechi','tur-arhitectura',(SELECT id FROM categories WHERE slug='cultura'),'Organizator demonstrativ','Blaj','Piața 1848 — punct demonstrativ','2026-08-29T11:00:00+03:00','Pe bază de înscriere','Eveniment demonstrativ, neconfirmat public.',0,'/images/catedrala-blaj.jpg','published','2026-08-08');--> statement-breakpoint
INSERT OR IGNORE INTO `offers` (`business_id`,`title`,`slug`,`starts_at`,`ends_at`,`price`,`old_price`,`terms`,`description`,`availability`,`status`,`last_verified_at`) VALUES
(NULL,'Revizie de bază pentru bicicletă','revizie-bicicleta','2026-08-01','2026-08-31',79,99,'În limita locurilor disponibile.','Ofertă demonstrativă.','active','published','2026-08-08'),
(NULL,'Pachet de prânz pentru familie','meniu-familie','2026-08-01','2026-08-24',109,129,'Comandă în avans.','Ofertă demonstrativă.','active','published','2026-08-08'),
(NULL,'Mini-ședință foto de familie','sedinta-foto','2026-08-01','2026-09-30',180,220,'Cu programare.','Ofertă demonstrativă.','active','published','2026-08-08');--> statement-breakpoint
INSERT OR IGNORE INTO `restaurants` (`business_id`,`name`,`slug`,`cuisine`,`delivery`,`pickup`,`dietary_options`,`description`,`status`,`last_verified_at`) VALUES
(NULL,'Bucătărie de Blaj','bucatarie-de-blaj','Meniul zilei',1,1,NULL,'Restaurant demonstrativ.','published','2026-08-08'),
(NULL,'Cafeneaua din Piață','cafeneaua-din-piata','Cafenea',0,1,NULL,'Cafenea demonstrativă.','published','2026-08-08'),
(NULL,'Cuptorul Bun','cuptorul-bun','Brutărie',0,1,NULL,'Brutărie demonstrativă.','published','2026-08-08');--> statement-breakpoint
INSERT OR IGNORE INTO `daily_menus` (`restaurant_id`,`menu_date`,`soup`,`main_dish`,`price`,`availability`,`status`) SELECT id,'2026-08-08','Ciorbă de legume','Pui la cuptor cu cartofi',34,'active','published' FROM restaurants WHERE slug='bucatarie-de-blaj';--> statement-breakpoint
INSERT OR IGNORE INTO `jobs` (`business_id`,`title`,`slug`,`company`,`locality`,`contract_type`,`schedule`,`shift`,`salary_min`,`salary_max`,`transport_provided`,`responsibilities`,`deadline`,`status`,`last_verified_at`) VALUES
(NULL,'Operator producție','operator-productie','Companie demonstrativă','Blaj','Normă întreagă','Schimburi','Schimburi',NULL,NULL,1,'Oportunitate demonstrativă.','2026-09-15','published','2026-08-08'),
(NULL,'Asistent vânzări','asistent-vanzari','Magazin local demonstrativ','Blaj','Normă întreagă','Program în ture','Ture',3500,4000,0,'Oportunitate demonstrativă.','2026-09-10','published','2026-08-08'),
(NULL,'Contabil junior','contabil-junior','Birou demonstrativ','Jidvei','Part-time','Flexibil','Flexibil',NULL,NULL,0,'Oportunitate demonstrativă.','2026-09-30','published','2026-08-08');--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`title`,`slug`,`address`,`description`,`accessibility`,`locality`,`image_url`,`status`,`source_url`,`last_verified_at`) VALUES
('Câmpia Libertății','campia-libertatii',NULL,'Un reper major al orașului, prezentat pe pagina oficială de obiective locale a Municipiului Blaj.',NULL,'Blaj','/images/campia-libertatii.jpg','published','https://municipiulblaj.ro/comunitate/obiective-locale','2026-08-08'),
('Catedrala „Sfânta Treime”','catedrala-sfanta-treime',NULL,'Unul dintre reperele arhitecturale și spirituale centrale ale Blajului.',NULL,'Blaj','/images/catedrala-blaj.jpg','published','https://municipiulblaj.ro/comunitate/obiective-locale','2026-08-08'),
('Palatul Cultural','palatul-cultural',NULL,'Spațiu cultural al orașului, inclus în lista oficială a obiectivelor locale.',NULL,'Blaj','/images/palatul-cultural.jpg','published','https://municipiulblaj.ro/comunitate/obiective-locale','2026-08-08'),
('Blajul anului 1848','adunarea-1848',NULL,'O imagine istorică aflată în domeniul public, păstrată în colecția Wikimedia Commons.',NULL,'Blaj','/images/blaj-1848.jpg','published','https://commons.wikimedia.org/wiki/File:Blaj1848.jpg','2026-08-08');--> statement-breakpoint
INSERT OR IGNORE INTO `content_records` (`type`,`entity_id`,`title`,`slug`,`excerpt`,`status`,`moderation_state`,`visibility`,`featured`,`is_demo`,`published_at`,`published_snapshot`) SELECT 'business',id,name,slug,description,'published','approved','public',CASE WHEN slug='atelierul-de-acasa' THEN 1 ELSE 0 END,1,'2026-08-08T09:00:00+03:00',json_object('title',name,'description',description,'locality',locality) FROM businesses WHERE is_demo=1;--> statement-breakpoint
INSERT OR IGNORE INTO `content_records` (`type`,`entity_id`,`title`,`slug`,`excerpt`,`status`,`moderation_state`,`visibility`,`is_demo`,`published_at`,`published_snapshot`) SELECT 'event',id,title,slug,description,'published','approved','public',1,'2026-08-08T09:00:00+03:00',json_object('title',title,'description',description,'locality',locality,'startsAt',starts_at) FROM events WHERE slug IN ('atelier-micilor-exploratori','seara-de-film','tur-arhitectura');--> statement-breakpoint
INSERT OR IGNORE INTO `content_records` (`type`,`entity_id`,`title`,`slug`,`excerpt`,`business_id`,`status`,`moderation_state`,`visibility`,`is_demo`,`published_at`,`published_snapshot`) SELECT 'offer',id,title,slug,description,business_id,'published','approved','public',1,'2026-08-08T09:00:00+03:00',json_object('title',title,'description',description,'startsAt',starts_at,'endsAt',ends_at) FROM offers WHERE slug IN ('revizie-bicicleta','meniu-familie','sedinta-foto');--> statement-breakpoint
INSERT OR IGNORE INTO `content_records` (`type`,`entity_id`,`title`,`slug`,`excerpt`,`business_id`,`status`,`moderation_state`,`visibility`,`is_demo`,`published_at`,`published_snapshot`) SELECT 'restaurant',id,name,slug,description,business_id,'published','approved','public',1,'2026-08-08T09:00:00+03:00',json_object('title',name,'description',description) FROM restaurants WHERE slug IN ('bucatarie-de-blaj','cafeneaua-din-piata','cuptorul-bun');--> statement-breakpoint
INSERT OR IGNORE INTO `content_records` (`type`,`entity_id`,`title`,`slug`,`excerpt`,`business_id`,`status`,`moderation_state`,`visibility`,`is_demo`,`published_at`,`published_snapshot`) SELECT 'job',id,title,slug,responsibilities,business_id,'published','approved','public',1,'2026-08-08T09:00:00+03:00',json_object('title',title,'description',responsibilities,'locality',locality,'company',company) FROM jobs WHERE slug IN ('operator-productie','asistent-vanzari','contabil-junior');--> statement-breakpoint
INSERT OR IGNORE INTO `content_records` (`type`,`entity_id`,`title`,`slug`,`excerpt`,`status`,`moderation_state`,`visibility`,`is_demo`,`published_at`,`published_snapshot`) SELECT 'place',id,title,slug,description,'published','approved','public',1,'2026-08-08T09:00:00+03:00',json_object('title',title,'description',description,'locality',locality,'sourceUrl',source_url) FROM places WHERE slug IN ('campia-libertatii','catedrala-sfanta-treime','palatul-cultural','adunarea-1848');--> statement-breakpoint
INSERT OR IGNORE INTO `platform_settings` (`key`,`value`) VALUES ('content_retention_days','30'),('media_orphan_retention_days','7');--> statement-breakpoint
PRAGMA optimize;
