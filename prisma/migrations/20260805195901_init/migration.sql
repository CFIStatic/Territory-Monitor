-- CreateTable
CREATE TABLE "CompanySettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyName" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "agentEmail" TEXT NOT NULL,
    "agentPhone" TEXT,
    "website" TEXT,
    "replyToEmail" TEXT,
    "signature" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ContactList" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zip" TEXT,
    "company" TEXT,
    "notes" TEXT,
    "listId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Contact_listId_fkey" FOREIGN KEY ("listId") REFERENCES "ContactList" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StormEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "description" TEXT,
    "affectedCities" TEXT NOT NULL,
    "affectedStates" TEXT NOT NULL,
    "affectedZips" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "radiusMiles" REAL,
    "etaStart" DATETIME NOT NULL,
    "etaEnd" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'forecast',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "OutreachRule" (
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
    "emailSubject" TEXT NOT NULL,
    "emailBody" TEXT NOT NULL,
    "fromName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OutreachRule_contactListId_fkey" FOREIGN KEY ("contactListId") REFERENCES "ContactList" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "stormId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "scheduledFor" DATETIME NOT NULL,
    "sentAt" DATETIME,
    "matchedCount" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Campaign_stormId_fkey" FOREIGN KEY ("stormId") REFERENCES "StormEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Campaign_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "OutreachRule" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EmailLog" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailLog_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EmailLog_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Contact_city_state_idx" ON "Contact"("city", "state");

-- CreateIndex
CREATE INDEX "Contact_email_idx" ON "Contact"("email");

-- CreateIndex
CREATE INDEX "Contact_listId_idx" ON "Contact"("listId");

-- CreateIndex
CREATE INDEX "StormEvent_status_idx" ON "StormEvent"("status");

-- CreateIndex
CREATE INDEX "StormEvent_etaStart_idx" ON "StormEvent"("etaStart");

-- CreateIndex
CREATE INDEX "OutreachRule_enabled_idx" ON "OutreachRule"("enabled");

-- CreateIndex
CREATE INDEX "Campaign_status_idx" ON "Campaign"("status");

-- CreateIndex
CREATE INDEX "Campaign_scheduledFor_idx" ON "Campaign"("scheduledFor");

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_stormId_ruleId_key" ON "Campaign"("stormId", "ruleId");

-- CreateIndex
CREATE INDEX "EmailLog_status_idx" ON "EmailLog"("status");

-- CreateIndex
CREATE INDEX "EmailLog_scheduledFor_idx" ON "EmailLog"("scheduledFor");

-- CreateIndex
CREATE INDEX "EmailLog_campaignId_idx" ON "EmailLog"("campaignId");
