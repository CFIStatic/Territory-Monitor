"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type SettingsForm = {
  companyName: string;
  agentName: string;
  agentEmail: string;
  agentPhone: string;
  website: string;
  replyToEmail: string;
  signature: string;
};

export default function AccountSetupPage() {
  const router = useRouter();
  const [form, setForm] = useState<SettingsForm | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    fetch("/api/account/setup")
      .then(async (r) => {
        if (r.status === 401) {
          router.push("/login");
          return null;
        }
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        setForm({
          companyName: data.settings.companyName || "",
          agentName: data.settings.agentName || "",
          agentEmail: data.settings.agentEmail || "",
          agentPhone: data.settings.agentPhone || "",
          website: data.settings.website || "",
          replyToEmail: data.settings.replyToEmail || "",
          signature: data.settings.signature || "",
        });
      });
  }, [router]);

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/account/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Could not save company profile");
        return;
      }
      router.push(json.next || "/account/billing");
    });
  }

  if (!form) {
    return <div className="panel p-8 text-sm text-ink/60">Loading company setup…</div>;
  }

  return (
    <div className="panel p-6 sm:p-8">
      <div className="mb-6 flex gap-2 text-xs uppercase tracking-[0.14em] text-ink/45">
        <span className="rounded-md bg-signal/15 px-2 py-1 text-signal-deep">1. Company</span>
        <span className="rounded-md bg-ink/5 px-2 py-1">2. Billing</span>
      </div>

      <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
        Set up your company
      </h1>
      <p className="mt-2 text-sm text-ink/60">
        This identity appears on outreach emails and campaign signatures.
      </p>

      <form onSubmit={save} className="mt-6 grid gap-4 sm:grid-cols-2">
        {(
          [
            ["companyName", "Company name", "text", true],
            ["agentName", "Agent name", "text", true],
            ["agentEmail", "Agent email", "email", true],
            ["agentPhone", "Agent phone", "tel", false],
            ["website", "Website", "url", false],
            ["replyToEmail", "Reply-to email", "email", false],
          ] as const
        ).map(([key, label, type, required]) => (
          <label key={key} className="block sm:col-span-1">
            <span className="text-xs font-medium uppercase tracking-[0.12em] text-ink/50">
              {label}
            </span>
            <input
              className="mt-1.5 w-full rounded-xl border border-ink/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-signal"
              type={type}
              value={form[key]}
              onChange={(e) => setForm((f) => (f ? { ...f, [key]: e.target.value } : f))}
              required={required}
            />
          </label>
        ))}

        <label className="block sm:col-span-2">
          <span className="text-xs font-medium uppercase tracking-[0.12em] text-ink/50">
            Email signature
          </span>
          <textarea
            className="mt-1.5 min-h-24 w-full rounded-xl border border-ink/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-signal"
            value={form.signature}
            onChange={(e) => setForm((f) => (f ? { ...f, signature: e.target.value } : f))}
          />
        </label>

        {error && (
          <p className="sm:col-span-2 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={pending}
            className="btn btn-signal w-full justify-center sm:w-auto disabled:opacity-60"
          >
            {pending ? "Saving…" : "Continue to Stripe billing"}
          </button>
        </div>
      </form>
    </div>
  );
}
