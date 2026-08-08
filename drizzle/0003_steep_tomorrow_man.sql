ALTER TABLE `media_assets` ADD `content_id` integer;--> statement-breakpoint
CREATE INDEX `idx_media_assets_content_status` ON `media_assets` (`content_id`,`media_status`,`approval_status`);