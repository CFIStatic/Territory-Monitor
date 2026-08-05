import { Suspense } from "react";
import { BillingClient } from "./BillingClient";

export default function BillingPage() {
  return (
    <Suspense fallback={<div className="panel p-8 text-sm text-ink/60">Loading billing…</div>}>
      <BillingClient />
    </Suspense>
  );
}
