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
    update: {},
    create: {
      email: "admin@uniflow.com",
      passwordHash: bcrypt.hashSync("admin123", 10),
      role: "ADMIN",
    },
  });
  console.log("✓ Admin user created:", admin.email);

  // Create teacher with user
  const teacher = await prisma.teacher.create({
    data: {
      fullName: "John Teacher",
      staffNo: "T001",
    },
  });

  const teacherUser = await prisma.user.upsert({
    where: { email: "teacher@uniflow.com" },
    update: {},
    create: {
      email: "teacher@uniflow.com",
      passwordHash: bcrypt.hashSync("teacher123", 10),
      role: "TEACHER",
      teacherId: teacher.id,
    },
  });
  console.log("✓ Teacher user created:", teacherUser.email);

  // Create student with user
  const student = await prisma.student.create({
    data: {
      fullName: "Jane Student",
      studentNo: "S001",
    },
  });

  const studentUser = await prisma.user.upsert({
    where: { email: "student@uniflow.com" },
    update: {},
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
