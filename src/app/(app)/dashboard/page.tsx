"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Play, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";

type DashboardData = {
  stats: {
    contacts: number;
    lists: number;
    activeRules: number;
    activeStorms: number;
    queuedEmails: number;
    sentEmails: number;
  };
  storms: Array<{
    id: string;
    name: string;
    type: string;
    severity: string;
    status: string;
    etaStart: string;
    affectedCities: string[];
  }>;
  campaigns: Array<{
    id: string;
    name: string;
    status: string;
    scheduledFor: string;
    matchedCount: number;
    sentCount: number;
  }>;
  recentEmails: Array<{
    id: string;
    toEmail: string;
    subject: string;
    status: string;
    scheduledFor: string;
    contact: { firstName: string; lastName: string; city: string };
  }>;
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [engineMsg, setEngineMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function load() {
    const res = await fetch("/api/dashboard");
    setData(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  function runEngine() {
    startTransition(async () => {
      const res = await fetch("/api/engine/run", { method: "POST" });
      const json = await res.json();
      setEngineMsg(
        `Engine ran: ${json.evaluation?.createdCount ?? 0} campaigns created, ${json.sending?.sent ?? 0} emails sent.`
      );
      await load();
    });
  }

  if (!data) {
    return <div className="panel p-8 text-sm text-ink/60">Loading workspace…</div>;
  }

  const cards = [
    { label: "Contacts", value: data.stats.contacts },
    { label: "Active storms", value: data.stats.activeStorms },
    { label: "Live rules", value: data.stats.activeRules },
    { label: "Queued emails", value: data.stats.queuedEmails },
    { label: "Sent emails", value: data.stats.sentEmails },
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Watch approaching storms, matched territories, and outreach that is queued or already out the door."
        actions={
          <>
            <button className="btn btn-ghost" onClick={() => load()} disabled={pending}>
              <RefreshCw size={15} /> Refresh
            </button>
            <button className="btn btn-signal" onClick={runEngine} disabled={pending}>
              <Play size={15} /> {pending ? "Running…" : "Run outreach engine"}
            </button>
          </>
        }
      />

      {engineMsg ? (
        <div className="panel mb-4 border-signal/30 bg-signal/5 px-4 py-3 text-sm text-ink">
          {engineMsg}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => (
          <div key={card.label} className="panel px-4 py-4">
            <p className="text-xs uppercase tracking-[0.12em] text-ink/45">{card.label}</p>
            <p className="mt-2 font-display text-3xl text-ink">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <section className="panel p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl text-ink">Storm radar</h2>
            <Link href="/storms" className="text-sm font-semibold text-signal">
              Manage storms
            </Link>
          </div>
          <div className="space-y-3">
            {data.storms.length === 0 ? (
              <p className="text-sm text-ink/55">No active storms. Add one to trigger outreach.</p>
            ) : (
              data.storms.map((storm) => (
                <div key={storm.id} className="rounded-xl border border-[var(--line)] bg-white/60 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-ink">{storm.name}</p>
                    <StatusBadge value={storm.severity} />
                    <StatusBadge value={storm.status} />
                  </div>
                  <p className="mt-1 text-sm text-ink/55">
                    ETA {format(new Date(storm.etaStart), "MMM d, h:mm a")} ·{" "}
                    {storm.affectedCities.slice(0, 4).join(", ")}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="panel p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl text-ink">Campaigns</h2>
            <Link href="/campaigns" className="text-sm font-semibold text-signal">
              View all
            </Link>
          </div>
          <div className="space-y-3">
            {data.campaigns.length === 0 ? (
              <p className="text-sm text-ink/55">
                No campaigns yet. Run the engine after storms and rules are in place.
              </p>
            ) : (
              data.campaigns.map((c) => (
                <Link
                  key={c.id}
                  href={`/campaigns/${c.id}`}
                  className="block rounded-xl border border-[var(--line)] bg-white/60 px-4 py-3 hover:bg-white"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-ink">{c.name}</p>
                    <StatusBadge value={c.status} />
                  </div>
                  <p className="mt-1 text-sm text-ink/55">
                    {c.matchedCount} matched · {c.sentCount} sent ·{" "}
                    {format(new Date(c.scheduledFor), "MMM d, h:mm a")}
                  </p>
                </Link>
              ))
            )}
          </div>
        </section>
      </div>

      <section className="panel mt-4 p-5">
        <h2 className="font-display text-xl text-ink">Recent email activity</h2>
        <div className="table-wrap mt-3">
          <table className="data">
            <thead>
              <tr>
                <th>Contact</th>
                <th>Subject</th>
                <th>Status</th>
                <th>Scheduled</th>
              </tr>
            </thead>
            <tbody>
              {data.recentEmails.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-sm text-ink/55">
                    No emails queued yet.
                  </td>
                </tr>
              ) : (
                data.recentEmails.map((email) => (
                  <tr key={email.id}>
                    <td>
                      <div className="font-medium">
                        {email.contact.firstName} {email.contact.lastName}
                      </div>
                      <div className="text-xs text-ink/50">
                        {email.contact.city} · {email.toEmail}
                      </div>
                    </td>
                    <td className="max-w-xs text-sm">{email.subject}</td>
                    <td>
                      <StatusBadge value={email.status} />
                    </td>
                    <td className="text-sm text-ink/60">
                      {format(new Date(email.scheduledFor), "MMM d, h:mm a")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
