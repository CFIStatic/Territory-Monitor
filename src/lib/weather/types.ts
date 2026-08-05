export type NormalizedAlert = {
  externalId: string;
  source: "weather.com" | "nws";
  name: string;
  type: string;
  severity: string;
  description: string | null;
  affectedCities: string[];
  affectedStates: string[];
  latitude: number | null;
  longitude: number | null;
  radiusMiles: number | null;
  etaStart: Date;
  etaEnd: Date | null;
  status: "forecast" | "approaching" | "active" | "passed" | "cancelled";
  geometry: unknown | null;
  areaDesc: string | null;
};

export function mapEventToStormType(event: string): string {
  const e = event.toLowerCase();
  if (e.includes("tornado")) return "tornado";
  if (e.includes("hurricane") || e.includes("tropical")) return "hurricane";
  if (e.includes("hail")) return "hail";
  if (e.includes("flood") || e.includes("flash flood")) return "flood";
  if (e.includes("winter") || e.includes("blizzard") || e.includes("ice storm")) {
    return "winter";
  }
  if (e.includes("wind") || e.includes("high wind")) return "wind";
  if (e.includes("thunder") || e.includes("severe")) return "thunderstorm";
  return "thunderstorm";
}

export function mapSeverity(raw: string | null | undefined): string {
  const s = (raw || "").toLowerCase();
  if (s.includes("extreme")) return "extreme";
  if (s.includes("severe") || s.includes("warning")) return "warning";
  if (s.includes("moderate") || s.includes("watch")) return "watch";
  if (s.includes("minor") || s.includes("advisory") || s.includes("statement")) {
    return "advisory";
  }
  // NWS uses Extreme|Severe|Moderate|Minor|Unknown
  if (s === "extreme") return "extreme";
  if (s === "severe") return "warning";
  if (s === "moderate") return "watch";
  return "advisory";
}
