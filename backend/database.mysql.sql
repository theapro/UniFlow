-- UniFlow schedule tables (MySQL 8+)
--
-- IMPORTANT:
-- - Backend schema source-of-truth is Prisma: backend/prisma/schema.prisma
-- - Use Prisma migrations/db push to create the FULL schema.
-- - This file only contains the NEW Schedule v2 tables you listed (CalendarDay/TimeSlot/Schedule)
--   in MySQL syntax.

-- Recommended engine/charset
-- (Ensure your database default charset is utf8mb4)

CREATE TABLE IF NOT EXISTS `CalendarDay` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `date` DATE NOT NULL,
  `weekday` ENUM('MON','TUE','WED','THU','FRI','SAT','SUN') NOT NULL,
  `month` INT NOT NULL,
  `year` INT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `CalendarDay_date_key` (`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `TimeSlot` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `slotNumber` INT NOT NULL,
  `startTime` TIME NOT NULL,
  `endTime` TIME NOT NULL,
  `isBreak` TINYINT(1) NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `TimeSlot_slotNumber_key` (`slotNumber`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `Schedule` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),

  `calendarDayId` CHAR(36) NOT NULL,
  `timeSlotId` CHAR(36) NOT NULL,

  `groupId` CHAR(36) NOT NULL,
  `teacherId` CHAR(36) NOT NULL,
  `subjectId` CHAR(36) NOT NULL,
  `roomId` CHAR(36) NULL,

  `note` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),

  CONSTRAINT `Schedule_calendarDay_fkey`
    FOREIGN KEY (`calendarDayId`) REFERENCES `CalendarDay`(`id`) ON DELETE CASCADE,

  CONSTRAINT `Schedule_timeSlot_fkey`
    FOREIGN KEY (`timeSlotId`) REFERENCES `TimeSlot`(`id`),

  CONSTRAINT `Schedule_group_fkey`
    FOREIGN KEY (`groupId`) REFERENCES `Group`(`id`),

  CONSTRAINT `Schedule_teacher_fkey`
    FOREIGN KEY (`teacherId`) REFERENCES `Teacher`(`id`),

  CONSTRAINT `Schedule_subject_fkey`
    FOREIGN KEY (`subjectId`) REFERENCES `Subject`(`id`),

  CONSTRAINT `Schedule_room_fkey`
    FOREIGN KEY (`roomId`) REFERENCES `Room`(`id`),

  UNIQUE KEY `teacher_schedule_conflict` (`teacherId`,`calendarDayId`,`timeSlotId`),
  UNIQUE KEY `group_schedule_conflict` (`groupId`,`calendarDayId`,`timeSlotId`),
  UNIQUE KEY `room_schedule_conflict` (`roomId`,`calendarDayId`,`timeSlotId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Example query: schedule for one group
-- Replace GROUP_ID with an actual UUID
SELECT
  cd.`date`,
  ts.`slotNumber`,
  ts.`startTime`,
  ts.`endTime`,
  sub.`name` AS `subjectName`,
  t.`fullName` AS `teacherName`,
  r.`name` AS `roomName`
FROM `Schedule` s
JOIN `CalendarDay` cd ON cd.`id` = s.`calendarDayId`
JOIN `TimeSlot` ts ON ts.`id` = s.`timeSlotId`
JOIN `Subject` sub ON sub.`id` = s.`subjectId`
JOIN `Teacher` t ON t.`id` = s.`teacherId`
LEFT JOIN `Room` r ON r.`id` = s.`roomId`
WHERE s.`groupId` = 'GROUP_ID'
ORDER BY cd.`date`, ts.`slotNumber`;
