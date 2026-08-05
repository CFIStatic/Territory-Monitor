import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/user";
import { isStripeConfigured, type PlanKey } from "@/lib/stripe/config";
import {
  activateDemoSubscription,
  createCheckoutSession,
} from "@/lib/stripe/billing";
import { guardRequest } from "@/lib/security/guard";

const schema = z.object({
  planKey: z.enum(["starter", "pro"]),
  demo: z.boolean().optional(),
});

export async function POST(request: Request) {
  const blocked = guardRequest(request, {
    bucket: "billing-checkout",
    limit: 20,
    windowMs: 60_000,
    requireAuth: false,
  });
  if (blocked) return blocked;

  const user = await getCurrentUser();
  if (!user) return jsonError("Unauthorized", 401);

  try {
    const body = schema.parse(await request.json());
    const planKey = body.planKey as PlanKey;

    // Demo billing when Stripe is not configured, or when client requests demo
    if (body.demo || !isStripeConfigured()) {
      const updated = await activateDemoSubscription(user.id, planKey);
      return jsonOk({
        ok: true,
        mode: "demo",
        user: {
          id: updated.id,
          planKey: updated.planKey,
          subscriptionStatus: updated.subscriptionStatus,
          onboardingStep: updated.onboardingStep,
        },
        next: "/dashboard",
      });
    }

    const session = await createCheckoutSession(user, planKey);
    if (!session.url) return jsonError("Stripe did not return a checkout URL", 502);

    return jsonOk({
      ok: true,
      mode: "stripe",
      checkoutUrl: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError(error.issues[0]?.message || "Invalid checkout request");
    }
    return jsonError(error instanceof Error ? error.message : "Checkout failed", 400);
  }
}
