import {
  mapEventToStormType,
  mapSeverity,
  type NormalizedAlert,
} from "@/lib/weather/types";
import {
  extractCitiesFromAreaDesc,
  geometryCentroid,
  lookupCityCoords,
} from "@/lib/geo/cities";

const NWS = "https://api.weather.gov";
const UA = "TerritoryMonitor/1.0 (restoration-outreach; contact@territorymonitor.local)";

type NwsFeature = {
  id: string;
  geometry: {
    type: string;
    coordinates: unknown;
  } | null;
  properties: {
    id?: string;
    event?: string;
    severity?: string;
    headline?: string;
    description?: string;
    areaDesc?: string;
    onset?: string | null;
    effective?: string | null;
    ends?: string | null;
    expires?: string | null;
    status?: string;
    messageType?: string;
    certainty?: string;
    urgency?: string;
  };
};

/**
 * National Weather Service active alerts — free, no API key.
 * Weather.com US government alerts are sourced from this same NWS feed.
 */
export async function fetchNwsAlerts(options?: {
  area?: string; // state code e.g. WI
  limit?: number;
}): Promise<NormalizedAlert[]> {
  const params = new URLSearchParams({ status: "actual" });
  if (options?.area) params.set("area", options.area.toUpperCase());

  const res = await fetch(`${NWS}/alerts/active?${params.toString()}`, {
    headers: {
      "User-Agent": UA,
      Accept: "application/geo+json",
    },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`NWS alerts failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const json = (await res.json()) as { features?: NwsFeature[] };
  const features = json.features || [];
  const limit = options?.limit ?? 60;

  const relevant = features
    .filter((f) => {
      const event = (f.properties.event || "").toLowerCase();
      return (
        event.includes("thunder") ||
        event.includes("tornado") ||
        event.includes("severe") ||
        event.includes("flood") ||
        event.includes("wind") ||
        event.includes("hail") ||
        event.includes("hurricane") ||
        event.includes("tropical") ||
        event.includes("winter") ||
        event.includes("blizzard") ||
        event.includes("storm")
      );
    })
    .slice(0, limit);

  return relevant.map((f) => {
    const p = f.properties;
    const event = p.event || "Weather Alert";
    const areaDesc = p.areaDesc || "";
    const cities = extractCitiesFromAreaDesc(areaDesc);
    const states = Array.from(
      new Set(
        (areaDesc.match(/\b[A-Z]{2}\b/g) || []).filter((s) => s !== "US")
      )
    );

    // Prefer geometry centroid; else first known city
    let lat: number | null = null;
    let lng: number | null = null;
    const centroid = geometryCentroid(f.geometry as never);
    if (centroid) {
      lat = centroid.lat;
      lng = centroid.lng;
    } else if (cities[0] && states[0]) {
      const coords = lookupCityCoords(cities[0], states[0]);
      if (coords) {
        lat = coords.lat;
        lng = coords.lng;
      }
    }

    const onset = p.onset || p.effective || new Date().toISOString();
    const ends = p.ends || p.expires || null;

    return {
      externalId: `nws:${p.id || f.id}`,
      source: "nws" as const,
      name: p.headline || `${event}${areaDesc ? ` — ${areaDesc.split(";")[0]}` : ""}`,
      type: mapEventToStormType(event),
      severity: mapSeverity(p.severity || event),
      description: (p.description || p.headline || event).slice(0, 2000),
      affectedCities: cities,
      affectedStates: states.length ? states : [],
      latitude: lat,
      longitude: lng,
      radiusMiles: 40,
      etaStart: new Date(onset),
      etaEnd: ends ? new Date(ends) : null,
      status: "active" as const,
      geometry: f.geometry,
      areaDesc: areaDesc || null,
    };
  });
}
