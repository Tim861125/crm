CREATE TABLE `dev_partner_options` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`label` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `dev_partner_options_user_id_idx` ON `dev_partner_options` (`user_id`);--> statement-breakpoint
CREATE TABLE `friend_of_options` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`label` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `friend_of_options_user_id_idx` ON `friend_of_options` (`user_id`);
--> statement-breakpoint
-- 回填：把既有名單用過的「誰的朋友」名字去重帶進選項表，換成下拉後原本用過的名字直接可選
INSERT INTO `friend_of_options` (`label`, `created_at`)
SELECT DISTINCT `friend_of`, strftime('%s', 'now') FROM `contacts`
WHERE `friend_of` IS NOT NULL AND `friend_of` != ''
ORDER BY `friend_of`;
--> statement-breakpoint
-- 回填：同上，「開發夥伴」
INSERT INTO `dev_partner_options` (`label`, `created_at`)
SELECT DISTINCT `dev_partner`, strftime('%s', 'now') FROM `contacts`
WHERE `dev_partner` IS NOT NULL AND `dev_partner` != ''
ORDER BY `dev_partner`;
