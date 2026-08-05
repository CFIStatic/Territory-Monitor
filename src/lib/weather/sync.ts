import { prisma } from "@/lib/db";
import { toJsonArray } from "@/lib/json";
import { hasWeatherComKey, fetchWeatherComAlerts } from "@/lib/weather/weather-com";
import { fetchNwsAlerts } from "@/lib/weather/nws";
import type { NormalizedAlert } from "@/lib/weather/types";
import { lookupCityCoords } from "@/lib/geo/cities";

export type WeatherSyncResult = {
  provider: "weather.com" | "nws";
  fetched: number;
  upserted: number;
  skipped: number;
  storms: Array<{ id: string; name: string; source: string }>;
};

async function enrichWithTerritoryCities(alert: NormalizedAlert): Promise<NormalizedAlert> {
  // If alert has states but few cities, attach known contact cities in those states
  if (alert.affectedCities.length >= 3 || alert.affectedStates.length === 0) {
    return alert;
  }

  const contacts = await prisma.contact.findMany({
    where: {
      state: { in: alert.affectedStates.map((s) => s.toUpperCase()) },
    },
    select: { city: true, state: true },
    take: 500,
  });

  const citySet = new Set(alert.affectedCities.map((c) => c.toLowerCase()));
  for (const c of contacts) {
    // Prefer cities that appear in areaDesc fragment match
    if (
      alert.areaDesc &&
      alert.areaDesc.toLowerCase().includes(c.city.toLowerCase())
    ) {
      citySet.add(c.city);
    }
  }

  const cities = [...citySet].map((c) => {
    const match = contacts.find((x) => x.city.toLowerCase() === c.toLowerCase());
    return match?.city || c.replace(/\b\w/g, (ch) => ch.toUpperCase());
  });

  let { latitude, longitude } = alert;
  if ((latitude == null || longitude == null) && cities[0] && alert.affectedStates[0]) {
    const coords = lookupCityCoords(cities[0], alert.affectedStates[0]);
    if (coords) {
      latitude = coords.lat;
      longitude = coords.lng;
    }
  }

  return {
    ...alert,
    affectedCities: cities.slice(0, 30),
    latitude,
    longitude,
  };
}

export async function syncWeatherAlerts(options?: {
  area?: string;
  forceProvider?: "weather.com" | "nws";
}): Promise<WeatherSyncResult> {
  let provider: "weather.com" | "nws" = "nws";
  let alerts: NormalizedAlert[] = [];

  const preferWeatherCom =
    options?.forceProvider === "weather.com" ||
    (!options?.forceProvider && hasWeatherComKey());

  if (preferWeatherCom && hasWeatherComKey()) {
    try {
      provider = "weather.com";
      // Pull US headlines; optionally bias to a territory centroid later
      alerts = await fetchWeatherComAlerts({ countryCode: "US" });
    } catch (error) {
      console.warn("[weather] Weather.com failed, falling back to NWS", error);
      provider = "nws";
      alerts = await fetchNwsAlerts({ area: options?.area });
    }
  } else {
    provider = "nws";
    alerts = await fetchNwsAlerts({ area: options?.area });
  }

  let upserted = 0;
  let skipped = 0;
  const storms: WeatherSyncResult["storms"] = [];

  for (const raw of alerts) {
    const alert = await enrichWithTerritoryCities(raw);

    // Skip non-actionable / expired
    if (alert.etaEnd && alert.etaEnd.getTime() < Date.now() - 60 * 60 * 1000) {
      skipped += 1;
      continue;
    }

    const data = {
      name: alert.name.slice(0, 240),
      type: alert.type,
      severity: alert.severity,
      description: alert.description,
      affectedCities: toJsonArray(alert.affectedCities),
      affectedStates: toJsonArray(alert.affectedStates),
      latitude: alert.latitude,
      longitude: alert.longitude,
      radiusMiles: alert.radiusMiles,
      etaStart: alert.etaStart,
      etaEnd: alert.etaEnd,
      status: alert.status,
      source: alert.source,
      geometryJson: alert.geometry ? JSON.stringify(alert.geometry) : null,
      areaDesc: alert.areaDesc,
    };

    const existing = await prisma.stormEvent.findUnique({
      where: { externalId: alert.externalId },
    });

    const storm = existing
      ? await prisma.stormEvent.update({
          where: { id: existing.id },
          data,
        })
      : await prisma.stormEvent.create({
          data: {
            ...data,
            externalId: alert.externalId,
          },
        });

    upserted += 1;
    storms.push({ id: storm.id, name: storm.name, source: storm.source });
  }

  return {
    provider,
    fetched: alerts.length,
    upserted,
    skipped,
    storms,
  };
}
