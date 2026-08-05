import { jsonError, jsonOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/user";
import { isStripeConfigured } from "@/lib/stripe/config";
import { createBillingPortalSession } from "@/lib/stripe/billing";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return jsonError("Unauthorized", 401);

  if (!isStripeConfigured() || !user.stripeCustomerId) {
    return jsonError(
      "Stripe customer portal is available after a live Stripe subscription is connected",
      400
    );
  }

  try {
    const session = await createBillingPortalSession(user);
    return jsonOk({ ok: true, url: session.url });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Portal failed", 400);
  }
}
