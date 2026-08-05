import { jsonError, jsonOk } from "@/lib/api";
import { getStripe, isStripeConfigured } from "@/lib/stripe/client";
import { applySubscriptionUpdate } from "@/lib/stripe/billing";
import type Stripe from "stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return jsonError("Stripe is not configured", 503);
  }

  const stripe = getStripe();
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    if (webhookSecret && signature) {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } else if (process.env.NODE_ENV !== "production") {
      event = JSON.parse(rawBody) as Stripe.Event;
    } else {
      return jsonError("Missing Stripe webhook signature", 400);
    }
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Invalid webhook payload",
      400
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;
        await applySubscriptionUpdate({
          userId: session.metadata?.userId || session.client_reference_id,
          customerId:
            typeof session.customer === "string"
              ? session.customer
              : session.customer?.id,
          subscriptionId,
          status: "trialing",
          planKey: session.metadata?.planKey,
        });
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.created":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const priceId = sub.items.data[0]?.price?.id ?? null;
        await applySubscriptionUpdate({
          userId: sub.metadata?.userId,
          customerId: typeof sub.customer === "string" ? sub.customer : sub.customer?.id,
          subscriptionId: sub.id,
          status: event.type === "customer.subscription.deleted" ? "canceled" : sub.status,
          priceId,
          planKey: sub.metadata?.planKey,
        });
        break;
      }
      default:
        break;
    }

    return jsonOk({ received: true, type: event.type });
  } catch (error) {
    console.error("[stripe webhook]", error);
    return jsonError(error instanceof Error ? error.message : "Webhook handler failed", 500);
  }
}
