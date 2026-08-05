import { prisma } from "@/lib/db";
import { jsonError, jsonOk, readJson } from "@/lib/api";
import { parseStringArray } from "@/lib/json";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      storm: true,
      rule: true,
      emails: {
        include: { contact: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!campaign) return jsonError("Campaign not found", 404);

  return jsonOk({
    ...campaign,
    storm: {
      ...campaign.storm,
      affectedCities: parseStringArray(campaign.storm.affectedCities),
      affectedStates: parseStringArray(campaign.storm.affectedStates),
    },
  });
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await readJson<{ status?: string }>(request);

  if (!body.status) return jsonError("status is required");

  const campaign = await prisma.campaign.update({
    where: { id },
    data: { status: body.status },
  });

  if (body.status === "cancelled") {
    await prisma.emailLog.updateMany({
      where: { campaignId: id, status: "queued" },
      data: { status: "skipped" },
    });
  }

  return jsonOk(campaign);
}
