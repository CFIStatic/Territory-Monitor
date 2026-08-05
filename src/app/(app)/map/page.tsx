"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, useTransition } from "react";
import { CloudLightning, MapPinned, Megaphone, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import type { StormFeature, TerritoryPoint } from "@/components/TerritoryMap";

const TerritoryMap = dynamic(
  () => import("@/components/TerritoryMap").then((m) => m.TerritoryMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-sm text-ink/55">
        Loading map…
      </div>
    ),
  }
);

type Rule = { id: string; name: string; writingMode: string; hoursBeforeEta: number };

type TerritoryPayload = {
  center: { lat: number; lng: number };
  territories: TerritoryPoint[];
  storms: StormFeature[];
  rules: Rule[];
  stats: {
    territories: number;
    contactsMapped: number;
    contactsTotal: number;
    activeStorms: number;
  };
};

export default function MapPage() {
  const [data, setData] = useState<TerritoryPayload | null>(null);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [selectedStormId, setSelectedStormId] = useState<string | null>(null);
  const [ruleId, setRuleId] = useState("");
  const [providerNote, setProviderNote] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function load() {
    const [territoryRes, weatherRes] = await Promise.all([
      fetch("/api/territory"),
      fetch("/api/weather/sync"),
    ]);
    const territory = await territoryRes.json();
    const weather = await weatherRes.json();
    setData(territory);
    setProviderNote(weather.providers?.note || null);
    if (!ruleId && territory.rules?.[0]) setRuleId(territory.rules[0].id);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function syncWeather() {
    startTransition(async () => {
      setMessage("Pulling live weather alerts…");
      const res = await fetch("/api/weather/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage(json.error || "Weather sync failed");
        return;
      }
      setMessage(
        `Synced ${json.upserted} alerts via ${json.provider} (${json.fetched} fetched)`
      );
      await load();
    });
  }

  function toggleCity(city: string) {
    setSelectedCities((prev) =>
      prev.some((c) => c.toLowerCase() === city.toLowerCase())
        ? prev.filter((c) => c.toLowerCase() !== city.toLowerCase())
        : [...prev, city]
    );
  }

  function onSelectTerritory(t: TerritoryPoint) {
    toggleCity(t.city);
    setSelectedStormId(null);
  }

  function onSelectStorm(s: StormFeature) {
    setSelectedStormId(s.id);
    if (s.affectedCities?.length) {
      setSelectedCities(s.affectedCities);
    }
  }

  function launchAlert(mode: "storm" | "cities") {
    startTransition(async () => {
      const payload =
        mode === "storm" && selectedStormId
          ? { stormId: selectedStormId, ruleId: ruleId || undefined, runEngine: true }
          : {
              cities: selectedCities,
              ruleId: ruleId || undefined,
              runEngine: true,
              alertName: `Map alert — ${selectedCities.slice(0, 3).join(", ")}`,
            };

      if (mode === "cities" && selectedCities.length === 0) {
        setMessage("Select one or more territory cities on the map first");
        return;
      }
      if (mode === "storm" && !selectedStormId) {
        setMessage("Select a storm polygon/circle on the map first");
        return;
      }

      setMessage("Launching outreach from territory map…");
      const res = await fetch("/api/territory/alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage(json.error || "Failed to launch alert");
        return;
      }
      const created = json.engine?.evaluation?.createdCount ?? 0;
      const sent = json.engine?.sending?.sent ?? 0;
      setMessage(
        `Alert launched · ${created} campaigns created · ${sent} emails sent · storm ${json.stormId}`
      );
      await load();
    });
  }

  const selectedStorm = data?.storms.find((s) => s.id === selectedStormId) || null;

  return (
    <div>
      <PageHeader
        title="Territory map"
        description="Coverage from your contact book, live weather alerts on the map, and one-click campaigns for the territories in a storm path."
        actions={
          <>
            <button className="btn btn-ghost" onClick={() => load()} disabled={pending}>
              <RefreshCw size={15} /> Refresh
            </button>
            <button className="btn btn-signal" onClick={syncWeather} disabled={pending}>
              <CloudLightning size={15} />
              {pending ? "Syncing…" : "Pull weather alerts"}
            </button>
          </>
        }
      />

      {providerNote ? (
        <div className="panel mb-4 px-4 py-3 text-sm text-ink/70">{providerNote}</div>
      ) : null}
      {message ? <div className="panel mb-4 px-4 py-3 text-sm">{message}</div> : null}

      {!data ? (
        <div className="panel p-8 text-sm text-ink/55">Loading territory…</div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
          <section className="panel overflow-hidden p-2">
            <div className="mb-2 flex flex-wrap gap-2 px-2 pt-2">
              <StatusBadge value={`${data.stats.territories} territories`} kind="watch" />
              <StatusBadge
                value={`${data.stats.contactsMapped.toLocaleString()} contacts mapped`}
                kind="advisory"
              />
              <StatusBadge
                value={`${data.stats.activeStorms} active storms`}
                kind="warning"
              />
            </div>
            <div className="h-[620px] overflow-hidden rounded-2xl">
              <TerritoryMap
                center={data.center}
                territories={data.territories}
                storms={data.storms}
                selectedCities={selectedCities}
                selectedStormId={selectedStormId}
                onSelectTerritory={onSelectTerritory}
                onSelectStorm={onSelectStorm}
              />
            </div>
          </section>

          <aside className="space-y-4">
            <section className="panel p-5">
              <h2 className="font-display text-xl">Launch from map</h2>
              <p className="mt-1 text-sm text-ink/55">
                Select a storm or city markers, pick a rule, then send personalized outreach.
              </p>

              <label className="mt-4 block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-ink/45">
                  Outreach rule
                </span>
                <select
                  className="select"
                  value={ruleId}
                  onChange={(e) => setRuleId(e.target.value)}
                >
                  {data.rules.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="mt-4 space-y-2">
                <button
                  className="btn btn-primary w-full"
                  disabled={pending || !selectedStormId}
                  onClick={() => launchAlert("storm")}
                >
                  <Megaphone size={15} /> Alert storm path
                </button>
                <button
                  className="btn btn-signal w-full"
                  disabled={pending || selectedCities.length === 0}
                  onClick={() => launchAlert("cities")}
                >
                  <MapPinned size={15} /> Alert selected cities (
                  {selectedCities.length})
                </button>
              </div>
            </section>

            <section className="panel p-5">
              <h2 className="font-display text-xl">Selection</h2>
              {selectedStorm ? (
                <div className="mt-3 rounded-xl border border-[var(--line)] bg-white/70 px-3 py-3 text-sm">
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge value={selectedStorm.severity} />
                    <StatusBadge value={selectedStorm.source} kind="advisory" />
                  </div>
                  <p className="mt-2 font-semibold">{selectedStorm.name}</p>
                  <p className="mt-1 text-ink/55">
                    {selectedStorm.matchedContacts} contacts in path ·{" "}
                    {selectedStorm.affectedCities.slice(0, 6).join(", ")}
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-sm text-ink/55">No storm selected.</p>
              )}

              <div className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink/45">
                  Cities
                </p>
                {selectedCities.length === 0 ? (
                  <p className="mt-2 text-sm text-ink/55">Click territory markers to select.</p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedCities.map((city) => (
                      <button
                        key={city}
                        className="badge badge-watch"
                        onClick={() => toggleCity(city)}
                        title="Remove"
                      >
                        {city} ×
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="panel p-5">
              <h2 className="font-display text-xl">Live storms</h2>
              <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
                {data.storms.length === 0 ? (
                  <p className="text-sm text-ink/55">
                    No active storms. Click “Pull weather alerts”.
                  </p>
                ) : (
                  data.storms.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => onSelectStorm(s)}
                      className={`w-full rounded-xl border px-3 py-3 text-left text-sm transition ${
                        selectedStormId === s.id
                          ? "border-signal bg-signal/5"
                          : "border-[var(--line)] bg-white/60 hover:bg-white"
                      }`}
                    >
                      <div className="flex flex-wrap gap-2">
                        <StatusBadge value={s.severity} />
                        <StatusBadge value={s.source} kind="advisory" />
                      </div>
                      <p className="mt-1 font-semibold">{s.name}</p>
                      <p className="text-xs text-ink/50">
                        {s.matchedContacts} contacts · {s.type}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}
