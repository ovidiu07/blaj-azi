ALTER TABLE `submissions` ADD `payload` text;--> statement-breakpoint
UPDATE `content_records` SET `is_demo`=0 WHERE `type`='place' AND `entity_id` IN (SELECT `id` FROM `places` WHERE `source_url` IS NOT NULL AND trim(`source_url`)!='');--> statement-breakpoint
UPDATE `articles` SET `created_at`=CURRENT_TIMESTAMP WHERE `created_at`='CURRENT_TIMESTAMP';--> statement-breakpoint
UPDATE `articles` SET `updated_at`=CURRENT_TIMESTAMP WHERE `updated_at`='CURRENT_TIMESTAMP';--> statement-breakpoint
UPDATE `businesses` SET `created_at`=CURRENT_TIMESTAMP WHERE `created_at`='CURRENT_TIMESTAMP';--> statement-breakpoint
UPDATE `businesses` SET `updated_at`=CURRENT_TIMESTAMP WHERE `updated_at`='CURRENT_TIMESTAMP';--> statement-breakpoint
UPDATE `events` SET `created_at`=CURRENT_TIMESTAMP WHERE `created_at`='CURRENT_TIMESTAMP';--> statement-breakpoint
UPDATE `events` SET `updated_at`=CURRENT_TIMESTAMP WHERE `updated_at`='CURRENT_TIMESTAMP';--> statement-breakpoint
UPDATE `offers` SET `created_at`=CURRENT_TIMESTAMP WHERE `created_at`='CURRENT_TIMESTAMP';--> statement-breakpoint
UPDATE `offers` SET `updated_at`=CURRENT_TIMESTAMP WHERE `updated_at`='CURRENT_TIMESTAMP';--> statement-breakpoint
UPDATE `restaurants` SET `created_at`=CURRENT_TIMESTAMP WHERE `created_at`='CURRENT_TIMESTAMP';--> statement-breakpoint
UPDATE `restaurants` SET `updated_at`=CURRENT_TIMESTAMP WHERE `updated_at`='CURRENT_TIMESTAMP';--> statement-breakpoint
UPDATE `jobs` SET `created_at`=CURRENT_TIMESTAMP WHERE `created_at`='CURRENT_TIMESTAMP';--> statement-breakpoint
UPDATE `jobs` SET `updated_at`=CURRENT_TIMESTAMP WHERE `updated_at`='CURRENT_TIMESTAMP';--> statement-breakpoint
UPDATE `places` SET `created_at`=CURRENT_TIMESTAMP WHERE `created_at`='CURRENT_TIMESTAMP';--> statement-breakpoint
UPDATE `places` SET `updated_at`=CURRENT_TIMESTAMP WHERE `updated_at`='CURRENT_TIMESTAMP';--> statement-breakpoint
UPDATE `daily_menus` SET `updated_at`=CURRENT_TIMESTAMP WHERE `updated_at`='CURRENT_TIMESTAMP';--> statement-breakpoint
UPDATE `media_assets` SET `created_at`=CURRENT_TIMESTAMP WHERE `created_at`='CURRENT_TIMESTAMP';--> statement-breakpoint
UPDATE `submissions` SET `created_at`=CURRENT_TIMESTAMP WHERE `created_at`='CURRENT_TIMESTAMP';--> statement-breakpoint
UPDATE `moderation_records` SET `created_at`=CURRENT_TIMESTAMP WHERE `created_at`='CURRENT_TIMESTAMP';--> statement-breakpoint
UPDATE `contact_messages` SET `created_at`=CURRENT_TIMESTAMP WHERE `created_at`='CURRENT_TIMESTAMP';--> statement-breakpoint
UPDATE `content_reports` SET `created_at`=CURRENT_TIMESTAMP WHERE `created_at`='CURRENT_TIMESTAMP';--> statement-breakpoint
UPDATE `newsletter_subscriptions` SET `consent_at`=CURRENT_TIMESTAMP WHERE `consent_at`='CURRENT_TIMESTAMP';--> statement-breakpoint
CREATE INDEX `idx_content_records_public_discovery` ON `content_records` (`type`,`status`,`visibility`,`is_demo`,`expires_at`,`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_events_public_dates` ON `events` (`starts_at`,`ends_at`);--> statement-breakpoint
CREATE INDEX `idx_offers_public_dates` ON `offers` (`starts_at`,`ends_at`);--> statement-breakpoint
CREATE INDEX `idx_jobs_public_deadline` ON `jobs` (`deadline`);--> statement-breakpoint
PRAGMA optimize;
