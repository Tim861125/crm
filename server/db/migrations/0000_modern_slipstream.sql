CREATE TABLE `contact_locations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`label` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `contact_locations_user_id_idx` ON `contact_locations` (`user_id`);--> statement-breakpoint
CREATE TABLE `contact_options` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`label` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `contact_options_user_id_idx` ON `contact_options` (`user_id`);--> statement-breakpoint
CREATE TABLE `contact_stages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`label` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `contact_stages_user_id_idx` ON `contact_stages` (`user_id`);--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`name` text NOT NULL,
	`location` text,
	`broached` integer DEFAULT false NOT NULL,
	`completed_stages` text DEFAULT '[]' NOT NULL,
	`contact` text,
	`friend_of` text,
	`dev_partner` text,
	`info` text,
	`level` text,
	`status` text,
	`follow_up_freq` text,
	`last_follow_up` text,
	`next_follow_up` text,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `contacts_user_id_idx` ON `contacts` (`user_id`);--> statement-breakpoint
CREATE INDEX `contacts_next_follow_up_idx` ON `contacts` (`next_follow_up`);--> statement-breakpoint
CREATE TABLE `follow_up_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`contact_id` integer NOT NULL,
	`date` text NOT NULL,
	`content` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `follow_up_logs_contact_id_idx` ON `follow_up_logs` (`contact_id`);