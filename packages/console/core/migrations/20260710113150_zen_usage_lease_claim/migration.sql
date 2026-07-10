CREATE TABLE `usage_legacy_claim` (
	`id` varchar(64) COLLATE utf8mb4_bin PRIMARY KEY,
	`time_created` timestamp(3) NOT NULL DEFAULT (now())
);
--> statement-breakpoint
ALTER TABLE `usage_reservation` ADD `time_lease_expires` timestamp(3);--> statement-breakpoint
CREATE INDEX `usage_reservation_lease` ON `usage_reservation` (`workspace_id`,`status`,`time_lease_expires`);