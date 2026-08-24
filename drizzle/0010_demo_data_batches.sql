CREATE TABLE `demo_data_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'creating' NOT NULL,
	`generator_version` text NOT NULL,
	`created_by` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`generated_at` text,
	`deleted_at` text,
	`error_summary` text,
	`content_count` integer DEFAULT 0 NOT NULL,
	`media_count` integer DEFAULT 0 NOT NULL,
	`operation_token` text,
	`operation_started_at` text,
	`cleanup_token` text,
	`cleanup_previewed_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `demo_data_batches_generator_version_unique` ON `demo_data_batches` (`generator_version`);
--> statement-breakpoint
CREATE INDEX `idx_demo_data_batches_status_updated` ON `demo_data_batches` (`status`,`updated_at`);
--> statement-breakpoint
CREATE TABLE `demo_data_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`batch_id` text NOT NULL,
	`seed_key` text NOT NULL,
	`content_id` integer,
	`entity_id` integer,
	`media_asset_id` integer,
	`r2_key` text NOT NULL,
	`content_type` text NOT NULL,
	`category` text NOT NULL,
	`fixture_hash` text NOT NULL,
	`cleanup_status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `demo_data_items_seed_key_unique` ON `demo_data_items` (`seed_key`);
--> statement-breakpoint
CREATE UNIQUE INDEX `demo_data_items_batch_content_unique` ON `demo_data_items` (`batch_id`,`content_id`);
--> statement-breakpoint
CREATE INDEX `idx_demo_data_items_batch_status` ON `demo_data_items` (`batch_id`,`cleanup_status`);
--> statement-breakpoint
CREATE INDEX `idx_demo_data_items_type_category` ON `demo_data_items` (`content_type`,`category`);
--> statement-breakpoint
INSERT OR IGNORE INTO `platform_settings` (`key`,`value`) VALUES ('demo_visibility','hidden');
--> statement-breakpoint
PRAGMA optimize;
