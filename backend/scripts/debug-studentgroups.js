const { prisma } = require("../dist/config/prisma");

async function main() {
  const studentGroupCount = await prisma.studentGroup.count();
  const studentCount = await prisma.student.count();
  const groupCount = await prisma.group.count();

  console.log({ studentCount, groupCount, studentGroupCount });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
