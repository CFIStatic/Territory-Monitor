import { jsonError, jsonOk, readJson } from "@/lib/api";
import { hasWeatherComKey } from "@/lib/weather/weather-com";
import { syncWeatherAlerts } from "@/lib/weather/sync";
import { guardRequest } from "@/lib/security/guard";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  return jsonOk({
    weatherComConfigured: hasWeatherComKey(),
    providers: {
      primary: hasWeatherComKey() ? "weather.com" : "nws",
      fallback: "nws",
      note: hasWeatherComKey()
        ? "Using Weather.com Alerts API (api.weather.com)."
        : "Set WEATHER_COM_API_KEY to use Weather.com. Currently syncing via NWS (same US government alert source Weather.com uses).",
    },
  });
}

export async function POST(request: Request) {
  const blocked = guardRequest(request, {
    bucket: "weather-sync",
    limit: 20,
    windowMs: 60_000,
    requireAuth: true,
  });
  if (blocked) return blocked;

  try {
    const body = await readJson<{
      area?: string;
      provider?: "weather.com" | "nws";
    }>(request).catch(() => ({} as { area?: string; provider?: "weather.com" | "nws" }));

    const result = await syncWeatherAlerts({
      area: body.area,
      forceProvider: body.provider,
    });

    return jsonOk({
      ok: true,
      syncedAt: new Date().toISOString(),
      weatherComConfigured: hasWeatherComKey(),
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Weather sync failed";
    console.error("[weather/sync]", error);
    return jsonError(message, 500);
  }
}
