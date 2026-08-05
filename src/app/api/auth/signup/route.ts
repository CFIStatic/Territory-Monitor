import { z } from "zod";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/api";
import { hashPassword, validatePasswordStrength } from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/session";
import { guardRequest } from "@/lib/security/guard";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
  phone: z.string().trim().max(40).optional().nullable(),
});

export async function POST(request: Request) {
  const blocked = guardRequest(request, {
    bucket: "auth-signup",
    limit: 10,
    windowMs: 60_000,
    requireAuth: false,
  });
  if (blocked) return blocked;

  try {
    const body = schema.parse(await request.json());
    const strength = validatePasswordStrength(body.password);
    if (strength) return jsonError(strength);

    const email = body.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return jsonError("An account with this email already exists", 409);

    const user = await prisma.user.create({
      data: {
        name: body.name,
        email,
        phone: body.phone || null,
        passwordHash: await hashPassword(body.password),
        onboardingStep: "company",
        subscriptionStatus: "none",
      },
    });

    await setSessionCookie({
      userId: user.id,
      email: user.email,
      name: user.name,
    });

    return jsonOk(
      {
        ok: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          onboardingStep: user.onboardingStep,
          subscriptionStatus: user.subscriptionStatus,
        },
        next: "/account/setup",
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError(error.issues[0]?.message || "Invalid signup data");
    }
    const message = error instanceof Error ? error.message : "Signup failed";
    return jsonError(message, 400);
  }
}
