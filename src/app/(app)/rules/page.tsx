"use client";

import { useEffect, useState, useTransition } from "react";
import { Eye, Plus } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { SEVERITY_LEVELS, STORM_TYPES } from "@/lib/constants";
import {
  DEFAULT_EMAIL_BODY,
  DEFAULT_EMAIL_SUBJECT,
  DEFAULT_VOICE_NOTES,
} from "@/lib/templates";

type Rule = {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  stormTypes: string[];
  minSeverity: string;
  hoursBeforeEta: number;
  targetCities: string[];
  targetStates: string[];
  contactListId: string | null;
  writingMode: string;
  voiceNotes: string | null;
  emailSubject: string;
  emailBody: string;
  fromName: string | null;
  contactList?: { id: string; name: string } | null;
  _count?: { campaigns: number };
};

type Storm = { id: string; name: string };
type List = { id: string; name: string };

export default function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [lists, setLists] = useState<List[]>([]);
  const [storms, setStorms] = useState<Storm[]>([]);
  const [previewStormId, setPreviewStormId] = useState("");
  const [preview, setPreview] = useState<{
    matchedCount: number;
    uniqueness?: { uniqueBodies: number; sampleSize: number; oneToOne: boolean };
    samples: Array<{
      subject: string;
      body: string;
      writingMode?: string;
      personalizationBrief?: string;
      contact: { firstName: string; city: string; lastName?: string };
    }>;
  } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [form, setForm] = useState({
    name: "Pre-storm readiness — 24h",
    description: "Outreach agent writes a unique personal note one day before ETA",
    enabled: true,
    stormTypes: ["thunderstorm", "hail", "tornado", "wind"] as string[],
    minSeverity: "watch",
    hoursBeforeEta: 24,
    targetCities: "",
    targetStates: "",
    contactListId: "",
    writingMode: "agent",
    voiceNotes: DEFAULT_VOICE_NOTES,
    emailSubject: DEFAULT_EMAIL_SUBJECT,
    emailBody: DEFAULT_EMAIL_BODY,
    fromName: "",
  });

  async function load() {
    const [r, l, s] = await Promise.all([
      fetch("/api/rules"),
      fetch("/api/lists"),
      fetch("/api/storms"),
    ]);
    const rulesJson = await r.json();
    const stormsJson = await s.json();
    setRules(rulesJson);
    setLists(await l.json());
    setStorms(stormsJson);
    if (!previewStormId && stormsJson[0]) setPreviewStormId(stormsJson[0].id);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleStormType(value: string) {
    setForm((f) => ({
      ...f,
      stormTypes: f.stormTypes.includes(value)
        ? f.stormTypes.filter((t) => t !== value)
        : [...f.stormTypes, value],
    }));
  }

  function createRule() {
    startTransition(async () => {
      const res = await fetch("/api/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          targetCities: form.targetCities || null,
          targetStates: form.targetStates || null,
          contactListId: form.contactListId || null,
          fromName: form.fromName || null,
          voiceNotes: form.voiceNotes || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage(json.error || "Failed to create rule");
        return;
      }
      setMessage(`Rule created: ${json.name}`);
      await load();
    });
  }

  function toggleEnabled(rule: Rule) {
    startTransition(async () => {
      await fetch(`/api/rules/${rule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !rule.enabled }),
      });
      await load();
    });
  }

  function runPreview(ruleId: string) {
    if (!previewStormId) {
      setMessage("Create or select a storm to preview matches");
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stormId: previewStormId, ruleId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage(json.error || "Preview failed");
        return;
      }
      setPreview(json);
      const uniq = json.uniqueness;
      setMessage(
        `Preview: ${json.matchedCount} contacts matched · ${uniq?.uniqueBodies ?? 0}/${uniq?.sampleSize ?? 0} sample emails uniquely written`
      );
    });
  }

  return (
    <div>
      <PageHeader
        title="Outreach rules"
        description="Your outreach agent writes a professional, one-to-one message for each person — not a shared cookie-cutter template."
      />

      {message ? <div className="panel mb-4 px-4 py-3 text-sm">{message}</div> : null}

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <section className="panel p-5">
          <h2 className="font-display text-xl">Your rules</h2>
          {rules.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                title="No rules yet"
                description="Create a rule and let the outreach agent draft unique emails per contact."
              />
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {rules.map((rule) => (
                <article
                  key={rule.id}
                  className="rounded-xl border border-[var(--line)] bg-white/65 px-4 py-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{rule.name}</h3>
                        <StatusBadge
                          value={rule.enabled ? "enabled" : "disabled"}
                          kind={rule.enabled ? "watch" : "neutral"}
                        />
                        <StatusBadge
                          value={rule.writingMode === "template" ? "template" : "agent-written"}
                          kind={rule.writingMode === "template" ? "advisory" : "watch"}
                        />
                      </div>
                      <p className="mt-1 text-sm text-ink/55">
                        {rule.hoursBeforeEta}h before ETA · min {rule.minSeverity} ·{" "}
                        {rule.stormTypes.join(", ")}
                      </p>
                      <p className="mt-1 text-sm text-ink/55">
                        List: {rule.contactList?.name || "All contacts"}
                        {rule.targetCities.length
                          ? ` · Cities: ${rule.targetCities.join(", ")}`
                          : " · Cities: storm path"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button className="btn btn-ghost" onClick={() => toggleEnabled(rule)}>
                        {rule.enabled ? "Disable" : "Enable"}
                      </button>
                      <button className="btn btn-signal" onClick={() => runPreview(rule.id)}>
                        <Eye size={15} /> Preview
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          <div className="mt-4 rounded-xl border border-[var(--line)] bg-white/50 p-4">
            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-ink/45">
              Preview agent copy against storm
            </label>
            <select
              className="select mt-2"
              value={previewStormId}
              onChange={(e) => setPreviewStormId(e.target.value)}
            >
              <option value="">Select storm</option>
              {storms.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            {preview ? (
              <div className="mt-4 space-y-3">
                <p className="text-sm font-medium">
                  {preview.matchedCount} matched ·{" "}
                  {preview.uniqueness?.oneToOne
                    ? "each sample email is uniquely written"
                    : `${preview.uniqueness?.uniqueBodies ?? 0} unique bodies in sample`}
                </p>
                {preview.samples.map((sample, idx) => (
                  <div key={idx} className="rounded-lg bg-ink/5 p-3 text-sm">
                    <p className="font-semibold">
                      {sample.contact.firstName} {sample.contact.lastName || ""} ·{" "}
                      {sample.contact.city}
                    </p>
                    {sample.personalizationBrief ? (
                      <p className="mt-1 text-xs text-signal-deep">{sample.personalizationBrief}</p>
                    ) : null}
                    <p className="mt-1 text-ink/70">{sample.subject}</p>
                    <pre className="mt-2 whitespace-pre-wrap font-sans text-xs text-ink/60">
                      {sample.body}
                    </pre>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        <section className="panel p-5">
          <h2 className="font-display text-xl">Create rule</h2>
          <div className="mt-4 space-y-3">
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Rule name"
            />
            <textarea
              className="textarea min-h-20"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Description"
            />

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink/45">
                Writing mode
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className={`rounded-xl border px-3 py-3 text-left text-sm ${
                    form.writingMode === "agent"
                      ? "border-signal bg-signal/10"
                      : "border-[var(--line)] bg-white/50"
                  }`}
                  onClick={() => setForm((f) => ({ ...f, writingMode: "agent" }))}
                >
                  <div className="font-semibold">Outreach agent</div>
                  <div className="mt-1 text-xs text-ink/55">
                    Unique professional note for each person
                  </div>
                </button>
                <button
                  type="button"
                  className={`rounded-xl border px-3 py-3 text-left text-sm ${
                    form.writingMode === "template"
                      ? "border-signal bg-signal/10"
                      : "border-[var(--line)] bg-white/50"
                  }`}
                  onClick={() => setForm((f) => ({ ...f, writingMode: "template" }))}
                >
                  <div className="font-semibold">Literal template</div>
                  <div className="mt-1 text-xs text-ink/55">
                    Merge fields only (not recommended)
                  </div>
                </button>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink/45">
                Storm types
              </p>
              <div className="flex flex-wrap gap-2">
                {STORM_TYPES.map((t) => {
                  const active = form.stormTypes.includes(t.value);
                  return (
                    <button
                      key={t.value}
                      type="button"
                      className={`badge ${active ? "badge-watch" : "badge-neutral"}`}
                      onClick={() => toggleStormType(t.value)}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <select
                className="select"
                value={form.minSeverity}
                onChange={(e) => setForm((f) => ({ ...f, minSeverity: e.target.value }))}
              >
                {SEVERITY_LEVELS.map((s) => (
                  <option key={s.value} value={s.value}>
                    Min severity: {s.label}
                  </option>
                ))}
              </select>
              <input
                className="input"
                type="number"
                min={1}
                value={form.hoursBeforeEta}
                onChange={(e) =>
                  setForm((f) => ({ ...f, hoursBeforeEta: Number(e.target.value) }))
                }
                placeholder="Hours before ETA"
              />
            </div>

            <input
              className="input"
              placeholder="Target cities (optional, comma-separated)"
              value={form.targetCities}
              onChange={(e) => setForm((f) => ({ ...f, targetCities: e.target.value }))}
            />
            <input
              className="input"
              placeholder="Target states (optional)"
              value={form.targetStates}
              onChange={(e) => setForm((f) => ({ ...f, targetStates: e.target.value }))}
            />
            <select
              className="select"
              value={form.contactListId}
              onChange={(e) => setForm((f) => ({ ...f, contactListId: e.target.value }))}
            >
              <option value="">All contacts</option>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <input
              className="input"
              placeholder="From name (optional)"
              value={form.fromName}
              onChange={(e) => setForm((f) => ({ ...f, fromName: e.target.value }))}
            />

            {form.writingMode === "agent" ? (
              <>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-ink/45">
                    Voice notes for the agent
                  </span>
                  <textarea
                    className="textarea min-h-20"
                    value={form.voiceNotes}
                    onChange={(e) => setForm((f) => ({ ...f, voiceNotes: e.target.value }))}
                    placeholder="e.g. Calm, neighborly, never salesy"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-ink/45">
                    Subject hint (optional)
                  </span>
                  <input
                    className="input"
                    value={form.emailSubject}
                    onChange={(e) => setForm((f) => ({ ...f, emailSubject: e.target.value }))}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-ink/45">
                    Talking points / guidance
                  </span>
                  <textarea
                    className="textarea min-h-40 text-sm"
                    value={form.emailBody}
                    onChange={(e) => setForm((f) => ({ ...f, emailBody: e.target.value }))}
                    placeholder="What the agent should make sure to cover — not the literal email"
                  />
                </label>
                <p className="text-xs text-ink/50">
                  The agent uses contact details (name, city, address, company), storm timing, and
                  these notes to write a different email for every person.
                </p>
              </>
            ) : (
              <>
                <input
                  className="input"
                  value={form.emailSubject}
                  onChange={(e) => setForm((f) => ({ ...f, emailSubject: e.target.value }))}
                  placeholder="Email subject template"
                />
                <textarea
                  className="textarea min-h-56 font-mono text-sm"
                  value={form.emailBody}
                  onChange={(e) => setForm((f) => ({ ...f, emailBody: e.target.value }))}
                  placeholder="Email body template"
                />
                <p className="text-xs text-ink/50">
                  Tokens: {"{{firstName}}"} {"{{city}}"} {"{{stormName}}"} {"{{stormEta}}"}{" "}
                  {"{{companyName}}"} {"{{agentName}}"} {"{{agentPhone}}"}
                </p>
              </>
            )}

            <button className="btn btn-primary w-full" onClick={createRule} disabled={pending}>
              <Plus size={15} /> {pending ? "Saving…" : "Create rule"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
