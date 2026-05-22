CREATE TABLE `anime` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`alt_titles` text,
	`synopsis` text,
	`image_url` text,
	`media_type` text NOT NULL,
	`status` text DEFAULT 'not_yet_aired' NOT NULL,
	`source` text,
	`duration` integer,
	`release_date` text,
	`rating` real,
	`created_at` text DEFAULT '(datetime(''now''))' NOT NULL,
	`updated_at` text DEFAULT '(datetime(''now''))' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `anime_genres` (
	`anime_id` integer NOT NULL,
	`genre_id` integer NOT NULL,
	PRIMARY KEY(`anime_id`, `genre_id`),
	FOREIGN KEY (`anime_id`) REFERENCES `anime`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`genre_id`) REFERENCES `genres`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `anime_relations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_anime_id` integer NOT NULL,
	`target_anime_id` integer NOT NULL,
	`relation_type` text NOT NULL,
	FOREIGN KEY (`source_anime_id`) REFERENCES `anime`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_anime_id`) REFERENCES `anime`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `episodes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`anime_id` integer NOT NULL,
	`season_id` integer,
	`episode_number` integer NOT NULL,
	`title` text,
	`duration` integer,
	`air_date` text,
	FOREIGN KEY (`anime_id`) REFERENCES `anime`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `episodes_season_id_episode_number_unique` ON `episodes` (`season_id`,`episode_number`);--> statement-breakpoint
CREATE TABLE `genres` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `genres_name_unique` ON `genres` (`name`);--> statement-breakpoint
CREATE TABLE `seasons` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`anime_id` integer NOT NULL,
	`title` text,
	`season_number` integer NOT NULL,
	`episode_count` integer,
	`season_year` integer,
	`season_name` text,
	`start_date` text,
	`end_date` text,
	`external_rating` real,
	FOREIGN KEY (`anime_id`) REFERENCES `anime`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `seasons_anime_id_season_number_unique` ON `seasons` (`anime_id`,`season_number`);