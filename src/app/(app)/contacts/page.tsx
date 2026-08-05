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

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [lists, setLists] = useState<ContactList[]>([]);
  const [q, setQ] = useState("");
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [listName, setListName] = useState("");
  const [uploadListId, setUploadListId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function load() {
    const [cRes, lRes] = await Promise.all([
      fetch(`/api/contacts${q ? `?q=${encodeURIComponent(q)}` : ""}`),
      fetch("/api/lists"),
    ]);
    setContacts(await cRes.json());
    setLists(await lRes.json());
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cityCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of contacts) {
      map.set(c.city, (map.get(c.city) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [contacts]);

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
      await load();
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
      await load();
    });
  }

  function onUpload(fileList: FileList | null) {
    if (!fileList?.length) return;
    const files = Array.from(fileList);
    startTransition(async () => {
      const body = new FormData();
      for (const file of files) body.append("files", file);
      if (uploadListId) body.append("listId", uploadListId);
      if (listName) body.append("listName", listName);
      const res = await fetch("/api/contacts/upload", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) {
        setMessage(json.error || "Upload failed");
        return;
      }
      const fileSummary = Array.isArray(json.files)
        ? json.files
            .map(
              (f: { name: string; format: string; imported: number }) =>
                `${f.name} (${f.format}: ${f.imported})`
            )
            .join(" · ")
        : "";
      setMessage(
        `Imported ${json.imported} contacts${json.skipped ? `, skipped ${json.skipped}` : ""}${
          fileSummary ? ` — ${fileSummary}` : ""
        }`
      );
      setListName("");
      await load();
    });
  }

  return (
    <div>
      <PageHeader
        title="Contacts"
        description="Save what you remember — spouse, family, personal touches, last conversation — so outreach emails feel one-to-one, not cookie cutter."
      />

      {message ? (
        <div className="panel mb-4 px-4 py-3 text-sm text-ink">{message}</div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="panel p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-display text-xl">All contacts ({contacts.length})</h2>
            <div className="flex gap-2">
              <input
                className="input"
                placeholder="Search name, email, memories…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <button className="btn btn-ghost" onClick={() => load()} disabled={pending}>
                Search
              </button>
            </div>
          </div>

          {contacts.length === 0 ? (
            <EmptyState
              title="No contacts yet"
              description="Upload a CSV/Excel/PDF or add a contact, then capture personal memories for the outreach agent."
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
                  {(c.familyNotes || c.personalTouch || c.lastConversation) && (
                    <p className="mt-2 line-clamp-2 text-xs text-ink/60">
                      {[c.familyNotes, c.personalTouch, c.lastConversation]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}

          {cityCounts.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {cityCounts.map(([city, count]) => (
                <span key={city} className="badge badge-neutral">
                  {city} · {count}
                </span>
              ))}
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
                  placeholder="Family notes (kids, pets, how everyone’s doing)"
                  value={editing.familyNotes || ""}
                  onChange={(e) => setEditing({ ...editing, familyNotes: e.target.value })}
                />
                <textarea
                  className="textarea min-h-20"
                  placeholder="Personal touch (hobbies, home details you remember)"
                  value={editing.personalTouch || ""}
                  onChange={(e) => setEditing({ ...editing, personalTouch: e.target.value })}
                />
                <textarea
                  className="textarea min-h-20"
                  placeholder="Last conversation (what you talked about last time)"
                  value={editing.lastConversation || ""}
                  onChange={(e) =>
                    setEditing({ ...editing, lastConversation: e.target.value })
                  }
                />
                <textarea
                  className="textarea min-h-16"
                  placeholder="Other CRM notes"
                  value={editing.notes || ""}
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
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
            <h2 className="font-display text-xl">Dump contact files</h2>
            <p className="mt-1 text-sm text-ink/55">
              CSV / Excel / PDF. Optional columns: spouse, family, personalTouch, lastConversation.
            </p>
            <div className="mt-4 space-y-3">
              <input
                className="input"
                placeholder="New list name (optional)"
                value={listName}
                onChange={(e) => setListName(e.target.value)}
              />
              <select
                className="select"
                value={uploadListId}
                onChange={(e) => setUploadListId(e.target.value)}
              >
                <option value="">Or choose existing list</option>
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
              <label
                className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-ink/20 bg-white/50 px-4 py-6 text-center transition hover:border-signal hover:bg-signal/5"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  onUpload(e.dataTransfer.files);
                }}
              >
                <Upload size={20} className="text-signal" />
                <span className="mt-2 text-sm font-semibold">
                  {pending ? "Importing…" : "Drop files or browse"}
                </span>
                <input
                  type="file"
                  accept=".csv,.tsv,.txt,.xlsx,.xls,.xlsm,.pdf,text/csv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    onUpload(e.target.files);
                    e.currentTarget.value = "";
                  }}
                />
              </label>
            </div>
          </section>

          <section className="panel p-5">
            <h2 className="font-display text-xl">Add contact</h2>
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
              <textarea
                className="textarea sm:col-span-2 min-h-16"
                placeholder="Family notes"
                value={form.familyNotes}
                onChange={(e) => setForm((f) => ({ ...f, familyNotes: e.target.value }))}
              />
              <textarea
                className="textarea sm:col-span-2 min-h-16"
                placeholder="Personal touch"
                value={form.personalTouch}
                onChange={(e) => setForm((f) => ({ ...f, personalTouch: e.target.value }))}
              />
              <textarea
                className="textarea sm:col-span-2 min-h-16"
                placeholder="Last conversation"
                value={form.lastConversation}
                onChange={(e) => setForm((f) => ({ ...f, lastConversation: e.target.value }))}
              />
              <select
                className="select sm:col-span-2"
                value={form.listId}
                onChange={(e) => setForm((f) => ({ ...f, listId: e.target.value }))}
              >
                <option value="">No list</option>
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
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
