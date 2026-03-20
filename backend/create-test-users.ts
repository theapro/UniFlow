import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import bcrypt from "bcryptjs";

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log("Creating test users...");

  // Create admin user
  const admin = await prisma.user.upsert({
    where: { email: "admin@uniflow.com" },
    update: {
      passwordHash: bcrypt.hashSync("admin123", 10),
      role: "ADMIN",
    },
    create: {
      email: "admin@uniflow.com",
      passwordHash: bcrypt.hashSync("admin123", 10),
      role: "ADMIN",
    },
  });
  console.log("✓ Admin user created:", admin.email);

  // Create/update teacher with user (idempotent)
  const teacher = await prisma.teacher.upsert({
    where: { staffNo: "T001" },
    update: {
      fullName: "John Teacher",
    },
    create: {
      fullName: "John Teacher",
      staffNo: "T001",
    },
  });

  const teacherUser = await prisma.user.upsert({
    where: { email: "teacher@uniflow.com" },
    update: {
      passwordHash: bcrypt.hashSync("teacher123", 10),
      role: "TEACHER",
      teacherId: teacher.id,
      studentId: null,
    },
    create: {
      email: "teacher@uniflow.com",
      passwordHash: bcrypt.hashSync("teacher123", 10),
      role: "TEACHER",
      teacherId: teacher.id,
    },
  });
  console.log("✓ Teacher user created:", teacherUser.email);

  // Create/update student with user (idempotent)
  const student = await prisma.student.upsert({
    where: { studentNumber: "S001" },
    update: {
      fullName: "Jane Student",
    },
    create: {
      fullName: "Jane Student",
      studentNumber: "S001",
      email: "student@uniflow.com",
    },
  });

  const studentUser = await prisma.user.upsert({
    where: { email: "student@uniflow.com" },
    update: {
      passwordHash: bcrypt.hashSync("student123", 10),
      role: "STUDENT",
      studentId: student.id,
      teacherId: null,
    },
    create: {
      email: "student@uniflow.com",
      passwordHash: bcrypt.hashSync("student123", 10),
      role: "STUDENT",
      studentId: student.id,
    },
  });
  console.log("✓ Student user created:", studentUser.email);

  console.log("\n✅ All test users created successfully!");
  console.log("\nYou can now login with:");
  console.log("- admin@uniflow.com / admin123");
  console.log("- teacher@uniflow.com / teacher123");
  console.log("- student@uniflow.com / student123");
}

main()
  .catch((e) => {
    console.error("Error creating test users:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
