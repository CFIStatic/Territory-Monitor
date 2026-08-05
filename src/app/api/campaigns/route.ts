import { prisma } from "@/lib/db";
import { jsonOk } from "@/lib/api";
import { parseStringArray } from "@/lib/json";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const campaigns = await prisma.campaign.findMany({
    where: status ? { status } : undefined,
    include: {
      storm: true,
      rule: true,
      _count: { select: { emails: true } },
    },
    orderBy: { scheduledFor: "desc" },
  });

  return jsonOk(
    campaigns.map((c) => ({
      ...c,
      storm: {
        ...c.storm,
        affectedCities: parseStringArray(c.storm.affectedCities),
        affectedStates: parseStringArray(c.storm.affectedStates),
      },
    }))
  );
}
