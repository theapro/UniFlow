-- CreateTable
CREATE TABLE "AiSettings" (
    "key" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "systemPrompt" TEXT NOT NULL DEFAULT '',
    "toolPlannerPrompt" TEXT NOT NULL DEFAULT '',
    "defaultUserChatModelId" UUID,
    "defaultAdminChatModelId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiSettings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "AiToolConfig" (
    "name" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "enabledForStudents" BOOLEAN NOT NULL DEFAULT true,
    "enabledForTeachers" BOOLEAN NOT NULL DEFAULT true,
    "enabledForAdmins" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiToolConfig_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "AiUsageLog" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "role" "UserRole",
    "requestId" TEXT,
    "provider" TEXT,
    "model" TEXT,
    "toolName" TEXT,
    "toolArgs" JSONB,
    "userMessage" TEXT NOT NULL,
    "assistantMessage" TEXT,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "ms" INTEGER,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradeBook" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "subjectId" UUID NOT NULL,
    "assignmentCount" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'GRADES_SHEETS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GradeBook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradeRecord" (
    "id" UUID NOT NULL,
    "gradeBookId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "assignmentIndex" INTEGER NOT NULL,
    "rawValue" TEXT,
    "score" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GradeRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiUsageLog_createdAt_idx" ON "AiUsageLog"("createdAt");

-- CreateIndex
CREATE INDEX "AiUsageLog_userId_createdAt_idx" ON "AiUsageLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "GradeBook_groupId_updatedAt_idx" ON "GradeBook"("groupId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "GradeBook_groupId_subjectId_key" ON "GradeBook"("groupId", "subjectId");

-- CreateIndex
CREATE INDEX "GradeRecord_studentId_updatedAt_idx" ON "GradeRecord"("studentId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "GradeRecord_gradeBookId_studentId_assignmentIndex_key" ON "GradeRecord"("gradeBookId", "studentId", "assignmentIndex");

-- AddForeignKey
ALTER TABLE "AiSettings" ADD CONSTRAINT "AiSettings_defaultUserChatModelId_fkey" FOREIGN KEY ("defaultUserChatModelId") REFERENCES "AiModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiSettings" ADD CONSTRAINT "AiSettings_defaultAdminChatModelId_fkey" FOREIGN KEY ("defaultAdminChatModelId") REFERENCES "AiModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsageLog" ADD CONSTRAINT "AiUsageLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeBook" ADD CONSTRAINT "GradeBook_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeBook" ADD CONSTRAINT "GradeBook_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeRecord" ADD CONSTRAINT "GradeRecord_gradeBookId_fkey" FOREIGN KEY ("gradeBookId") REFERENCES "GradeBook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeRecord" ADD CONSTRAINT "GradeRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
