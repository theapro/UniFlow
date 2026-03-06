-- CreateEnum
CREATE TYPE "SheetsInboundResult" AS ENUM ('APPLIED', 'CONFLICT', 'REJECTED', 'ERROR');

-- CreateTable
CREATE TABLE "SheetsInboundEvent" (
    "id" UUID NOT NULL,
    "spreadsheetId" TEXT NOT NULL,
    "sheetName" TEXT NOT NULL,
    "a1Notation" TEXT,
    "recordId" UUID,
    "fieldKey" TEXT,
    "oldValue" JSONB,
    "newValue" JSONB,
    "oldDbUpdatedAt" TEXT,
    "result" "SheetsInboundResult" NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "code" TEXT,
    "message" TEXT,
    "editedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SheetsInboundEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SheetsInboundEvent_receivedAt_idx" ON "SheetsInboundEvent"("receivedAt");

-- CreateIndex
CREATE INDEX "SheetsInboundEvent_result_receivedAt_idx" ON "SheetsInboundEvent"("result", "receivedAt");
