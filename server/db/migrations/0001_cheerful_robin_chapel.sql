CREATE TABLE `prospects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`contact_id` integer NOT NULL,
	`section` text NOT NULL,
	`date` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `prospects_user_id_idx` ON `prospects` (`user_id`);--> statement-breakpoint
CREATE INDEX `prospects_contact_id_idx` ON `prospects` (`contact_id`);