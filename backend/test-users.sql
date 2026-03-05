-- Create test users for login testing
-- Run this SQL script in your PostgreSQL database

-- Admin user
INSERT INTO "User" (id, email, "passwordHash", role, "createdAt", "updatedAt")
VALUES 
  (gen_random_uuid(), 'admin@uniflow.com', 'admin123', 'ADMIN', NOW(), NOW())
ON CONFLICT (email) DO NOTHING;

-- Teacher user with teacher record
DO $$
DECLARE
  teacher_id uuid := gen_random_uuid();
BEGIN
  -- Create teacher record
  INSERT INTO "Teacher" (id, "fullName", "staffNo", "createdAt", "updatedAt")
  VALUES (teacher_id, 'John Teacher', 'T001', NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;

  -- Create user linked to teacher
  INSERT INTO "User" (id, email, "passwordHash", role, "teacherId", "createdAt", "updatedAt")
  VALUES (gen_random_uuid(), 'teacher@uniflow.com', 'teacher123', 'TEACHER', teacher_id, NOW(), NOW())
  ON CONFLICT (email) DO NOTHING;
END $$;

-- Student user with student record
DO $$
DECLARE
  student_id uuid := gen_random_uuid();
BEGIN
  -- Create student record
  INSERT INTO "Student" (id, "fullName", "studentNo", "createdAt", "updatedAt")
  VALUES (student_id, 'Jane Student', 'S001', NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;

  -- Create user linked to student
  INSERT INTO "User" (id, email, "passwordHash", role, "studentId", "createdAt", "updatedAt")
  VALUES (gen_random_uuid(), 'student@uniflow.com', 'student123', 'STUDENT', student_id, NOW(), NOW())
  ON CONFLICT (email) DO NOTHING;
END $$;
