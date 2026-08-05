"use client";

import { useEffect, useState, useTransition } from "react";
import { format } from "date-fns";
import { CloudLightning } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { SEVERITY_LEVELS, STORM_STATUSES, STORM_TYPES } from "@/lib/constants";

type Storm = {
  id: string;
  name: string;
  type: string;
  severity: string;
  status: string;
  description: string | null;
  affectedCities: string[];
  affectedStates: string[];
  affectedZips: string[];
  etaStart: string;
  etaEnd: string | null;
  _count?: { campaigns: number };
};

const blank = {
  name: "",
  type: "thunderstorm",
  severity: "warning",
  status: "approaching",
  description: "",
  affectedCities: "Milwaukee, Waukesha",
  affectedStates: "WI",
  affectedZips: "",
  etaStart: "",
  radiusMiles: "40",
};

export default function StormsPage() {
  const [storms, setStorms] = useState<Storm[]>([]);
  const [form, setForm] = useState(blank);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function load() {
    const res = await fetch("/api/storms");
    setStorms(await res.json());
  }

  useEffect(() => {
    const eta = new Date(Date.now() + 36 * 60 * 60 * 1000);
    const local = new Date(eta.getTime() - eta.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setForm((f) => ({ ...f, etaStart: local }));
    load();
  }, []);

  function createStorm() {
    startTransition(async () => {
      const res = await fetch("/api/storms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          affectedCities: form.affectedCities,
          affectedStates: form.affectedStates,
          affectedZips: form.affectedZips || undefined,
          radiusMiles: form.radiusMiles ? Number(form.radiusMiles) : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage(json.error || "Failed to create storm");
        return;
      }
      setMessage(`Storm created: ${json.name}`);
      await load();
    });
  }

  function updateStatus(id: string, status: string) {
    startTransition(async () => {
      await fetch(`/api/storms/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await load();
    });
  }

  return (
    <div>
      <PageHeader
        title="Storms"
        description="Track weather events that dictate your sales cycle. The engine matches these territories to your contact book."
      />

      {message ? <div className="panel mb-4 px-4 py-3 text-sm">{message}</div> : null}

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="panel p-5">
          <h2 className="font-display text-xl">Active & forecast events</h2>
          {storms.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                title="No storms tracked"
                description="Create a storm event with an ETA and affected cities to begin automated outreach."
              />
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {storms.map((storm) => (
                <article
                  key={storm.id}
                  className="rounded-xl border border-[var(--line)] bg-white/65 px-4 py-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-ink">{storm.name}</h3>
                        <StatusBadge value={storm.severity} />
                        <StatusBadge value={storm.status} />
                        <StatusBadge value={storm.type} />
                      </div>
                      <p className="mt-1 text-sm text-ink/55">
                        ETA {format(new Date(storm.etaStart), "EEE, MMM d · h:mm a")}
                        {storm._count ? ` · ${storm._count.campaigns} campaigns` : ""}
                      </p>
                    </div>
                    <select
                      className="select w-auto"
                      value={storm.status}
                      onChange={(e) => updateStatus(storm.id, e.target.value)}
                    >
                      {STORM_STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {storm.description ? (
                    <p className="mt-2 text-sm text-ink/65">{storm.description}</p>
                  ) : null}
                  <p className="mt-2 text-sm text-ink/70">
                    Cities: {storm.affectedCities.join(", ") || "—"} · States:{" "}
                    {storm.affectedStates.join(", ") || "—"}
                    {storm.affectedZips?.length
                      ? ` · Zips: ${storm.affectedZips.slice(0, 6).join(", ")}`
                      : ""}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="panel p-5">
          <h2 className="font-display text-xl">Log storm event</h2>
          <div className="mt-4 space-y-3">
            <input
              className="input"
              placeholder="Name (e.g. Severe Thunderstorm — Milwaukee)"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <div className="grid grid-cols-2 gap-3">
              <select
                className="select"
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              >
                {STORM_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <select
                className="select"
                value={form.severity}
                onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value }))}
              >
                {SEVERITY_LEVELS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              className="textarea min-h-24"
              placeholder="Description"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
            <input
              className="input"
              placeholder="Affected cities (comma-separated)"
              value={form.affectedCities}
              onChange={(e) => setForm((f) => ({ ...f, affectedCities: e.target.value }))}
            />
            <input
              className="input"
              placeholder="Affected states (comma-separated)"
              value={form.affectedStates}
              onChange={(e) => setForm((f) => ({ ...f, affectedStates: e.target.value }))}
            />
            <input
              className="input"
              placeholder="Affected zips (optional)"
              value={form.affectedZips}
              onChange={(e) => setForm((f) => ({ ...f, affectedZips: e.target.value }))}
            />
            <input
              className="input"
              type="datetime-local"
              value={form.etaStart}
              onChange={(e) => setForm((f) => ({ ...f, etaStart: e.target.value }))}
            />
            <button className="btn btn-primary w-full" onClick={createStorm} disabled={pending}>
              <CloudLightning size={15} />
              {pending ? "Saving…" : "Create storm"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
