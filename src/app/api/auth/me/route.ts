import { jsonOk } from "@/lib/api";
import { getCurrentUser, hasActiveSubscription } from "@/lib/auth/user";
import { isStripeConfigured, getPlans } from "@/lib/stripe/config";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return jsonOk({ authenticated: false, user: null });
  }

  return jsonOk({
    authenticated: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      onboardingStep: user.onboardingStep,
      subscriptionStatus: user.subscriptionStatus,
      planKey: user.planKey,
      trialEndsAt: user.trialEndsAt,
      stripeCustomerId: user.stripeCustomerId,
      hasActiveSubscription: hasActiveSubscription(user.subscriptionStatus),
    },
    billing: {
      stripeConfigured: isStripeConfigured(),
      plans: getPlans().map(({ priceId: _p, ...rest }) => rest),
    },
  });
}
