"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, CreditCard } from "lucide-react";

type Plan = {
  key: "starter" | "pro";
  name: string;
  priceLabel: string;
  description: string;
  features: string[];
};

type MeResponse = {
  authenticated: boolean;
  user: {
    name: string;
    email: string;
    subscriptionStatus: string;
    planKey: string | null;
    hasActiveSubscription: boolean;
  } | null;
  billing: {
    stripeConfigured: boolean;
    plans: Plan[];
  };
};

export function BillingClient() {
  const router = useRouter();
  const params = useSearchParams();
  const [data, setData] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingPlan, setPendingPlan] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (params.get("success")) {
      setMessage("Stripe checkout completed. Activating your subscription…");
    }
    if (params.get("canceled")) {
      setMessage("Checkout canceled — pick a plan when you are ready.");
    }
    fetch("/api/auth/me")
      .then(async (r) => r.json())
      .then((json: MeResponse) => {
        if (!json.authenticated) {
          router.push("/login");
          return;
        }
        setData(json);
        if (json.user?.hasActiveSubscription && params.get("success")) {
          router.push("/dashboard");
        }
      });
  }, [router, params]);

  function choosePlan(planKey: "starter" | "pro", demo = false) {
    setError(null);
    setPendingPlan(planKey);
    startTransition(async () => {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planKey, demo }),
      });
      const json = await res.json();
      setPendingPlan(null);
      if (!res.ok) {
        setError(json.error || "Checkout failed");
        return;
      }
      if (json.mode === "stripe" && json.checkoutUrl) {
        window.location.href = json.checkoutUrl;
        return;
      }
      router.push(json.next || "/dashboard");
      router.refresh();
    });
  }

  function openPortal() {
    startTransition(async () => {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Could not open billing portal");
        return;
      }
      window.location.href = json.url;
    });
  }

  if (!data?.user) {
    return <div className="panel p-8 text-sm text-ink/60">Loading billing…</div>;
  }

  const stripeReady = data.billing.stripeConfigured;

  return (
    <div className="space-y-6">
      <div className="panel p-6 sm:p-8">
        <div className="mb-6 flex gap-2 text-xs uppercase tracking-[0.14em] text-ink/45">
          <span className="rounded-md bg-ink/5 px-2 py-1">1. Company</span>
          <span className="rounded-md bg-signal/15 px-2 py-1 text-signal-deep">2. Billing</span>
        </div>

        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
          Choose your plan
        </h1>
        <p className="mt-2 text-sm text-ink/60">
          {stripeReady
            ? "Secure checkout is powered by Stripe. You get a 14-day trial on paid plans."
            : "Stripe keys are not configured in this environment — activate a demo subscription to continue, or add STRIPE_SECRET_KEY for live checkout."}
        </p>

        {message && (
          <p className="mt-4 rounded-xl bg-signal/10 px-3 py-2 text-sm text-signal-deep">{message}</p>
        )}
        {error && (
          <p className="mt-4 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
        )}

        {data.user.hasActiveSubscription && (
          <div className="mt-4 rounded-xl border border-ink/10 bg-mist/60 px-4 py-3 text-sm text-ink/75">
            Current plan: <strong>{data.user.planKey || "active"}</strong> · status{" "}
            <strong>{data.user.subscriptionStatus}</strong>
            {stripeReady && data.user.subscriptionStatus !== "demo" && (
              <button
                type="button"
                onClick={openPortal}
                disabled={pending}
                className="ml-3 font-medium text-signal hover:underline"
              >
                Manage in Stripe
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {data.billing.plans.map((plan) => (
          <div key={plan.key} className="panel flex flex-col p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl font-semibold text-ink">{plan.name}</h2>
                <p className="mt-1 text-sm text-ink/60">{plan.description}</p>
              </div>
              <p className="font-display text-2xl font-semibold text-signal-deep">
                {plan.priceLabel}
              </p>
            </div>
            <ul className="mt-5 flex-1 space-y-2">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-ink/75">
                  <Check size={16} className="mt-0.5 shrink-0 text-signal" />
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-6 space-y-2">
              {stripeReady ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => choosePlan(plan.key)}
                  className="btn btn-signal w-full justify-center disabled:opacity-60"
                >
                  <CreditCard size={16} />
                  {pendingPlan === plan.key ? "Redirecting…" : "Subscribe with Stripe"}
                </button>
              ) : null}
              <button
                type="button"
                disabled={pending}
                onClick={() => choosePlan(plan.key, true)}
                className="btn btn-ghost w-full justify-center border-ink/15 disabled:opacity-60"
              >
                {pendingPlan === plan.key && !stripeReady
                  ? "Activating…"
                  : stripeReady
                    ? "Use demo billing instead"
                    : "Activate demo subscription"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
