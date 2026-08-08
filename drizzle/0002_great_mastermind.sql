ALTER TABLE `media_assets` ADD `business_id` integer;--> statement-breakpoint
CREATE INDEX `idx_media_assets_business_status` ON `media_assets` (`business_id`,`media_status`);