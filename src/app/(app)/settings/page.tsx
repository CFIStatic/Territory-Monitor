"use client";

import { useEffect, useState, useTransition } from "react";
import { Save } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

type Settings = {
  companyName: string;
  agentName: string;
  agentEmail: string;
  agentPhone: string | null;
  website: string | null;
  replyToEmail: string | null;
  signature: string | null;
};

export default function SettingsPage() {
  const [form, setForm] = useState<Settings>({
    companyName: "",
    agentName: "",
    agentEmail: "",
    agentPhone: "",
    website: "",
    replyToEmail: "",
    signature: "",
  });
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) =>
        setForm({
          companyName: data.companyName || "",
          agentName: data.agentName || "",
          agentEmail: data.agentEmail || "",
          agentPhone: data.agentPhone || "",
          website: data.website || "",
          replyToEmail: data.replyToEmail || "",
          signature: data.signature || "",
        })
      );
  }, []);

  function save() {
    startTransition(async () => {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage(json.error || "Failed to save");
        return;
      }
      setMessage("Settings saved. Templates will use this identity for personalization.");
    });
  }

  return (
    <div>
      <PageHeader
        title="Company settings"
        description="This identity is injected into personalized emails via template tokens."
      />

      {message ? <div className="panel mb-4 px-4 py-3 text-sm">{message}</div> : null}

      <section className="panel max-w-2xl p-5">
        <div className="grid gap-3">
          {(
            [
              ["companyName", "Company name"],
              ["agentName", "Agent name"],
              ["agentEmail", "Agent email"],
              ["agentPhone", "Agent phone"],
              ["website", "Website"],
              ["replyToEmail", "Reply-to email"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-ink/45">
                {label}
              </span>
              <input
                className="input"
                value={form[key] || ""}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              />
            </label>
          ))}
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-ink/45">
              Signature
            </span>
            <textarea
              className="textarea min-h-28"
              value={form.signature || ""}
              onChange={(e) => setForm((f) => ({ ...f, signature: e.target.value }))}
            />
          </label>
        </div>
        <button className="btn btn-primary mt-4" onClick={save} disabled={pending}>
          <Save size={15} /> {pending ? "Saving…" : "Save settings"}
        </button>
      </section>
    </div>
  );
}
