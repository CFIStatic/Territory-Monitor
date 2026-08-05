"use client";

import { useEffect, useState, useTransition } from "react";
import { Eye, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";

type Storm = { id: string; name: string; severity: string; status: string };
type Rule = { id: string; name: string; writingMode: string; hoursBeforeEta: number };

type Sample = {
  subject: string;
  body: string;
  writingMode?: string;
  personalizationBrief?: string;
  contact: {
    firstName: string;
    lastName?: string;
    city: string;
    spouseName?: string | null;
    familyNotes?: string | null;
    personalTouch?: string | null;
    lastConversation?: string | null;
  };
};

export default function PreviewPage() {
  const [storms, setStorms] = useState<Storm[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [stormId, setStormId] = useState("");
  const [ruleId, setRuleId] = useState("");
  const [selected, setSelected] = useState(0);
  const [result, setResult] = useState<{
    matchedCount: number;
    uniqueness?: { uniqueBodies: number; sampleSize: number; oneToOne: boolean };
    samples: Sample[];
  } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    Promise.all([fetch("/api/storms"), fetch("/api/rules")]).then(async ([s, r]) => {
      const stormsJson = await s.json();
      const rulesJson = await r.json();
      setStorms(stormsJson);
      setRules(rulesJson);
      if (stormsJson[0]) setStormId(stormsJson[0].id);
      const agentRule = rulesJson.find((x: Rule) => x.writingMode !== "template") || rulesJson[0];
      if (agentRule) setRuleId(agentRule.id);
    });
  }, []);

  function runPreview() {
    if (!stormId || !ruleId) {
      setMessage("Pick a storm and a rule first");
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stormId, ruleId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage(json.error || "Preview failed");
        return;
      }
      setResult(json);
      setSelected(0);
      setMessage(
        `${json.matchedCount} matched · ${json.uniqueness?.uniqueBodies ?? 0}/${json.uniqueness?.sampleSize ?? 0} unique sample emails`
      );
    });
  }

  const active = result?.samples[selected];

  return (
    <div>
      <PageHeader
        title="Outreach preview"
        description="See the exact one-to-one emails the agent would send — each customized with that contact’s family notes, personal touches, and last conversation."
        actions={
          <button className="btn btn-signal" onClick={runPreview} disabled={pending}>
            <Eye size={15} /> {pending ? "Writing…" : "Generate preview"}
          </button>
        }
      />

      <section className="panel mb-4 grid gap-3 p-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-ink/45">
            Storm
          </span>
          <select className="select" value={stormId} onChange={(e) => setStormId(e.target.value)}>
            {storms.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-ink/45">
            Rule
          </span>
          <select className="select" value={ruleId} onChange={(e) => setRuleId(e.target.value)}>
            {rules.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.writingMode})
              </option>
            ))}
          </select>
        </label>
        <button className="btn btn-primary" onClick={runPreview} disabled={pending}>
          <Sparkles size={15} /> Preview
        </button>
      </section>

      {message ? <div className="panel mb-4 px-4 py-3 text-sm">{message}</div> : null}

      {!result ? (
        <div className="panel px-6 py-14 text-center">
          <Sparkles className="mx-auto text-signal" />
          <h3 className="mt-3 font-display text-xl">No preview yet</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink/60">
            Choose a storm and rule, then generate. You’ll see side-by-side how Maya’s email
            differs from Chris’s using their saved memories.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <section className="panel p-5">
            <div className="mb-3 flex flex-wrap gap-2">
              <StatusBadge value={`${result.matchedCount} matched`} kind="watch" />
              {result.uniqueness?.oneToOne ? (
                <StatusBadge value="all samples unique" kind="watch" />
              ) : (
                <StatusBadge
                  value={`${result.uniqueness?.uniqueBodies}/${result.uniqueness?.sampleSize} unique`}
                  kind="advisory"
                />
              )}
            </div>
            <div className="space-y-2">
              {result.samples.map((sample, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelected(idx)}
                  className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                    selected === idx
                      ? "border-signal bg-signal/5"
                      : "border-[var(--line)] bg-white/60 hover:bg-white"
                  }`}
                >
                  <p className="font-semibold">
                    {sample.contact.firstName} {sample.contact.lastName || ""}
                    {sample.contact.spouseName ? (
                      <span className="font-normal text-ink/50">
                        {" "}
                        · & {sample.contact.spouseName}
                      </span>
                    ) : null}
                  </p>
                  <p className="text-sm text-ink/55">{sample.contact.city}</p>
                  <p className="mt-1 truncate text-xs text-ink/45">{sample.subject}</p>
                </button>
              ))}
            </div>
          </section>

          <section className="panel p-5">
            {active ? (
              <>
                <h2 className="font-display text-xl">
                  Email to {active.contact.firstName}
                </h2>
                {(active.contact.familyNotes ||
                  active.contact.personalTouch ||
                  active.contact.lastConversation) && (
                  <div className="mt-3 rounded-xl border border-signal/20 bg-signal/5 px-3 py-3 text-xs text-ink/70">
                    <p className="font-semibold text-signal-deep">Memories on file</p>
                    <ul className="mt-1 space-y-1">
                      {active.contact.spouseName ? (
                        <li>Spouse: {active.contact.spouseName}</li>
                      ) : null}
                      {active.contact.familyNotes ? (
                        <li>Family: {active.contact.familyNotes}</li>
                      ) : null}
                      {active.contact.personalTouch ? (
                        <li>Personal: {active.contact.personalTouch}</li>
                      ) : null}
                      {active.contact.lastConversation ? (
                        <li>Last talk: {active.contact.lastConversation}</li>
                      ) : null}
                    </ul>
                  </div>
                )}
                {active.personalizationBrief ? (
                  <p className="mt-3 text-xs text-ink/50">{active.personalizationBrief}</p>
                ) : null}
                <p className="mt-4 text-xs uppercase tracking-[0.12em] text-ink/45">Subject</p>
                <p className="mt-1 font-semibold">{active.subject}</p>
                <p className="mt-4 text-xs uppercase tracking-[0.12em] text-ink/45">Body</p>
                <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-ink/[0.04] p-4 font-sans text-sm leading-relaxed text-ink/80">
                  {active.body}
                </pre>
              </>
            ) : (
              <p className="text-sm text-ink/55">No sample selected.</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
