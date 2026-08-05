import { prisma } from "@/lib/db";
import { jsonError, jsonOk, readJson } from "@/lib/api";
import { runOutreachEngine } from "@/lib/engine";
import { toJsonArray } from "@/lib/json";
import { addHours } from "date-fns";

/**
 * Launch outreach from the territory map.
 * - If stormId provided: run engine (optionally scoped by ensuring storm is active)
 * - If cities provided without storm: create a local "territory alert" storm then run engine
 */
export async function POST(request: Request) {
  const body = await readJson<{
    stormId?: string;
    cities?: string[];
    states?: string[];
    ruleId?: string;
    runEngine?: boolean;
    alertName?: string;
  }>(request);

  const runEngine = body.runEngine !== false;
  let stormId = body.stormId;

  if (!stormId && (!body.cities || body.cities.length === 0)) {
    return jsonError("Provide stormId or cities[] to alert a territory");
  }

  // Optional: focus a rule's target cities for this send by creating a scoped storm
  if (!stormId && body.cities?.length) {
    const states =
      body.states?.length
        ? body.states
        : (
            await prisma.contact.findMany({
              where: { city: { in: body.cities } },
              select: { state: true },
              distinct: ["state"],
            })
          ).map((c) => c.state);

    const firstContact = await prisma.contact.findFirst({
      where: { city: body.cities[0] },
    });

    const storm = await prisma.stormEvent.create({
      data: {
        name:
          body.alertName?.trim() ||
          `Territory alert — ${body.cities.slice(0, 3).join(", ")}`,
        type: "thunderstorm",
        severity: "warning",
        description: `Manual territory alert launched from the map for ${body.cities.join(", ")}.`,
        affectedCities: toJsonArray(body.cities),
        affectedStates: toJsonArray(states),
        latitude: null,
        longitude: null,
        radiusMiles: 30,
        etaStart: addHours(new Date(), 12),
        etaEnd: addHours(new Date(), 36),
        status: "approaching",
        source: "manual",
        areaDesc: body.cities.join("; "),
      },
    });
    stormId = storm.id;

    // If a specific rule was chosen, temporarily ensure it can match (no-op if already broad)
    if (body.ruleId) {
      await prisma.outreachRule.update({
        where: { id: body.ruleId },
        data: {
          enabled: true,
          // Keep hours small so scheduledFor is soon
          hoursBeforeEta: 24,
        },
      });
    }

    void firstContact;
  }

  if (stormId) {
    // Ensure selected storm is in an actionable status
    await prisma.stormEvent.update({
      where: { id: stormId },
      data: {
        status: "approaching",
        ...(body.cities?.length
          ? { affectedCities: toJsonArray(body.cities) }
          : {}),
      },
    });
  }

  let engineResult = null;
  if (runEngine) {
    engineResult = await runOutreachEngine(new Date());
  }

  const campaigns = stormId
    ? await prisma.campaign.findMany({
        where: { stormId },
        include: {
          rule: { select: { name: true } },
          _count: { select: { emails: true } },
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return jsonOk({
    ok: true,
    stormId,
    campaigns,
    engine: engineResult,
  });
}
