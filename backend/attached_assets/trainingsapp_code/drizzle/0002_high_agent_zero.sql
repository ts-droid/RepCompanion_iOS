ALTER TABLE `userProfiles` ADD `height` int;--> statement-breakpoint
ALTER TABLE `userProfiles` ADD `bodyFatPercent` int;--> statement-breakpoint
ALTER TABLE `userProfiles` ADD `muscleMassPercent` int;--> statement-breakpoint
ALTER TABLE `userProfiles` ADD `sessionsPerWeek` int;--> statement-breakpoint
ALTER TABLE `userProfiles` ADD `sessionDuration` int;--> statement-breakpoint
ALTER TABLE `userProfiles` ADD `goalVolume` int;--> statement-breakpoint
ALTER TABLE `userProfiles` ADD `goalStrength` int;--> statement-breakpoint
ALTER TABLE `userProfiles` ADD `goalCardio` int;--> statement-breakpoint
ALTER TABLE `userProfiles` ADD `restTime` int DEFAULT 60;