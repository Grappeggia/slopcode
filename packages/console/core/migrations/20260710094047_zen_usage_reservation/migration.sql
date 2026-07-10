CREATE TABLE `usage_reservation` (
	`id` varchar(64) COLLATE utf8mb4_bin PRIMARY KEY,
	`workspace_id` varchar(30) NOT NULL,
	`user_id` varchar(30) NOT NULL,
	`source` enum('free','byok','subscription','lite','balance') NOT NULL,
	`status` enum('pending','settled','released') NOT NULL DEFAULT 'pending',
	`amount` bigint NOT NULL,
	`amount_actual` bigint,
	`limits` json,
	`time_created` timestamp(3) NOT NULL DEFAULT (now())
);
--> statement-breakpoint
CREATE INDEX `usage_reservation_workspace_status` ON `usage_reservation` (`workspace_id`,`status`);