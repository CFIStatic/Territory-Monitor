"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";

type CampaignDetail = {
  id: string;
  name: string;
  status: string;
  scheduledFor: string;
  matchedCount: number;
  sentCount: number;
  failedCount: number;
  storm: { name: string; severity: string; affectedCities: string[] };
  rule: { name: string; hoursBeforeEta: number; emailSubject: string };
  emails: Array<{
    id: string;
    toEmail: string;
    subject: string;
    body: string;
    status: string;
    scheduledFor: string;
    sentAt: string | null;
    contact: { firstName: string; lastName: string; city: string; state: string };
  }>;
};

export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/campaigns/${params.id}`)
      .then((r) => r.json())
      .then((data) => {
        setCampaign(data);
        if (data.emails?.[0]) setSelected(data.emails[0].id);
      });
  }, [params.id]);

  if (!campaign) {
    return <div className="panel p-8 text-sm text-ink/60">Loading campaign…</div>;
  }

  const active = campaign.emails.find((e) => e.id === selected) || campaign.emails[0];

  return (
    <div>
      <PageHeader
        title={campaign.name}
        description={`${campaign.storm.name} · ${campaign.rule.name} · ${campaign.rule.hoursBeforeEta}h before ETA`}
        actions={
          <Link href="/campaigns" className="btn btn-ghost">
            Back to campaigns
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <StatusBadge value={campaign.status} />
        <StatusBadge value={campaign.storm.severity} />
        <span className="badge badge-neutral">
          {campaign.sentCount}/{campaign.matchedCount} sent
        </span>
        <span className="badge badge-neutral">
          Scheduled {format(new Date(campaign.scheduledFor), "MMM d, h:mm a")}
        </span>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <section className="panel p-5">
          <h2 className="font-display text-xl">Recipients</h2>
          <div className="mt-3 space-y-2">
            {campaign.emails.map((email) => (
              <button
                key={email.id}
                onClick={() => setSelected(email.id)}
                className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                  selected === email.id
                    ? "border-signal bg-signal/5"
                    : "border-[var(--line)] bg-white/60 hover:bg-white"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">
                    {email.contact.firstName} {email.contact.lastName}
                  </p>
                  <StatusBadge value={email.status} />
                </div>
                <p className="text-sm text-ink/55">
                  {email.contact.city}, {email.contact.state} · {email.toEmail}
                </p>
              </button>
            ))}
          </div>
        </section>

        <section className="panel p-5">
          <h2 className="font-display text-xl">Personalized email</h2>
          {active ? (
            <div className="mt-4">
              <p className="text-xs uppercase tracking-[0.12em] text-ink/45">Subject</p>
              <p className="mt-1 font-semibold">{active.subject}</p>
              <p className="mt-4 text-xs uppercase tracking-[0.12em] text-ink/45">Body</p>
              <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-ink/[0.04] p-4 font-sans text-sm leading-relaxed text-ink/80">
                {active.body}
              </pre>
              <p className="mt-3 text-xs text-ink/50">
                {active.status === "sent" && active.sentAt
                  ? `Sent ${format(new Date(active.sentAt), "MMM d, h:mm a")}`
                  : `Scheduled ${format(new Date(active.scheduledFor), "MMM d, h:mm a")}`}
              </p>
            </div>
          ) : (
            <p className="mt-4 text-sm text-ink/55">No emails in this campaign.</p>
          )}
        </section>
      </div>
    </div>
  );
}
