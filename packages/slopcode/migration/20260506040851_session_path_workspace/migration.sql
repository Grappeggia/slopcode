ALTER TABLE `session` ADD `path` text;--> statement-breakpoint
ALTER TABLE `session` ADD `workspace_id` text;--> statement-breakpoint
CREATE INDEX `session_path_idx` ON `session` (`path`);--> statement-breakpoint
CREATE INDEX `session_workspace_idx` ON `session` (`workspace_id`);