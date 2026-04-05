-- Add Subject.totalLessons used by the schedule/subjects tooling.
ALTER TABLE `Subject`
	ADD COLUMN `totalLessons` INTEGER NOT NULL DEFAULT 0;
