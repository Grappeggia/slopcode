ALTER TABLE `usage_reservation` ADD `usage` json;--> statement-breakpoint
ALTER TABLE `usage_reservation` ADD `time_dispatched` timestamp(3);--> statement-breakpoint
ALTER TABLE `usage` ADD `reservation_id` varchar(64) COLLATE utf8mb4_bin;--> statement-breakpoint
CREATE UNIQUE INDEX `usage_reservation_id` ON `usage` (`reservation_id`);