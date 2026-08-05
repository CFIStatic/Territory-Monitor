"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Upload, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";

type Contact = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  city: string;
  state: string;
  zip: string | null;
  company: string | null;
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
  listId: "",
};

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [lists, setLists] = useState<ContactList[]>([]);
  const [q, setQ] = useState("");
  const [form, setForm] = useState(blank);
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

  function onUpload(file: File | null) {
    if (!file) return;
    startTransition(async () => {
      const body = new FormData();
      body.append("file", file);
      if (uploadListId) body.append("listId", uploadListId);
      if (listName) body.append("listName", listName);
      const res = await fetch("/api/contacts/upload", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) {
        setMessage(json.error || "Upload failed");
        return;
      }
      setMessage(`Imported ${json.imported} contacts${json.skipped ? `, skipped ${json.skipped}` : ""}`);
      setListName("");
      await load();
    });
  }

  return (
    <div>
      <PageHeader
        title="Contacts"
        description="Upload your book of business. Territory matching uses city, state, and zip to decide who gets storm outreach."
      />

      {message ? (
        <div className="panel mb-4 px-4 py-3 text-sm text-ink">{message}</div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="panel p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-display text-xl">All contacts ({contacts.length})</h2>
            <div className="flex gap-2">
              <input
                className="input"
                placeholder="Search name, email, city…"
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
              description="Upload a CSV or add a contact manually to start targeting territories."
            />
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Location</th>
                    <th>List</th>
                    <th>Email</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <div className="font-medium">
                          {c.firstName} {c.lastName}
                        </div>
                        <div className="text-xs text-ink/50">{c.company || "—"}</div>
                      </td>
                      <td className="text-sm">
                        {c.city}, {c.state} {c.zip || ""}
                      </td>
                      <td className="text-sm">{c.list?.name || "—"}</td>
                      <td className="text-sm">{c.email}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
          <section className="panel p-5">
            <h2 className="font-display text-xl">Upload CSV</h2>
            <p className="mt-1 text-sm text-ink/55">
              Columns: firstName, lastName, email, city, state, zip, phone, address, company
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
              <label className="btn btn-signal w-full cursor-pointer">
                <Upload size={15} />
                {pending ? "Uploading…" : "Choose CSV file"}
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => onUpload(e.target.files?.[0] || null)}
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
