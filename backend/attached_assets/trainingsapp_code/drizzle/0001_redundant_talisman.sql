CREATE TABLE `exerciseLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workoutSessionId` int NOT NULL,
	`exerciseKey` varchar(50) NOT NULL,
	`exerciseTitle` text NOT NULL,
	`setNumber` int NOT NULL,
	`weight` int,
	`reps` int,
	`completed` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `exerciseLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `userProfiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`age` int,
	`sex` varchar(20),
	`bodyWeight` int,
	`oneRmBench` int,
	`oneRmOhp` int,
	`oneRmDeadlift` int,
	`oneRmLatpull` int,
	`lastSessionType` varchar(10),
	`trainingGoal` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `userProfiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `userProfiles_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `workoutSessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`sessionType` varchar(10) NOT NULL,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	`notes` text,
	CONSTRAINT `workoutSessions_id` PRIMARY KEY(`id`)
);
