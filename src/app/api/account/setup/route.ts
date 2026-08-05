import { z } from "zod";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/user";

const schema = z.object({
  companyName: z.string().trim().min(2).max(120),
  agentName: z.string().trim().min(2).max(80),
  agentEmail: z.string().trim().email().max(254),
  agentPhone: z.string().trim().max(40).optional().nullable(),
  website: z.string().trim().max(200).optional().nullable(),
  replyToEmail: z.string().trim().email().max(254).optional().nullable().or(z.literal("")),
  signature: z.string().trim().max(500).optional().nullable(),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonError("Unauthorized", 401);

  const settings = await prisma.companySettings.findFirst({
    where: { OR: [{ userId: user.id }, { userId: null }] },
    orderBy: { updatedAt: "desc" },
  });

  return jsonOk({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      onboardingStep: user.onboardingStep,
    },
    settings: settings
      ? {
          companyName: settings.companyName,
          agentName: settings.agentName,
          agentEmail: settings.agentEmail,
          agentPhone: settings.agentPhone,
          website: settings.website,
          replyToEmail: settings.replyToEmail,
          signature: settings.signature,
        }
      : {
          companyName: "",
          agentName: user.name,
          agentEmail: user.email,
          agentPhone: user.phone,
          website: "",
          replyToEmail: user.email,
          signature: "",
        },
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Unauthorized", 401);

  try {
    const body = schema.parse(await request.json());
    const data = {
      companyName: body.companyName,
      agentName: body.agentName,
      agentEmail: body.agentEmail.toLowerCase(),
      agentPhone: body.agentPhone || null,
      website: body.website || null,
      replyToEmail: body.replyToEmail || body.agentEmail.toLowerCase(),
      signature: body.signature || null,
      userId: user.id,
    };

    const existing = await prisma.companySettings.findFirst({
      where: { userId: user.id },
    });

    const settings = existing
      ? await prisma.companySettings.update({ where: { id: existing.id }, data })
      : await prisma.companySettings.create({ data });

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        name: body.agentName,
        phone: body.agentPhone || user.phone,
        onboardingStep:
          user.onboardingStep === "complete" ? "complete" : "billing",
      },
    });

    return jsonOk({
      ok: true,
      settings,
      user: {
        id: updatedUser.id,
        onboardingStep: updatedUser.onboardingStep,
        subscriptionStatus: updatedUser.subscriptionStatus,
      },
      next: "/account/billing",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError(error.issues[0]?.message || "Invalid account setup data");
    }
    return jsonError(error instanceof Error ? error.message : "Setup failed", 400);
  }
}
