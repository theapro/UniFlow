-- Add Subject.weeklyLessons used by the One Tap Schedule Generator
ALTER TABLE `Subject`
  ADD COLUMN `weeklyLessons` INTEGER NOT NULL DEFAULT 0;
