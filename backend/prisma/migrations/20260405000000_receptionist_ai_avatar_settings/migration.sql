-- Receptionist (LEIA) — AI avatar additional settings

-- AlterTable
ALTER TABLE `ai_avatar`
  ADD COLUMN `systemPrompt` LONGTEXT NULL,
  ADD COLUMN `responseStyle` LONGTEXT NULL,
  ADD COLUMN `maxResponseTokens` INTEGER NOT NULL DEFAULT 900,
  ADD COLUMN `temperature` DOUBLE NOT NULL DEFAULT 0.4,
  ADD COLUMN `autoRefreshKnowledge` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `allowedTopics` JSON NULL,
  ADD COLUMN `blockedTopics` JSON NULL;
