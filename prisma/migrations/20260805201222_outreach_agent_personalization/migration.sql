-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EmailLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "scheduledFor" DATETIME NOT NULL,
    "sentAt" DATETIME,
    "error" TEXT,
    "writingMode" TEXT NOT NULL DEFAULT 'agent',
    "personalizationBrief" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailLog_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EmailLog_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_EmailLog" ("body", "campaignId", "contactId", "createdAt", "error", "id", "scheduledFor", "sentAt", "status", "subject", "toEmail") SELECT "body", "campaignId", "contactId", "createdAt", "error", "id", "scheduledFor", "sentAt", "status", "subject", "toEmail" FROM "EmailLog";
DROP TABLE "EmailLog";
ALTER TABLE "new_EmailLog" RENAME TO "EmailLog";
CREATE INDEX "EmailLog_status_idx" ON "EmailLog"("status");
CREATE INDEX "EmailLog_scheduledFor_idx" ON "EmailLog"("scheduledFor");
CREATE INDEX "EmailLog_campaignId_idx" ON "EmailLog"("campaignId");
CREATE TABLE "new_OutreachRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "stormTypes" TEXT NOT NULL,
    "minSeverity" TEXT NOT NULL DEFAULT 'watch',
    "hoursBeforeEta" INTEGER NOT NULL DEFAULT 24,
    "targetCities" TEXT,
    "targetStates" TEXT,
    "contactListId" TEXT,
    "writingMode" TEXT NOT NULL DEFAULT 'agent',
    "voiceNotes" TEXT,
    "emailSubject" TEXT NOT NULL,
    "emailBody" TEXT NOT NULL,
    "fromName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OutreachRule_contactListId_fkey" FOREIGN KEY ("contactListId") REFERENCES "ContactList" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_OutreachRule" ("contactListId", "createdAt", "description", "emailBody", "emailSubject", "enabled", "fromName", "hoursBeforeEta", "id", "minSeverity", "name", "stormTypes", "targetCities", "targetStates", "updatedAt") SELECT "contactListId", "createdAt", "description", "emailBody", "emailSubject", "enabled", "fromName", "hoursBeforeEta", "id", "minSeverity", "name", "stormTypes", "targetCities", "targetStates", "updatedAt" FROM "OutreachRule";
DROP TABLE "OutreachRule";
ALTER TABLE "new_OutreachRule" RENAME TO "OutreachRule";
CREATE INDEX "OutreachRule_enabled_idx" ON "OutreachRule"("enabled");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
