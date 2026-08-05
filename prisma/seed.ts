import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";
import { addHours, addDays } from "date-fns";
import {
  DEFAULT_EMAIL_BODY,
  DEFAULT_EMAIL_SUBJECT,
  DEFAULT_VOICE_NOTES,
} from "../src/lib/templates";

const dbPath = path.join(process.cwd(), "prisma", "dev.db");
const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.emailLog.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.outreachRule.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.contactList.deleteMany();
  await prisma.stormEvent.deleteMany();
  await prisma.companySettings.deleteMany();

  await prisma.companySettings.create({
    data: {
      companyName: "Lakeshore Restoration",
      agentName: "Jordan Hale",
      agentEmail: "jordan@lakeshorerestoration.com",
      agentPhone: "(414) 555-0188",
      website: "https://lakeshorerestoration.com",
      replyToEmail: "jordan@lakeshorerestoration.com",
      signature:
        "Jordan Hale | Lakeshore Restoration | 24/7 Emergency Response",
    },
  });

  const midwest = await prisma.contactList.create({
    data: {
      name: "Midwest Homeowners",
      description: "Primary book of business across WI / IL / MN",
    },
  });

  const contacts = [
    {
      firstName: "Maya",
      lastName: "Brooks",
      email: "maya.brooks@example.com",
      phone: "(414) 555-0101",
      address: "1842 N Prospect Ave",
      city: "Milwaukee",
      state: "WI",
      zip: "53202",
      company: "Brooks Properties",
    },
    {
      firstName: "Chris",
      lastName: "Nguyen",
      email: "chris.nguyen@example.com",
      phone: "(414) 555-0144",
      address: "902 W Wisconsin Ave",
      city: "Milwaukee",
      state: "WI",
      zip: "53233",
    },
    {
      firstName: "Elena",
      lastName: "Vasquez",
      email: "elena.vasquez@example.com",
      city: "Waukesha",
      state: "WI",
      zip: "53186",
      address: "311 E Main St",
    },
    {
      firstName: "Tom",
      lastName: "Keller",
      email: "tom.keller@example.com",
      city: "Racine",
      state: "WI",
      zip: "53403",
    },
    {
      firstName: "Priya",
      lastName: "Shah",
      email: "priya.shah@example.com",
      city: "Madison",
      state: "WI",
      zip: "53703",
    },
    {
      firstName: "Derek",
      lastName: "Owens",
      email: "derek.owens@example.com",
      city: "Chicago",
      state: "IL",
      zip: "60611",
      address: "401 N Michigan Ave",
    },
    {
      firstName: "Hannah",
      lastName: "Lee",
      email: "hannah.lee@example.com",
      city: "Green Bay",
      state: "WI",
      zip: "54301",
    },
    {
      firstName: "Marcus",
      lastName: "Reed",
      email: "marcus.reed@example.com",
      city: "Milwaukee",
      state: "WI",
      zip: "53215",
      company: "Reed Family Trust",
    },
  ];

  for (const contact of contacts) {
    await prisma.contact.create({
      data: { ...contact, listId: midwest.id },
    });
  }

  await prisma.stormEvent.createMany({
    data: [
      {
        name: "Severe Thunderstorm — Milwaukee Metro",
        type: "thunderstorm",
        severity: "warning",
        description:
          "Line of severe storms with damaging winds and large hail tracking into the Milwaukee metro.",
        affectedCities: JSON.stringify([
          "Milwaukee",
          "Waukesha",
          "Racine",
          "Brookfield",
        ]),
        affectedStates: JSON.stringify(["WI"]),
        affectedZips: JSON.stringify(["53202", "53233", "53215", "53186", "53403"]),
        latitude: 43.0389,
        longitude: -87.9065,
        radiusMiles: 40,
        etaStart: addHours(new Date(), 36),
        etaEnd: addHours(new Date(), 48),
        status: "approaching",
      },
      {
        name: "Hail Threat — Chicago North Shore",
        type: "hail",
        severity: "watch",
        description: "Elevated hail risk across northern Chicago suburbs.",
        affectedCities: JSON.stringify(["Chicago", "Evanston", "Skokie"]),
        affectedStates: JSON.stringify(["IL"]),
        latitude: 41.8781,
        longitude: -87.6298,
        radiusMiles: 35,
        etaStart: addDays(new Date(), 3),
        status: "forecast",
      },
      {
        name: "High Wind Event — Green Bay",
        type: "wind",
        severity: "advisory",
        description: "Sustained winds with gusts capable of roof and tree damage.",
        affectedCities: JSON.stringify(["Green Bay", "De Pere"]),
        affectedStates: JSON.stringify(["WI"]),
        latitude: 44.5133,
        longitude: -88.0133,
        radiusMiles: 25,
        etaStart: addDays(new Date(), 5),
        status: "forecast",
      },
    ],
  });

  await prisma.outreachRule.create({
    data: {
      name: "Pre-storm readiness — 24h",
      description:
        "Outreach agent writes a unique personal note to each contact one day before ETA.",
      enabled: true,
      stormTypes: JSON.stringify([
        "thunderstorm",
        "tornado",
        "hail",
        "hurricane",
        "wind",
        "flood",
      ]),
      minSeverity: "watch",
      hoursBeforeEta: 24,
      contactListId: midwest.id,
      writingMode: "agent",
      voiceNotes: DEFAULT_VOICE_NOTES,
      emailSubject: DEFAULT_EMAIL_SUBJECT,
      emailBody: DEFAULT_EMAIL_BODY,
      fromName: "Jordan Hale",
    },
  });

  await prisma.outreachRule.create({
    data: {
      name: "Milwaukee-only severe warning",
      description:
        "Tight geo-target for Milwaukee when severity hits warning+. Agent writes one-to-one copy.",
      enabled: true,
      stormTypes: JSON.stringify(["thunderstorm", "tornado", "hail"]),
      minSeverity: "warning",
      hoursBeforeEta: 12,
      targetCities: JSON.stringify(["Milwaukee"]),
      contactListId: midwest.id,
      writingMode: "agent",
      voiceNotes:
        "Urgent but calm — emphasize Milwaukee response-zone readiness and direct phone access",
      emailSubject: "Personal Milwaukee heads-up before severe weather",
      emailBody: `Stress that they are in our Milwaukee response zone.
Offer emergency board-up, water extraction, and contents protection.
Give the agent's direct line and make clear this message is only for them.`,
      fromName: "Jordan Hale",
    },
  });

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
