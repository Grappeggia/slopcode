CREATE TABLE `stripe_webhook_event` (
	`id` varchar(255) COLLATE utf8mb4_bin PRIMARY KEY,
	`time_created` timestamp(3) NOT NULL DEFAULT (now())
);
--> statement-breakpoint
ALTER TABLE `payment` MODIFY COLUMN `invoice_id` varchar(255) COLLATE utf8mb4_bin;--> statement-breakpoint
ALTER TABLE `payment` MODIFY COLUMN `payment_id` varchar(255) COLLATE utf8mb4_bin;--> statement-breakpoint
UPDATE `payment` AS `newer`
INNER JOIN `payment` AS `older`
	ON BINARY `newer`.`invoice_id` = BINARY `older`.`invoice_id`
	AND (
		`newer`.`time_created` > `older`.`time_created`
		OR (`newer`.`time_created` = `older`.`time_created` AND `newer`.`workspace_id` > `older`.`workspace_id`)
		OR (
			`newer`.`time_created` = `older`.`time_created`
			AND `newer`.`workspace_id` = `older`.`workspace_id`
			AND `newer`.`id` > `older`.`id`
		)
	)
SET `newer`.`invoice_id` = NULL
WHERE `newer`.`invoice_id` IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `payment_invoice_id` ON `payment` (`invoice_id`);--> statement-breakpoint
UPDATE `payment` AS `newer`
INNER JOIN `payment` AS `older`
	ON BINARY `newer`.`payment_id` = BINARY `older`.`payment_id`
	AND (
		`newer`.`time_created` > `older`.`time_created`
		OR (`newer`.`time_created` = `older`.`time_created` AND `newer`.`workspace_id` > `older`.`workspace_id`)
		OR (
			`newer`.`time_created` = `older`.`time_created`
			AND `newer`.`workspace_id` = `older`.`workspace_id`
			AND `newer`.`id` > `older`.`id`
		)
	)
SET `newer`.`payment_id` = NULL
WHERE `newer`.`payment_id` IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `payment_payment_id` ON `payment` (`payment_id`);
