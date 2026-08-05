import { prisma } from "@/lib/db";
import { jsonError, jsonOk, readJson } from "@/lib/api";

export async function GET() {
  const settings =
    (await prisma.companySettings.findFirst()) ??
    (await prisma.companySettings.create({
      data: {
        companyName: "Your Restoration Company",
        agentName: "Sales Agent",
        agentEmail: "agent@example.com",
      },
    }));
  return jsonOk(settings);
}

export async function PUT(request: Request) {
  const body = await readJson<{
    companyName?: string;
    agentName?: string;
    agentEmail?: string;
    agentPhone?: string;
    website?: string;
    replyToEmail?: string;
    signature?: string;
  }>(request);

  if (!body.companyName || !body.agentName || !body.agentEmail) {
    return jsonError("companyName, agentName, and agentEmail are required");
  }

  const existing = await prisma.companySettings.findFirst();
  const data = {
    companyName: body.companyName.trim(),
    agentName: body.agentName.trim(),
    agentEmail: body.agentEmail.trim(),
    agentPhone: body.agentPhone?.trim() || null,
    website: body.website?.trim() || null,
    replyToEmail: body.replyToEmail?.trim() || null,
    signature: body.signature?.trim() || null,
  };

  const settings = existing
    ? await prisma.companySettings.update({ where: { id: existing.id }, data })
    : await prisma.companySettings.create({ data });

  return jsonOk(settings);
}
