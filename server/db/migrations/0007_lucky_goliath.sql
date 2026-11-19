-- 「Info」(info) 欄改名為「Note」(note)：名稱還原（0004 曾把「備註」併入 info 並 DROP note，本欄沿用同一份資料），僅 RENAME，資料不動。
ALTER TABLE `contacts` RENAME COLUMN `info` TO `note`;
