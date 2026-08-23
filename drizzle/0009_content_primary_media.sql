ALTER TABLE `content_records` ADD `primary_media_id` integer;--> statement-breakpoint
ALTER TABLE `content_records` ADD `primary_media_alt_text` text;--> statement-breakpoint
ALTER TABLE `content_records` ADD `primary_media_state` text DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
ALTER TABLE `content_records` ADD `published_media_id` integer;--> statement-breakpoint
ALTER TABLE `content_records` ADD `published_media_alt_text` text;--> statement-breakpoint
ALTER TABLE `content_records` ADD `published_media_state` text DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
ALTER TABLE `content_records` ADD `last_mutation_id` text;--> statement-breakpoint
ALTER TABLE `media_assets` ADD `width` integer;--> statement-breakpoint
ALTER TABLE `media_assets` ADD `height` integer;--> statement-breakpoint
ALTER TABLE `media_assets` ADD `upload_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `media_assets_upload_id_unique` ON `media_assets` (`upload_id`);--> statement-breakpoint
PRAGMA optimize;
