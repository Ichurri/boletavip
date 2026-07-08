-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'PAYMENT_SUBMITTED';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "paymentProof" TEXT,
ADD COLUMN     "paymentSubmittedAt" TIMESTAMP(3),
ADD COLUMN     "rejectionReason" TEXT;

-- CreateTable
CREATE TABLE "PlatformSettings" (
    "id" TEXT NOT NULL DEFAULT 'main',
    "orderCutoffHours" INTEGER NOT NULL DEFAULT 2,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);

-- Grandfather accounts created before email verification existed
UPDATE "User" SET "emailVerified" = CURRENT_TIMESTAMP WHERE "emailVerified" IS NULL;

-- Seed the settings singleton
INSERT INTO "PlatformSettings" ("id", "orderCutoffHours", "updatedAt")
VALUES ('main', 2, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
