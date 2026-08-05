import {
  mapEventToStormType,
  mapSeverity,
  type NormalizedAlert,
} from "@/lib/weather/types";
import { extractCitiesFromAreaDesc } from "@/lib/geo/cities";

const BASE = "https://api.weather.com/v3";

type Headline = {
  detailKey?: string;
  eventDescription?: string;
  headlineText?: string;
  severity?: string;
  urgency?: string;
  certainty?: string;
  areaName?: string;
  areaId?: string;
  countryCode?: string;
  adminDistrictCode?: string;
  issueTimeLocal?: string;
  expireTimeLocal?: string;
  expireTimeUTC?: number;
  onsetTimeLocal?: string;
  latitude?: number;
  longitude?: number;
};

/**
 * Weather.com (The Weather Company) Alerts Headlines API.
 * Requires WEATHER_COM_API_KEY from developer.weather.com.
 *
 * Docs: GET /v3/alerts/headlines?geocode=lat,lon&format=json&language=en-US&apiKey=
 *   or  /v3/alerts/headlines?countryCode=US&format=json&language=en-US&apiKey=
 */
export async function fetchWeatherComAlerts(options?: {
  geocode?: { lat: number; lng: number };
  countryCode?: string;
}): Promise<NormalizedAlert[]> {
  const apiKey = process.env.WEATHER_COM_API_KEY;
  if (!apiKey) {
    throw new Error("WEATHER_COM_API_KEY is not configured");
  }

  const params = new URLSearchParams({
    format: "json",
    language: "en-US",
    apiKey,
  });

  if (options?.geocode) {
    params.set("geocode", `${options.geocode.lat},${options.geocode.lng}`);
  } else {
    params.set("countryCode", options?.countryCode || "US");
  }

  const url = `${BASE}/alerts/headlines?${params.toString()}`;
  const res = await fetch(url, { next: { revalidate: 0 } });

  if (res.status === 204) return [];
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Weather.com alerts failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const json = (await res.json()) as {
    alerts?: Headline[];
    // some payloads nest differently
    [key: string]: unknown;
  };

  const headlines: Headline[] = Array.isArray(json.alerts)
    ? json.alerts
    : Array.isArray(json)
      ? (json as Headline[])
      : [];

  return headlines
    .filter((h) => h.detailKey || h.headlineText)
    .slice(0, 80)
    .map((h) => {
      const event = h.eventDescription || "Weather Alert";
      const area = h.areaName || "";
      const states = h.adminDistrictCode
        ? [h.adminDistrictCode.replace(/:.*$/, "").toUpperCase()]
        : [];
      const cities = area ? extractCitiesFromAreaDesc(area) : [];
      const onset = h.onsetTimeLocal || h.issueTimeLocal;
      const expire = h.expireTimeLocal;

      return {
        externalId: `weather.com:${h.detailKey || h.headlineText}`,
        source: "weather.com" as const,
        name: h.headlineText || `${event}${area ? ` — ${area}` : ""}`,
        type: mapEventToStormType(event),
        severity: mapSeverity(h.severity || event),
        description: h.headlineText || event,
        affectedCities: cities,
        affectedStates: states,
        latitude: typeof h.latitude === "number" ? h.latitude : null,
        longitude: typeof h.longitude === "number" ? h.longitude : null,
        radiusMiles: 35,
        etaStart: onset ? new Date(onset) : new Date(),
        etaEnd: expire
          ? new Date(expire)
          : h.expireTimeUTC
            ? new Date(h.expireTimeUTC * 1000)
            : null,
        status: "approaching" as const,
        geometry: null,
        areaDesc: area || null,
      };
    });
}

export function hasWeatherComKey(): boolean {
  return Boolean(process.env.WEATHER_COM_API_KEY);
}
