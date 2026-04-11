CREATE TABLE `account_state` (
	`id` integer PRIMARY KEY,
	`active_account_id` text,
	`active_org_id` text,
	CONSTRAINT `fk_account_state_active_account_id_account_id_fk` FOREIGN KEY (`active_account_id`) REFERENCES `account`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `account` (
	`id` text PRIMARY KEY,
	`email` text NOT NULL,
	`url` text NOT NULL,
	`access_token` text NOT NULL,
	`refresh_token` text NOT NULL,
	`token_expiry` integer,
	`time_created` integer NOT NULL,
	`time_updated` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `account_url_email_idx` ON `account` (`url`,`email`);
--> statement-breakpoint
INSERT INTO `account` (`id`, `email`, `url`, `access_token`, `refresh_token`, `token_expiry`, `time_created`, `time_updated`)
SELECT
  rtrim(`url`, '/') || '::' || lower(trim(`email`)),
  `email`,
  rtrim(`url`, '/'),
  `access_token`,
  `refresh_token`,
  `token_expiry`,
  `time_created`,
  `time_updated`
FROM `control_account`;
--> statement-breakpoint
INSERT INTO `account_state` (`id`, `active_account_id`, `active_org_id`)
SELECT
  1,
  rtrim(`url`, '/') || '::' || lower(trim(`email`)),
  NULL
FROM `control_account`
WHERE `active` = 1
LIMIT 1
ON CONFLICT(`id`) DO UPDATE SET
  `active_account_id` = excluded.`active_account_id`,
  `active_org_id` = excluded.`active_org_id`;