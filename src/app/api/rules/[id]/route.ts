import { prisma } from "@/lib/db";
import { jsonError, jsonOk, readJson } from "@/lib/api";
import { toJsonArray } from "@/lib/json";

type Params = { params: Promise<{ id: string }> };

function serialize(rule: {
  stormTypes: string;
  targetCities: string | null;
  targetStates: string | null;
  [key: string]: unknown;
}) {
  return {
    ...rule,
    stormTypes: JSON.parse(rule.stormTypes || "[]"),
    targetCities: JSON.parse(rule.targetCities || "[]"),
    targetStates: JSON.parse(rule.targetStates || "[]"),
  };
}

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const rule = await prisma.outreachRule.findUnique({
    where: { id },
    include: { contactList: true, campaigns: { orderBy: { createdAt: "desc" } } },
  });
  if (!rule) return jsonError("Rule not found", 404);
  return jsonOk(serialize(rule));
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await readJson<Record<string, unknown>>(request);

  const rule = await prisma.outreachRule.update({
    where: { id },
    data: {
      ...(typeof body.name === "string" ? { name: body.name.trim() } : {}),
      ...(body.description !== undefined
        ? { description: body.description ? String(body.description) : null }
        : {}),
      ...(typeof body.enabled === "boolean" ? { enabled: body.enabled } : {}),
      ...(body.stormTypes !== undefined
        ? { stormTypes: toJsonArray(body.stormTypes as string[] | string) }
        : {}),
      ...(typeof body.minSeverity === "string"
        ? { minSeverity: body.minSeverity }
        : {}),
      ...(body.hoursBeforeEta !== undefined
        ? { hoursBeforeEta: Number(body.hoursBeforeEta) }
        : {}),
      ...(body.targetCities !== undefined
        ? {
            targetCities: body.targetCities
              ? toJsonArray(body.targetCities as string[] | string)
              : null,
          }
        : {}),
      ...(body.targetStates !== undefined
        ? {
            targetStates: body.targetStates
              ? toJsonArray(body.targetStates as string[] | string)
              : null,
          }
        : {}),
      ...(body.contactListId !== undefined
        ? { contactListId: body.contactListId ? String(body.contactListId) : null }
        : {}),
      ...(typeof body.emailSubject === "string"
        ? { emailSubject: body.emailSubject }
        : {}),
      ...(typeof body.emailBody === "string" ? { emailBody: body.emailBody } : {}),
      ...(body.fromName !== undefined
        ? { fromName: body.fromName ? String(body.fromName) : null }
        : {}),
    },
    include: { contactList: true },
  });

  return jsonOk(serialize(rule));
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  await prisma.outreachRule.delete({ where: { id } });
  return jsonOk({ ok: true });
}
