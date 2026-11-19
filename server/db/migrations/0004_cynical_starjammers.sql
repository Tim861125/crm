-- 「備註」(note) 整欄併入 Info (info)：兩邊都有值時新人資訊在上、備註另起一行接在後面；再 DROP note 欄。
UPDATE `contacts`
SET `info` = CASE
  WHEN `info` IS NULL OR `info` = '' THEN `note`
  ELSE `info` || char(10) || `note`
END
WHERE `note` IS NOT NULL AND `note` != '';
--> statement-breakpoint
ALTER TABLE `contacts` DROP COLUMN `note`;
