import { z } from "zod";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/api";
import { verifyPassword } from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/session";
import { nextOnboardingPath } from "@/lib/auth/user";
import { guardRequest } from "@/lib/security/guard";
import { logSecurityEvent } from "@/lib/security/audit";

const schema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(128),
});

export async function POST(request: Request) {
  const blocked = guardRequest(request, {
    bucket: "auth-login",
    limit: 20,
    windowMs: 60_000,
    requireAuth: false,
  });
  if (blocked) return blocked;

  try {
    const body = schema.parse(await request.json());
    const email = body.email.toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      logSecurityEvent("auth_fail", "Login failed — invalid credentials", { email });
      return jsonError("Invalid email or password", 401);
    }

    await setSessionCookie({
      userId: user.id,
      email: user.email,
      name: user.name,
    });

    return jsonOk({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        onboardingStep: user.onboardingStep,
        subscriptionStatus: user.subscriptionStatus,
        planKey: user.planKey,
      },
      next: nextOnboardingPath(user),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError(error.issues[0]?.message || "Invalid login data");
    }
    return jsonError("Login failed", 400);
  }
}
