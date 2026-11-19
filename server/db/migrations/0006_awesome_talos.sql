CREATE TABLE `goal_options` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`label` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `goal_options_user_id_idx` ON `goal_options` (`user_id`);--> statement-breakpoint
ALTER TABLE `contacts` ADD `goal` text;