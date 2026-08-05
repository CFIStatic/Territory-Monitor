import { subHours } from "date-fns";
import { prisma } from "@/lib/db";
import { meetsMinSeverity } from "@/lib/constants";
import { normalizePlace, parseStringArray } from "@/lib/json";
import { renderTemplate } from "@/lib/templates";
import type { Contact, OutreachRule, StormEvent } from "@prisma/client";

function citiesMatch(contactCity: string, targets: string[]): boolean {
  if (targets.length === 0) return true;
  const city = normalizePlace(contactCity);
  return targets.some((t) => normalizePlace(t) === city);
}

function statesMatch(contactState: string, targets: string[]): boolean {
  if (targets.length === 0) return true;
  const state = normalizePlace(contactState);
  return targets.some((t) => normalizePlace(t) === state);
}

function zipsMatch(contactZip: string | null, targets: string[]): boolean {
  if (targets.length === 0) return true;
  if (!contactZip) return false;
  const zip = contactZip.trim();
  return targets.some((t) => t.trim() === zip);
}

export function contactMatchesStormAndRule(
  contact: Contact,
  storm: StormEvent,
  rule: OutreachRule
): boolean {
  const stormCities = parseStringArray(storm.affectedCities);
  const stormStates = parseStringArray(storm.affectedStates);
  const stormZips = parseStringArray(storm.affectedZips);

  const ruleCities = parseStringArray(rule.targetCities);
  const ruleStates = parseStringArray(rule.targetStates);

  // Intersection of storm impact area and optional rule targeting
  const effectiveCities =
    ruleCities.length > 0
      ? stormCities.filter((c) =>
          ruleCities.some((r) => normalizePlace(r) === normalizePlace(c))
        )
      : stormCities;

  const effectiveStates =
    ruleStates.length > 0
      ? stormStates.filter((s) =>
          ruleStates.some((r) => normalizePlace(r) === normalizePlace(s))
        )
      : stormStates;

  // If rule narrows cities and none overlap with storm, no match
  if (ruleCities.length > 0 && effectiveCities.length === 0) return false;
  if (ruleStates.length > 0 && effectiveStates.length === 0) {
    // Allow city-only match when states diverge
    if (effectiveCities.length === 0) return false;
  }

  const inCity = citiesMatch(contact.city, effectiveCities.length ? effectiveCities : stormCities);
  const inState = statesMatch(
    contact.state,
    effectiveStates.length ? effectiveStates : stormStates
  );
  const inZip = stormZips.length === 0 ? true : zipsMatch(contact.zip, stormZips);

  // Match if city is in storm path, or (no city list) state matches, plus zip if provided
  if (stormCities.length > 0) {
    return inCity && inZip;
  }
  return inState && inZip;
}

export async function evaluateRulesAndCreateCampaigns(now = new Date()) {
  const settings = await prisma.companySettings.findFirst();
  const rules = await prisma.outreachRule.findMany({
    where: { enabled: true },
  });
  const storms = await prisma.stormEvent.findMany({
    where: {
      status: { in: ["forecast", "approaching", "active"] },
    },
  });

  const created: string[] = [];
  const skipped: string[] = [];

  for (const storm of storms) {
    for (const rule of rules) {
      const stormTypes = parseStringArray(rule.stormTypes);
      if (stormTypes.length > 0 && !stormTypes.includes(storm.type)) {
        skipped.push(`${rule.name}: storm type mismatch`);
        continue;
      }
      if (!meetsMinSeverity(storm.severity, rule.minSeverity)) {
        skipped.push(`${rule.name}: severity below threshold`);
        continue;
      }

      const scheduledFor = subHours(new Date(storm.etaStart), rule.hoursBeforeEta);

      // Only create once send window is open or within next 7 days
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      if (scheduledFor > sevenDaysFromNow) {
        skipped.push(`${rule.name}: send window too far out`);
        continue;
      }

      const existing = await prisma.campaign.findUnique({
        where: {
          stormId_ruleId: { stormId: storm.id, ruleId: rule.id },
        },
      });
      if (existing) {
        skipped.push(`${rule.name}: campaign already exists`);
        continue;
      }

      const contacts = await prisma.contact.findMany({
        where: rule.contactListId ? { listId: rule.contactListId } : undefined,
      });

      const matched = contacts.filter((c) =>
        contactMatchesStormAndRule(c, storm, rule)
      );

      if (matched.length === 0) {
        skipped.push(`${rule.name}: no matching contacts`);
        continue;
      }

      const campaign = await prisma.campaign.create({
        data: {
          name: `${rule.name} · ${storm.name}`,
          status: "scheduled",
          stormId: storm.id,
          ruleId: rule.id,
          scheduledFor,
          matchedCount: matched.length,
          emails: {
            create: matched.map((contact) => ({
              contactId: contact.id,
              toEmail: contact.email,
              subject: renderTemplate(rule.emailSubject, {
                contact,
                storm,
                settings,
                fromName: rule.fromName,
              }),
              body: renderTemplate(rule.emailBody, {
                contact,
                storm,
                settings,
                fromName: rule.fromName,
              }),
              status: "queued",
              scheduledFor,
            })),
          },
        },
      });

      created.push(campaign.id);
    }
  }

  return { created, skipped, createdCount: created.length };
}

export async function processDueEmails(now = new Date(), limit = 100) {
  const dueEmails = await prisma.emailLog.findMany({
    where: {
      status: "queued",
      scheduledFor: { lte: now },
      campaign: { status: { in: ["scheduled", "sending"] } },
    },
    take: limit,
    include: {
      campaign: true,
      contact: true,
    },
    orderBy: { scheduledFor: "asc" },
  });

  let sent = 0;
  let failed = 0;
  const campaignIds = new Set<string>();

  for (const email of dueEmails) {
    campaignIds.add(email.campaignId);
    await prisma.campaign.update({
      where: { id: email.campaignId },
      data: { status: "sending" },
    });

    try {
      // Demo send: persist as delivered. Swap this block for a real SMTP/ESP provider.
      console.log(
        `[Territory Monitor] SENT to=${email.toEmail} subject="${email.subject}"`
      );

      await prisma.emailLog.update({
        where: { id: email.id },
        data: {
          status: "sent",
          sentAt: now,
        },
      });

      await prisma.campaign.update({
        where: { id: email.campaignId },
        data: { sentCount: { increment: 1 } },
      });
      sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown send error";
      await prisma.emailLog.update({
        where: { id: email.id },
        data: { status: "failed", error: message },
      });
      await prisma.campaign.update({
        where: { id: email.campaignId },
        data: { failedCount: { increment: 1 } },
      });
      failed += 1;
    }
  }

  for (const campaignId of campaignIds) {
    const remaining = await prisma.emailLog.count({
      where: { campaignId, status: "queued" },
    });
    if (remaining === 0) {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: "completed", sentAt: now },
      });
    }
  }

  return { processed: dueEmails.length, sent, failed };
}

export async function runOutreachEngine(now = new Date()) {
  const evaluation = await evaluateRulesAndCreateCampaigns(now);
  const sending = await processDueEmails(now);
  return { evaluation, sending };
}
