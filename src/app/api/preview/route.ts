import { prisma } from "@/lib/db";
import { jsonError, jsonOk, readJson } from "@/lib/api";
import { contactMatchesStormAndRule } from "@/lib/engine";
import { renderTemplate } from "@/lib/templates";
import type { OutreachRule, StormEvent } from "@prisma/client";

export async function POST(request: Request) {
  const body = await readJson<{
    stormId?: string;
    ruleId?: string;
  }>(request);

  if (!body.stormId || !body.ruleId) {
    return jsonError("stormId and ruleId are required");
  }

  const [storm, rule, settings] = await Promise.all([
    prisma.stormEvent.findUnique({ where: { id: body.stormId } }),
    prisma.outreachRule.findUnique({ where: { id: body.ruleId } }),
    prisma.companySettings.findFirst(),
  ]);

  if (!storm || !rule) return jsonError("Storm or rule not found", 404);

  const contacts = await prisma.contact.findMany({
    where: rule.contactListId ? { listId: rule.contactListId } : undefined,
  });

  const matched = contacts.filter((c) =>
    contactMatchesStormAndRule(c, storm as StormEvent, rule as OutreachRule)
  );

  const samples = matched.slice(0, 5).map((contact) => ({
    contact,
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
  }));

  return jsonOk({
    matchedCount: matched.length,
    matchedContacts: matched,
    samples,
  });
}
