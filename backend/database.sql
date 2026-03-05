-- uniflow init schema (PostgreSQL)
-- Matches Prisma models/enums in backend/prisma/schema.prisma
--
-- Usage:
--   1) Create an empty database (e.g. uniflow)
--   2) Run this file (psql / pgAdmin)
--   3) Set DATABASE_URL in backend/.env

BEGIN;

-- UUID generation
-- Prisma generates UUIDs client-side, but DB defaults make manual SQL inserts safe too.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
DO $$ BEGIN
  CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "UserRole" AS ENUM ('STUDENT', 'TEACHER', 'ADMIN');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "Weekday" AS ENUM ('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Tables
CREATE TABLE IF NOT EXISTS "Department" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE "Department" ADD CONSTRAINT "Department_name_key" UNIQUE ("name");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Room" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "capacity" INT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE "Room" ADD CONSTRAINT "Room_name_key" UNIQUE ("name");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "TimeSlot" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "order" INT NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE "TimeSlot" ADD CONSTRAINT "TimeSlot_order_key" UNIQUE ("order");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Group" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE "Group" ADD CONSTRAINT "Group_name_key" UNIQUE ("name");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Student" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "fullName" TEXT NOT NULL,
  "studentNo" TEXT NULL,
  "groupId" UUID NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "Student_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

DO $$ BEGIN
  ALTER TABLE "Student" ADD CONSTRAINT "Student_studentNo_key" UNIQUE ("studentNo");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Teacher" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "fullName" TEXT NOT NULL,
  "staffNo" TEXT NULL,
  "departmentId" UUID NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE "Teacher" ADD CONSTRAINT "Teacher_staffNo_key" UNIQUE ("staffNo");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Teacher" ADD CONSTRAINT "Teacher_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Subject" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "code" TEXT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE "Subject" ADD CONSTRAINT "Subject_code_key" UNIQUE ("code");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Lesson" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "startsAt" TIMESTAMPTZ NOT NULL,
  "endsAt" TIMESTAMPTZ NOT NULL,
  "room" TEXT NULL,

  "groupId" UUID NOT NULL,
  "teacherId" UUID NOT NULL,
  "subjectId" UUID NOT NULL,

  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "Lesson_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Lesson_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Lesson_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ScheduleEntry" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "weekday" "Weekday" NOT NULL,

  "groupId" UUID NOT NULL,
  "teacherId" UUID NOT NULL,
  "subjectId" UUID NOT NULL,
  "timeSlotId" UUID NOT NULL,
  "roomId" UUID NULL,

  "effectiveFrom" TIMESTAMPTZ NULL,
  "effectiveTo" TIMESTAMPTZ NULL,

  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "ScheduleEntry_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ScheduleEntry_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ScheduleEntry_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ScheduleEntry_timeSlotId_fkey" FOREIGN KEY ("timeSlotId") REFERENCES "TimeSlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ScheduleEntry_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

DO $$ BEGIN
  ALTER TABLE "ScheduleEntry" ADD CONSTRAINT "ScheduleEntry_groupId_weekday_timeSlotId_key" UNIQUE ("groupId", "weekday", "timeSlotId");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ScheduleEntry" ADD CONSTRAINT "ScheduleEntry_teacherId_weekday_timeSlotId_key" UNIQUE ("teacherId", "weekday", "timeSlotId");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Attendance" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "status" "AttendanceStatus" NOT NULL,

  "lessonId" UUID NOT NULL,
  "studentId" UUID NOT NULL,

  "notedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "Attendance_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Attendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

DO $$ BEGIN
  ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_lessonId_studentId_key" UNIQUE ("lessonId", "studentId");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "User" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NULL,
  "role" "UserRole" NOT NULL,

  -- Operational metadata (production)
  "lastLoginAt" TIMESTAMPTZ NULL,
  "credentialsSentAt" TIMESTAMPTZ NULL,

  "studentId" UUID NULL,
  "teacherId" UUID NULL,

  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "User_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "User_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

DO $$ BEGIN
  ALTER TABLE "User" ADD CONSTRAINT "User_email_key" UNIQUE ("email");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "User" ADD CONSTRAINT "User_studentId_key" UNIQUE ("studentId");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "User" ADD CONSTRAINT "User_teacherId_key" UNIQUE ("teacherId");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "UserInvitation" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "usedAt" TIMESTAMPTZ NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "UserInvitation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

DO $$ BEGIN
  ALTER TABLE "UserInvitation" ADD CONSTRAINT "UserInvitation_tokenHash_key" UNIQUE ("tokenHash");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "LoginCode" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "codeHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "usedAt" TIMESTAMPTZ NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "LoginCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS "Lesson_groupId_startsAt_idx" ON "Lesson" ("groupId", "startsAt");
CREATE INDEX IF NOT EXISTS "Lesson_teacherId_startsAt_idx" ON "Lesson" ("teacherId", "startsAt");
CREATE INDEX IF NOT EXISTS "Attendance_studentId_notedAt_idx" ON "Attendance" ("studentId", "notedAt");

CREATE INDEX IF NOT EXISTS "ScheduleEntry_groupId_weekday_idx" ON "ScheduleEntry" ("groupId", "weekday");
CREATE INDEX IF NOT EXISTS "ScheduleEntry_teacherId_weekday_idx" ON "ScheduleEntry" ("teacherId", "weekday");
CREATE INDEX IF NOT EXISTS "ScheduleEntry_weekday_timeSlotId_idx" ON "ScheduleEntry" ("weekday", "timeSlotId");

CREATE INDEX IF NOT EXISTS "UserInvitation_userId_expiresAt_idx" ON "UserInvitation" ("userId", "expiresAt");
CREATE INDEX IF NOT EXISTS "LoginCode_userId_createdAt_idx" ON "LoginCode" ("userId", "createdAt");

-- updatedAt trigger
CREATE OR REPLACE FUNCTION uniflow_set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW."updatedAt" = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER uniflow_updated_at_group BEFORE UPDATE ON "Group" FOR EACH ROW EXECUTE FUNCTION uniflow_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER uniflow_updated_at_department BEFORE UPDATE ON "Department" FOR EACH ROW EXECUTE FUNCTION uniflow_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER uniflow_updated_at_room BEFORE UPDATE ON "Room" FOR EACH ROW EXECUTE FUNCTION uniflow_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER uniflow_updated_at_timeslot BEFORE UPDATE ON "TimeSlot" FOR EACH ROW EXECUTE FUNCTION uniflow_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER uniflow_updated_at_student BEFORE UPDATE ON "Student" FOR EACH ROW EXECUTE FUNCTION uniflow_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER uniflow_updated_at_teacher BEFORE UPDATE ON "Teacher" FOR EACH ROW EXECUTE FUNCTION uniflow_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER uniflow_updated_at_subject BEFORE UPDATE ON "Subject" FOR EACH ROW EXECUTE FUNCTION uniflow_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER uniflow_updated_at_lesson BEFORE UPDATE ON "Lesson" FOR EACH ROW EXECUTE FUNCTION uniflow_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER uniflow_updated_at_schedule_entry BEFORE UPDATE ON "ScheduleEntry" FOR EACH ROW EXECUTE FUNCTION uniflow_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER uniflow_updated_at_user BEFORE UPDATE ON "User" FOR EACH ROW EXECUTE FUNCTION uniflow_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMIT;

-- NOTE:
-- Admin user creation should be done via Prisma seed (see prisma/seed.ts).
-- Keeping hard-coded credentials in SQL is unsafe and often becomes out-of-sync
-- with Prisma types (UUID vs text IDs).
