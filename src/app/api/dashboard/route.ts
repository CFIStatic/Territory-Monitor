import { prisma } from "@/lib/db";
import { jsonOk } from "@/lib/api";
import { parseStringArray } from "@/lib/json";

export async function GET() {
  const [
    contactCount,
    listCount,
    ruleCount,
    activeStorms,
    campaigns,
    recentEmails,
    queuedEmails,
    sentEmails,
  ] = await Promise.all([
    prisma.contact.count(),
    prisma.contactList.count(),
    prisma.outreachRule.count({ where: { enabled: true } }),
    prisma.stormEvent.findMany({
      where: { status: { in: ["forecast", "approaching", "active"] } },
      orderBy: { etaStart: "asc" },
      take: 5,
    }),
    prisma.campaign.findMany({
      include: { storm: true, rule: true },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.emailLog.findMany({
      include: { contact: true, campaign: true },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.emailLog.count({ where: { status: "queued" } }),
    prisma.emailLog.count({ where: { status: "sent" } }),
  ]);

  return jsonOk({
    stats: {
      contacts: contactCount,
      lists: listCount,
      activeRules: ruleCount,
      activeStorms: activeStorms.length,
      queuedEmails,
      sentEmails,
    },
    storms: activeStorms.map((s) => ({
      ...s,
      affectedCities: parseStringArray(s.affectedCities),
      affectedStates: parseStringArray(s.affectedStates),
    })),
    campaigns,
    recentEmails,
  });
}
