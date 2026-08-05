-- AlterTable
ALTER TABLE "StormEvent" ADD COLUMN "externalId" TEXT;
ALTER TABLE "StormEvent" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE "StormEvent" ADD COLUMN "geometryJson" TEXT;
ALTER TABLE "StormEvent" ADD COLUMN "areaDesc" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "StormEvent_externalId_key" ON "StormEvent"("externalId");
CREATE INDEX "StormEvent_source_idx" ON "StormEvent"("source");
