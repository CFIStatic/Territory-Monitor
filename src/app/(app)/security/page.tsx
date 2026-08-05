"use client";

import { useEffect, useState, useTransition } from "react";
import { RefreshCw, ShieldCheck, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

type SecurityPayload = {
  ok: boolean;
  apiKeyConfigured: boolean;
  stats: {
    totalEvents: number;
    malwareBlocks: number;
    rateLimits: number;
    authFails: number;
    apiKeyRequired: boolean;
    defenses: string[];
  };
  events: Array<{
    id: string;
    at: string;
    kind: string;
    message: string;
    meta?: Record<string, unknown>;
  }>;
};

export default function SecurityPage() {
  const [data, setData] = useState<SecurityPayload | null>(null);
  const [pending, startTransition] = useTransition();

  function load() {
    startTransition(async () => {
      const res = await fetch("/api/security");
      setData(await res.json());
    });
  }

  useEffect(() => {
    load();
  }, []);

  if (!data) {
    return <div className="panel p-8 text-sm text-ink/60">Loading cyber defense status…</div>;
  }

  const cards = [
    { label: "Malware blocks", value: data.stats.malwareBlocks },
    { label: "Rate-limit hits", value: data.stats.rateLimits },
    { label: "Auth failures", value: data.stats.authFails },
    { label: "Events logged", value: data.stats.totalEvents },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cyber defense"
        description="Malware scanning on uploads, rate limits, security headers, and optional API-key protection for sensitive routes."
        actions={
          <button
            type="button"
            onClick={load}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
          >
            <RefreshCw size={16} className={pending ? "animate-spin" : ""} />
            Refresh
          </button>
        }
      />

      <div className="panel flex items-start gap-3 p-5">
        {data.apiKeyConfigured ? (
          <ShieldCheck className="mt-0.5 shrink-0 text-emerald-700" size={22} />
        ) : (
          <ShieldAlert className="mt-0.5 shrink-0 text-amber-700" size={22} />
        )}
        <div>
          <p className="font-medium text-ink">
            {data.apiKeyConfigured
              ? "API key enforcement is ON"
              : "API key enforcement is OFF (demo mode)"}
          </p>
          <p className="mt-1 text-sm text-ink/65">
            {data.apiKeyConfigured
              ? "Mutating routes require x-api-key or Authorization: Bearer when TM_API_KEY is set."
              : "Set TM_API_KEY in .env to require a key on upload, engine, and other guarded routes. Upload malware scanning is always active."}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="panel p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-ink/50">{card.label}</p>
            <p className="mt-2 font-display text-3xl font-semibold text-ink">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="panel p-5">
        <h2 className="font-display text-lg font-semibold text-ink">Active defenses</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {data.stats.defenses.map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-ink/75">
              <ShieldCheck size={16} className="mt-0.5 shrink-0 text-emerald-700" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div className="panel overflow-hidden">
        <div className="border-b border-ink/10 px-5 py-3">
          <h2 className="font-display text-lg font-semibold text-ink">Recent security events</h2>
          <p className="text-sm text-ink/55">Blocked malware, rate limits, and auth failures</p>
        </div>
        {data.events.length === 0 ? (
          <p className="p-5 text-sm text-ink/60">No security events yet. Hostile uploads will appear here.</p>
        ) : (
          <ul className="divide-y divide-ink/8">
            {data.events.map((event) => (
              <li key={event.id} className="px-5 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-ink/5 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-ink/70">
                    {event.kind.replace("_", " ")}
                  </span>
                  <span className="text-xs text-ink/45">
                    {new Date(event.at).toLocaleString()}
                  </span>
                </div>
                <p className="mt-1 text-ink/80">{event.message}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
