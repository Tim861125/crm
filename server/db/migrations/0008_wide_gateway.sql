CREATE TABLE `plans` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`name` text NOT NULL,
	`insight` text,
	`method` text,
	`content` text,
	`audience` text DEFAULT '[]' NOT NULL,
	`start_date` text,
	`end_date` text,
	`status` text DEFAULT 'planning' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `plans_user_id_idx` ON `plans` (`user_id`);