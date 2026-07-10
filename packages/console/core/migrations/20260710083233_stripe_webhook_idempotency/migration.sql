CREATE TABLE `stripe_webhook_event` (
	`id` varchar(255) PRIMARY KEY,
	`time_created` timestamp(3) NOT NULL DEFAULT (now())
);
--> statement-breakpoint
UPDATE `payment` AS `newer`
INNER JOIN `payment` AS `older`
	ON `newer`.`invoice_id` = `older`.`invoice_id`
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
	ON `newer`.`payment_id` = `older`.`payment_id`
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
