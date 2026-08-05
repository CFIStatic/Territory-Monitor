import { prisma } from "@/lib/db";
import { getSession } from "./session";

export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  return prisma.user.findUnique({ where: { id: session.userId } });
}

export function hasActiveSubscription(status: string | null | undefined): boolean {
  return status === "active" || status === "trialing" || status === "demo";
}

export function nextOnboardingPath(user: {
  onboardingStep: string;
  subscriptionStatus: string;
}): string {
  if (user.onboardingStep === "company") return "/account/setup";
  if (user.onboardingStep === "billing" || !hasActiveSubscription(user.subscriptionStatus)) {
    return "/account/billing";
  }
  return "/dashboard";
}
