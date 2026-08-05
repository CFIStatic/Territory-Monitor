import { prisma } from "@/lib/db";
import { getStripe, isStripeConfigured } from "./client";
import { getAppUrl, getPlan, type PlanKey } from "./config";
import { addDays } from "date-fns";

export async function ensureStripeCustomer(user: {
  id: string;
  email: string;
  name: string;
  stripeCustomerId: string | null;
}) {
  if (!isStripeConfigured()) {
    return null;
  }
  if (user.stripeCustomerId) return user.stripeCustomerId;

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name,
    metadata: { userId: user.id },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

export async function createCheckoutSession(user: {
  id: string;
  email: string;
  name: string;
  stripeCustomerId: string | null;
}, planKey: PlanKey) {
  const plan = getPlan(planKey);
  if (!plan) throw new Error("Unknown plan");
  if (!plan.priceId) {
    throw new Error(
      `Stripe price not configured for ${planKey}. Set STRIPE_PRICE_${planKey.toUpperCase()} or use demo billing.`
    );
  }

  const customerId = await ensureStripeCustomer(user);
  const stripe = getStripe();
  const appUrl = getAppUrl();

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId ?? undefined,
    customer_email: customerId ? undefined : user.email,
    line_items: [{ price: plan.priceId, quantity: 1 }],
    success_url: `${appUrl}/account/billing?success=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/account/billing?canceled=1`,
    client_reference_id: user.id,
    metadata: { userId: user.id, planKey },
    subscription_data: {
      metadata: { userId: user.id, planKey },
      trial_period_days: 14,
    },
    allow_promotion_codes: true,
  });

  return session;
}

export async function createBillingPortalSession(user: {
  stripeCustomerId: string | null;
}) {
  if (!user.stripeCustomerId) {
    throw new Error("No Stripe customer on this account");
  }
  const stripe = getStripe();
  return stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${getAppUrl()}/account/billing`,
  });
}

/** Local/demo path when Stripe keys are not set */
export async function activateDemoSubscription(userId: string, planKey: PlanKey) {
  const plan = getPlan(planKey);
  if (!plan) throw new Error("Unknown plan");

  return prisma.user.update({
    where: { id: userId },
    data: {
      planKey,
      subscriptionStatus: "demo",
      onboardingStep: "complete",
      trialEndsAt: addDays(new Date(), 14),
      stripePriceId: plan.priceId,
    },
  });
}

export async function applySubscriptionUpdate(params: {
  userId?: string | null;
  customerId?: string | null;
  subscriptionId?: string | null;
  status?: string | null;
  priceId?: string | null;
  planKey?: string | null;
}) {
  let user =
    (params.userId
      ? await prisma.user.findUnique({ where: { id: params.userId } })
      : null) ||
    (params.customerId
      ? await prisma.user.findUnique({ where: { stripeCustomerId: params.customerId } })
      : null) ||
    (params.subscriptionId
      ? await prisma.user.findUnique({
          where: { stripeSubscriptionId: params.subscriptionId },
        })
      : null);

  if (!user) return null;

  const statusMap: Record<string, string> = {
    active: "active",
    trialing: "trialing",
    past_due: "past_due",
    canceled: "canceled",
    unpaid: "past_due",
    incomplete: "none",
    incomplete_expired: "canceled",
  };

  const subscriptionStatus = params.status
    ? statusMap[params.status] || params.status
    : user.subscriptionStatus;

  const active =
    subscriptionStatus === "active" || subscriptionStatus === "trialing";

  return prisma.user.update({
    where: { id: user.id },
    data: {
      stripeCustomerId: params.customerId || user.stripeCustomerId,
      stripeSubscriptionId: params.subscriptionId || user.stripeSubscriptionId,
      stripePriceId: params.priceId || user.stripePriceId,
      planKey: params.planKey || user.planKey,
      subscriptionStatus,
      onboardingStep: active ? "complete" : user.onboardingStep,
    },
  });
}
