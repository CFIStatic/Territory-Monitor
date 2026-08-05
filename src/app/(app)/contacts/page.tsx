"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { HeartHandshake, Upload, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";

type Contact = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  address: string | null;
  city: string;
  state: string;
  zip: string | null;
  company: string | null;
  spouseName: string | null;
  familyNotes: string | null;
  personalTouch: string | null;
  lastConversation: string | null;
  notes: string | null;
  list?: { id: string; name: string } | null;
};

type ContactList = {
  id: string;
  name: string;
  _count?: { contacts: number };
};

type BulkResult = {
  imported: number;
  skipped: number;
  skippedExisting?: number;
  parsed?: number;
  batches?: number;
  durationMs?: number;
  listCount?: number;
  workspaceCount?: number;
  files?: Array<{ name: string; format: string; imported: number; sizeBytes?: number | null }>;
};

const blank = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  zip: "",
  company: "",
  spouseName: "",
  familyNotes: "",
  personalTouch: "",
  lastConversation: "",
  notes: "",
  listId: "",
};

function memoryCount(c: Contact) {
  return [c.spouseName, c.familyNotes, c.personalTouch, c.lastConversation].filter(Boolean)
    .length;
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [lists, setLists] = useState<ContactList[]>([]);
  const [q, setQ] = useState("");
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [listName, setListName] = useState("");
  const [uploadListId, setUploadListId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [bulkResult, setBulkResult] = useState<BulkResult | null>(null);
  const [queuedFiles, setQueuedFiles] = useState<File[]>([]);
  const [pending, startTransition] = useTransition();
  const limit = 50;

  async function load(nextPage = page) {
    const params = new URLSearchParams({
      page: String(nextPage),
      limit: String(limit),
    });
    if (q.trim()) params.set("q", q.trim());

    const [cRes, lRes] = await Promise.all([
      fetch(`/api/contacts?${params}`),
      fetch("/api/lists"),
    ]);
    const cJson = await cRes.json();
    setContacts(cJson.contacts || []);
    setTotal(cJson.total || 0);
    setPage(cJson.page || nextPage);
    setTotalPages(cJson.totalPages || 1);
    setLists(await lRes.json());
  }

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const queuedSize = useMemo(
    () => queuedFiles.reduce((sum, f) => sum + f.size, 0),
    [queuedFiles]
  );

  function queueFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    setQueuedFiles(Array.from(fileList));
    setBulkResult(null);
    setMessage(
      `${fileList.length} file${fileList.length === 1 ? "" : "s"} ready — click Bulk import to load your book of business`
    );
  }

  function runBulkImport() {
    if (!queuedFiles.length) {
      setMessage("Choose a CSV, Excel, or PDF with your full contact list first");
      return;
    }
    startTransition(async () => {
      setMessage(
        `Bulk importing ${queuedFiles.length} file${queuedFiles.length === 1 ? "" : "s"} (${formatBytes(queuedSize)})… this can take a minute for 10,000+ rows`
      );
      const body = new FormData();
      for (const file of queuedFiles) body.append("files", file);
      if (uploadListId) body.append("listId", uploadListId);
      if (listName) body.append("listName", listName);
      const res = await fetch("/api/contacts/upload", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) {
        setMessage(json.error || "Bulk upload failed");
        return;
      }
      setBulkResult(json);
      setQueuedFiles([]);
      setListName("");
      setMessage(
        `Bulk import complete: ${json.imported.toLocaleString()} contacts added` +
          (json.skipped ? `, ${json.skipped.toLocaleString()} skipped` : "") +
          (json.durationMs ? ` in ${(json.durationMs / 1000).toFixed(1)}s` : "")
      );
      await load(1);
    });
  }

  function addContact() {
    startTransition(async () => {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          listId: form.listId || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage(json.error || "Failed to add contact");
        return;
      }
      setForm(blank);
      setMessage(`Added ${json.firstName} ${json.lastName}`);
      await load(1);
    });
  }

  function saveMemories() {
    if (!editing) return;
    startTransition(async () => {
      const res = await fetch(`/api/contacts/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spouseName: editing.spouseName,
          familyNotes: editing.familyNotes,
          personalTouch: editing.personalTouch,
          lastConversation: editing.lastConversation,
          notes: editing.notes,
          phone: editing.phone,
          address: editing.address,
          company: editing.company,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage(json.error || "Failed to save memories");
        return;
      }
      setMessage(`Saved personal memories for ${json.firstName}`);
      setEditing(null);
      await load(page);
    });
  }

  return (
    <div>
      <PageHeader
        title="Contacts"
        description="Bulk upload your full book of business — CSV, Excel, or PDF with thousands of rows. Then add personal memories so outreach stays one-to-one."
      />

      {message ? (
        <div className="panel mb-4 px-4 py-3 text-sm text-ink">{message}</div>
      ) : null}

      <section className="panel mb-4 border-signal/25 bg-signal/[0.04] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl text-ink">Bulk upload</h2>
            <p className="mt-1 max-w-2xl text-sm text-ink/60">
              Drop your entire list here — built for big dumps (thousands to 100,000 contacts).
              We parse the file, skip duplicates, and batch-insert so a 10,000-row CSV finishes in seconds, not one-by-one.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="badge badge-watch">CSV</span>
            <span className="badge badge-watch">Excel</span>
            <span className="badge badge-watch">PDF</span>
            <span className="badge badge-neutral">up to 100k rows</span>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <input
            className="input"
            placeholder="List name for this dump (e.g. Midwest book 2026)"
            value={listName}
            onChange={(e) => setListName(e.target.value)}
          />
          <select
            className="select"
            value={uploadListId}
            onChange={(e) => setUploadListId(e.target.value)}
          >
            <option value="">Create new list from file name</option>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                Add into: {l.name}
              </option>
            ))}
          </select>
          <button
            className="btn btn-signal"
            onClick={runBulkImport}
            disabled={pending || queuedFiles.length === 0}
          >
            <Upload size={15} />
            {pending ? "Importing…" : "Bulk import"}
          </button>
        </div>

        <label
          className="mt-4 flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-ink/20 bg-white/70 px-6 py-8 text-center transition hover:border-signal hover:bg-signal/5"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            queueFiles(e.dataTransfer.files);
          }}
        >
          <Upload size={28} className="text-signal" />
          <span className="mt-3 text-base font-semibold text-ink">
            {pending
              ? "Bulk import running…"
              : "Drop a 10,000-contact CSV / Excel / PDF here"}
          </span>
          <span className="mt-1 text-sm text-ink/50">
            or click to browse · multi-file supported · max 50MB per file
          </span>
          <input
            type="file"
            accept=".csv,.tsv,.txt,.xlsx,.xls,.xlsm,.pdf,text/csv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            multiple
            className="hidden"
            onChange={(e) => {
              queueFiles(e.target.files);
              e.currentTarget.value = "";
            }}
          />
        </label>

        {queuedFiles.length > 0 ? (
          <div className="mt-3 rounded-xl border border-[var(--line)] bg-white/80 px-4 py-3 text-sm">
            <p className="font-semibold text-ink">
              Queued: {queuedFiles.length} file{queuedFiles.length === 1 ? "" : "s"} ·{" "}
              {formatBytes(queuedSize)}
            </p>
            <ul className="mt-2 space-y-1 text-ink/65">
              {queuedFiles.map((f) => (
                <li key={`${f.name}-${f.size}`}>
                  {f.name} · {formatBytes(f.size)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {bulkResult ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl bg-ink px-4 py-3 text-white">
              <p className="text-xs uppercase tracking-[0.12em] text-white/55">Imported</p>
              <p className="mt-1 font-display text-3xl">
                {bulkResult.imported.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--line)] bg-white/80 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.12em] text-ink/45">Skipped</p>
              <p className="mt-1 font-display text-3xl text-ink">
                {bulkResult.skipped.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--line)] bg-white/80 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.12em] text-ink/45">Workspace total</p>
              <p className="mt-1 font-display text-3xl text-ink">
                {(bulkResult.workspaceCount ?? total).toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--line)] bg-white/80 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.12em] text-ink/45">Time</p>
              <p className="mt-1 font-display text-3xl text-ink">
                {bulkResult.durationMs
                  ? `${(bulkResult.durationMs / 1000).toFixed(1)}s`
                  : "—"}
              </p>
            </div>
          </div>
        ) : null}
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="panel p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-display text-xl">
              Contact book ({total.toLocaleString()})
            </h2>
            <div className="flex gap-2">
              <input
                className="input"
                placeholder="Search name, email, memories…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <button
                className="btn btn-ghost"
                onClick={() => load(1)}
                disabled={pending}
              >
                Search
              </button>
            </div>
          </div>

          {contacts.length === 0 ? (
            <EmptyState
              title="No contacts yet"
              description="Use Bulk upload above to dump your full list (CSV / Excel / PDF)."
            />
          ) : (
            <div className="space-y-2">
              {contacts.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setEditing(c)}
                  className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                    editing?.id === c.id
                      ? "border-signal bg-signal/5"
                      : "border-[var(--line)] bg-white/60 hover:bg-white"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">
                        {c.firstName} {c.lastName}
                        {c.spouseName ? (
                          <span className="font-normal text-ink/55"> · & {c.spouseName}</span>
                        ) : null}
                      </p>
                      <p className="text-sm text-ink/55">
                        {c.city}, {c.state} {c.zip || ""} · {c.email}
                      </p>
                    </div>
                    <span className="badge badge-watch">
                      <HeartHandshake size={12} /> {memoryCount(c)} memories
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {totalPages > 1 ? (
            <div className="mt-4 flex items-center justify-between gap-3">
              <button
                className="btn btn-ghost"
                disabled={page <= 1 || pending}
                onClick={() => load(page - 1)}
              >
                Previous
              </button>
              <p className="text-sm text-ink/55">
                Page {page} of {totalPages.toLocaleString()} · showing {contacts.length} of{" "}
                {total.toLocaleString()}
              </p>
              <button
                className="btn btn-ghost"
                disabled={page >= totalPages || pending}
                onClick={() => load(page + 1)}
              >
                Next
              </button>
            </div>
          ) : null}
        </section>

        <div className="space-y-4">
          {editing ? (
            <section className="panel p-5">
              <h2 className="font-display text-xl">
                Memories · {editing.firstName} {editing.lastName}
              </h2>
              <p className="mt-1 text-sm text-ink/55">
                These details are woven into that person’s outreach email only.
              </p>
              <div className="mt-4 space-y-3">
                <input
                  className="input"
                  placeholder="Spouse / partner name"
                  value={editing.spouseName || ""}
                  onChange={(e) => setEditing({ ...editing, spouseName: e.target.value })}
                />
                <textarea
                  className="textarea min-h-20"
                  placeholder="Family notes"
                  value={editing.familyNotes || ""}
                  onChange={(e) => setEditing({ ...editing, familyNotes: e.target.value })}
                />
                <textarea
                  className="textarea min-h-20"
                  placeholder="Personal touch"
                  value={editing.personalTouch || ""}
                  onChange={(e) => setEditing({ ...editing, personalTouch: e.target.value })}
                />
                <textarea
                  className="textarea min-h-20"
                  placeholder="Last conversation"
                  value={editing.lastConversation || ""}
                  onChange={(e) =>
                    setEditing({ ...editing, lastConversation: e.target.value })
                  }
                />
                <div className="flex gap-2">
                  <button className="btn btn-primary" onClick={saveMemories} disabled={pending}>
                    Save memories
                  </button>
                  <button className="btn btn-ghost" onClick={() => setEditing(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            </section>
          ) : null}

          <section className="panel p-5">
            <h2 className="font-display text-xl">Add one contact</h2>
            <p className="mt-1 text-sm text-ink/55">
              For quick adds. For the full book, use Bulk upload above.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["firstName", "First name"],
                  ["lastName", "Last name"],
                  ["email", "Email"],
                  ["phone", "Phone"],
                  ["city", "City"],
                  ["state", "State"],
                  ["zip", "Zip"],
                  ["company", "Company"],
                  ["spouseName", "Spouse / partner"],
                ] as const
              ).map(([key, label]) => (
                <input
                  key={key}
                  className="input"
                  placeholder={label}
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                />
              ))}
              <input
                className="input sm:col-span-2"
                placeholder="Address"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              />
            </div>
            <button className="btn btn-primary mt-4" onClick={addContact} disabled={pending}>
              <UserPlus size={15} /> Add contact
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
