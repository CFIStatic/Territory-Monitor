import { prisma } from "@/lib/db";
import { jsonError, jsonOk, readJson } from "@/lib/api";
import { toJsonArray } from "@/lib/json";
import {
  DEFAULT_EMAIL_BODY,
  DEFAULT_EMAIL_SUBJECT,
  DEFAULT_VOICE_NOTES,
} from "@/lib/templates";

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

export async function GET() {
  const rules = await prisma.outreachRule.findMany({
    include: {
      contactList: true,
      _count: { select: { campaigns: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return jsonOk(rules.map(serialize));
}

export async function POST(request: Request) {
  const body = await readJson<{
    name?: string;
    description?: string;
    enabled?: boolean;
    stormTypes?: string[] | string;
    minSeverity?: string;
    hoursBeforeEta?: number;
    targetCities?: string[] | string;
    targetStates?: string[] | string;
    contactListId?: string | null;
    writingMode?: string;
    voiceNotes?: string;
    emailSubject?: string;
    emailBody?: string;
    fromName?: string;
  }>(request);

  if (!body.name?.trim()) return jsonError("name is required");

  const writingMode = body.writingMode === "template" ? "template" : "agent";

  const rule = await prisma.outreachRule.create({
    data: {
      name: body.name.trim(),
      description: body.description?.trim() || null,
      enabled: body.enabled ?? true,
      stormTypes: toJsonArray(body.stormTypes ?? ["thunderstorm", "hail", "tornado"]),
      minSeverity: body.minSeverity || "watch",
      hoursBeforeEta: body.hoursBeforeEta ?? 24,
      targetCities: body.targetCities ? toJsonArray(body.targetCities) : null,
      targetStates: body.targetStates ? toJsonArray(body.targetStates) : null,
      contactListId: body.contactListId || null,
      writingMode,
      voiceNotes: body.voiceNotes?.trim() || DEFAULT_VOICE_NOTES,
      emailSubject: body.emailSubject?.trim() || DEFAULT_EMAIL_SUBJECT,
      emailBody: body.emailBody?.trim() || DEFAULT_EMAIL_BODY,
      fromName: body.fromName?.trim() || null,
    },
    include: { contactList: true },
  });

  return jsonOk(serialize(rule), { status: 201 });
}
