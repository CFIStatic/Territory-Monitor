import { prisma } from "@/lib/db";
import { jsonOk } from "@/lib/api";
import { lookupCityCoords } from "@/lib/geo/cities";
import { parseStringArray } from "@/lib/json";

export async function GET() {
  const [contacts, storms, rules] = await Promise.all([
    prisma.contact.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        city: true,
        state: true,
        zip: true,
        email: true,
      },
    }),
    prisma.stormEvent.findMany({
      where: { status: { in: ["forecast", "approaching", "active"] } },
      orderBy: { etaStart: "asc" },
      include: { _count: { select: { campaigns: true } } },
    }),
    prisma.outreachRule.findMany({
      where: { enabled: true },
      select: { id: true, name: true, writingMode: true, hoursBeforeEta: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const territoryMap = new Map<
    string,
    {
      key: string;
      city: string;
      state: string;
      lat: number;
      lng: number;
      contactCount: number;
      sampleNames: string[];
    }
  >();

  for (const c of contacts) {
    const coords = lookupCityCoords(c.city, c.state);
    if (!coords) continue;
    const key = `${c.city.toLowerCase()}|${c.state.toUpperCase()}`;
    const existing = territoryMap.get(key);
    if (existing) {
      existing.contactCount += 1;
      if (existing.sampleNames.length < 3) {
        existing.sampleNames.push(`${c.firstName} ${c.lastName}`);
      }
    } else {
      territoryMap.set(key, {
        key,
        city: c.city,
        state: c.state.toUpperCase(),
        lat: coords.lat,
        lng: coords.lng,
        contactCount: 1,
        sampleNames: [`${c.firstName} ${c.lastName}`],
      });
    }
  }

  const territories = [...territoryMap.values()].sort(
    (a, b) => b.contactCount - a.contactCount
  );

  const stormFeatures = storms.map((s) => {
    const cities = parseStringArray(s.affectedCities);
    const states = parseStringArray(s.affectedStates);
    let geometry = null;
    if (s.geometryJson) {
      try {
        geometry = JSON.parse(s.geometryJson);
      } catch {
        geometry = null;
      }
    }

    // Count contacts in storm path
    const citySet = new Set(cities.map((c) => c.toLowerCase()));
    const matchedContacts = contacts.filter((c) => citySet.has(c.city.toLowerCase())).length;

    return {
      id: s.id,
      name: s.name,
      type: s.type,
      severity: s.severity,
      status: s.status,
      source: s.source,
      areaDesc: s.areaDesc,
      etaStart: s.etaStart,
      etaEnd: s.etaEnd,
      latitude: s.latitude,
      longitude: s.longitude,
      radiusMiles: s.radiusMiles ?? 40,
      affectedCities: cities,
      affectedStates: states,
      geometry,
      campaignCount: s._count.campaigns,
      matchedContacts,
    };
  });

  const lats = territories.map((t) => t.lat);
  const lngs = territories.map((t) => t.lng);
  const center =
    lats.length > 0
      ? {
          lat: lats.reduce((a, b) => a + b, 0) / lats.length,
          lng: lngs.reduce((a, b) => a + b, 0) / lngs.length,
        }
      : { lat: 43.0389, lng: -87.9065 };

  return jsonOk({
    center,
    territories,
    storms: stormFeatures,
    rules,
    stats: {
      territories: territories.length,
      contactsMapped: territories.reduce((n, t) => n + t.contactCount, 0),
      contactsTotal: contacts.length,
      activeStorms: stormFeatures.length,
    },
  });
}
