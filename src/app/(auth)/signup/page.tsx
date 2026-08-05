"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Could not create account");
        return;
      }
      router.push(json.next || "/account/setup");
      router.refresh();
    });
  }

  return (
    <div className="panel p-6 sm:p-8">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
        Create your account
      </h1>
      <p className="mt-2 text-sm text-ink/60">
        Start with login credentials, then set up your company and Stripe billing.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        {(
          [
            ["name", "Full name", "text"],
            ["email", "Work email", "email"],
            ["phone", "Phone (optional)", "tel"],
            ["password", "Password", "password"],
          ] as const
        ).map(([key, label, type]) => (
          <label key={key} className="block">
            <span className="text-xs font-medium uppercase tracking-[0.12em] text-ink/50">
              {label}
            </span>
            <input
              className="mt-1.5 w-full rounded-xl border border-ink/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-signal"
              type={type}
              value={form[key]}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              required={key !== "phone"}
              autoComplete={key === "password" ? "new-password" : key}
              minLength={key === "password" ? 8 : undefined}
            />
          </label>
        ))}

        {error && (
          <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="btn btn-signal w-full justify-center disabled:opacity-60"
        >
          {pending ? "Creating…" : "Continue to company setup"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-ink/60">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-signal hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
