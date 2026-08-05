"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Play } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";

type Campaign = {
  id: string;
  name: string;
  status: string;
  scheduledFor: string;
  matchedCount: number;
  sentCount: number;
  failedCount: number;
  storm: { name: string; severity: string };
  rule: { name: string; hoursBeforeEta: number };
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function load() {
    const res = await fetch("/api/campaigns");
    setCampaigns(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  function runEngine() {
    startTransition(async () => {
      const res = await fetch("/api/engine/run", { method: "POST" });
      const json = await res.json();
      setMessage(
        `Engine: ${json.evaluation?.createdCount ?? 0} campaigns created, ${json.sending?.sent ?? 0} emails sent.`
      );
      await load();
    });
  }

  function cancelCampaign(id: string) {
    startTransition(async () => {
      await fetch(`/api/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      await load();
    });
  }

  return (
    <div>
      <PageHeader
        title="Campaigns"
        description="Campaigns are generated when a storm matches an outreach rule. Emails send at the scheduled time."
        actions={
          <button className="btn btn-signal" onClick={runEngine} disabled={pending}>
            <Play size={15} /> {pending ? "Running…" : "Run engine"}
          </button>
        }
      />

      {message ? <div className="panel mb-4 px-4 py-3 text-sm">{message}</div> : null}

      {campaigns.length === 0 ? (
        <EmptyState
          title="No campaigns yet"
          description="Add contacts, create rules, log storms, then run the outreach engine."
          action={
            <button className="btn btn-primary" onClick={runEngine}>
              Run outreach engine
            </button>
          }
        />
      ) : (
        <div className="panel overflow-hidden">
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Storm / Rule</th>
                  <th>Schedule</th>
                  <th>Progress</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/campaigns/${c.id}`} className="font-semibold text-signal">
                        {c.name}
                      </Link>
                    </td>
                    <td className="text-sm">
                      <div>{c.storm.name}</div>
                      <div className="text-ink/50">
                        {c.rule.name} · {c.rule.hoursBeforeEta}h before
                      </div>
                    </td>
                    <td className="text-sm">
                      {format(new Date(c.scheduledFor), "MMM d, h:mm a")}
                    </td>
                    <td className="text-sm">
                      {c.sentCount}/{c.matchedCount} sent
                      {c.failedCount ? ` · ${c.failedCount} failed` : ""}
                    </td>
                    <td>
                      <StatusBadge value={c.status} />
                    </td>
                    <td>
                      {c.status === "scheduled" || c.status === "sending" ? (
                        <button className="btn btn-ghost" onClick={() => cancelCampaign(c.id)}>
                          Cancel
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
