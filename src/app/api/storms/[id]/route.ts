import { prisma } from "@/lib/db";
import { jsonError, jsonOk, readJson } from "@/lib/api";
import { toJsonArray } from "@/lib/json";

type Params = { params: Promise<{ id: string }> };

function serialize(storm: {
  affectedCities: string;
  affectedStates: string;
  affectedZips: string | null;
  [key: string]: unknown;
}) {
  return {
    ...storm,
    affectedCities: JSON.parse(storm.affectedCities || "[]"),
    affectedStates: JSON.parse(storm.affectedStates || "[]"),
    affectedZips: JSON.parse(storm.affectedZips || "[]"),
  };
}

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const storm = await prisma.stormEvent.findUnique({
    where: { id },
    include: {
      campaigns: {
        include: { rule: true, _count: { select: { emails: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!storm) return jsonError("Storm not found", 404);
  return jsonOk(serialize(storm));
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await readJson<Record<string, unknown>>(request);

  const storm = await prisma.stormEvent.update({
    where: { id },
    data: {
      ...(typeof body.name === "string" ? { name: body.name.trim() } : {}),
      ...(typeof body.type === "string" ? { type: body.type } : {}),
      ...(typeof body.severity === "string" ? { severity: body.severity } : {}),
      ...(body.description !== undefined
        ? { description: body.description ? String(body.description) : null }
        : {}),
      ...(body.affectedCities !== undefined
        ? { affectedCities: toJsonArray(body.affectedCities as string[] | string) }
        : {}),
      ...(body.affectedStates !== undefined
        ? { affectedStates: toJsonArray(body.affectedStates as string[] | string) }
        : {}),
      ...(body.affectedZips !== undefined
        ? {
            affectedZips: body.affectedZips
              ? toJsonArray(body.affectedZips as string[] | string)
              : null,
          }
        : {}),
      ...(body.etaStart ? { etaStart: new Date(String(body.etaStart)) } : {}),
      ...(body.etaEnd !== undefined
        ? { etaEnd: body.etaEnd ? new Date(String(body.etaEnd)) : null }
        : {}),
      ...(typeof body.status === "string" ? { status: body.status } : {}),
      ...(body.latitude !== undefined ? { latitude: Number(body.latitude) } : {}),
      ...(body.longitude !== undefined ? { longitude: Number(body.longitude) } : {}),
      ...(body.radiusMiles !== undefined
        ? { radiusMiles: Number(body.radiusMiles) }
        : {}),
    },
  });

  return jsonOk(serialize(storm));
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  await prisma.stormEvent.delete({ where: { id } });
  return jsonOk({ ok: true });
}
