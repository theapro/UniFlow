-- CreateEnum
CREATE TYPE "AiModality" AS ENUM ('CHAT', 'VISION', 'STT', 'TTS', 'MODERATION');

-- CreateTable
CREATE TABLE "AiModel" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "modality" "AiModality" NOT NULL DEFAULT 'CHAT',
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "enabledForUsers" BOOLEAN NOT NULL DEFAULT false,
    "enabledForAdmins" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiModel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiModel_provider_modality_isEnabled_enabledForUsers_sortOrd_idx" ON "AiModel"("provider", "modality", "isEnabled", "enabledForUsers", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "AiModel_provider_model_key" ON "AiModel"("provider", "model");
