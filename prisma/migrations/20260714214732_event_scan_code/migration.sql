-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "scanCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Event_scanCode_key" ON "Event"("scanCode");
