ALTER TABLE `session` ADD `path` text;--> statement-breakpoint
ALTER TABLE `session` ADD `workspace_id` text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `session_path_idx` ON `session` (`path`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `session_workspace_idx` ON `session` (`workspace_id`);