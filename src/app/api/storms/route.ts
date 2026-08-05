import { prisma } from "@/lib/db";
import { jsonError, jsonOk, readJson } from "@/lib/api";
import { toJsonArray } from "@/lib/json";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const storms = await prisma.stormEvent.findMany({
    where: status ? { status } : undefined,
    include: {
      _count: { select: { campaigns: true } },
    },
    orderBy: { etaStart: "asc" },
  });

  return jsonOk(
    storms.map((s) => ({
      ...s,
      affectedCities: JSON.parse(s.affectedCities || "[]"),
      affectedStates: JSON.parse(s.affectedStates || "[]"),
      affectedZips: JSON.parse(s.affectedZips || "[]"),
    }))
  );
}

export async function POST(request: Request) {
  const body = await readJson<{
    name?: string;
    type?: string;
    severity?: string;
    description?: string;
    affectedCities?: string[] | string;
    affectedStates?: string[] | string;
    affectedZips?: string[] | string;
    latitude?: number;
    longitude?: number;
    radiusMiles?: number;
    etaStart?: string;
    etaEnd?: string;
    status?: string;
  }>(request);

  if (!body.name || !body.type || !body.severity || !body.etaStart) {
    return jsonError("name, type, severity, and etaStart are required");
  }

  const storm = await prisma.stormEvent.create({
    data: {
      name: body.name.trim(),
      type: body.type,
      severity: body.severity,
      description: body.description?.trim() || null,
      affectedCities: toJsonArray(body.affectedCities),
      affectedStates: toJsonArray(body.affectedStates),
      affectedZips: body.affectedZips ? toJsonArray(body.affectedZips) : null,
      latitude: body.latitude ?? null,
      longitude: body.longitude ?? null,
      radiusMiles: body.radiusMiles ?? null,
      etaStart: new Date(body.etaStart),
      etaEnd: body.etaEnd ? new Date(body.etaEnd) : null,
      status: body.status || "forecast",
    },
  });

  return jsonOk(
    {
      ...storm,
      affectedCities: JSON.parse(storm.affectedCities || "[]"),
      affectedStates: JSON.parse(storm.affectedStates || "[]"),
      affectedZips: JSON.parse(storm.affectedZips || "[]"),
    },
    { status: 201 }
  );
}
