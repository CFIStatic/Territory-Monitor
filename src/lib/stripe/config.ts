export type PlanKey = "starter" | "pro";

export type Plan = {
  key: PlanKey;
  name: string;
  priceLabel: string;
  priceCents: number;
  description: string;
  features: string[];
  /** Stripe Price ID from env when configured */
  priceId: string | null;
};

export function getAppUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    process.env.APP_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function getPlans(): Plan[] {
  return [
    {
      key: "starter",
      name: "Starter",
      priceLabel: "$49/mo",
      priceCents: 4900,
      description: "For solo restoration agents covering one metro.",
      features: [
        "Up to 5,000 contacts",
        "Weather + territory map",
        "Outreach agent emails",
        "Email support",
      ],
      priceId: process.env.STRIPE_PRICE_STARTER?.trim() || null,
    },
    {
      key: "pro",
      name: "Pro",
      priceLabel: "$149/mo",
      priceCents: 14900,
      description: "For growing teams running multi-city storm campaigns.",
      features: [
        "Unlimited contacts",
        "Priority weather sync",
        "Team-ready campaign history",
        "Priority support",
      ],
      priceId: process.env.STRIPE_PRICE_PRO?.trim() || null,
    },
  ];
}

export function getPlan(key: string | null | undefined): Plan | null {
  if (!key) return null;
  return getPlans().find((p) => p.key === key) ?? null;
}
