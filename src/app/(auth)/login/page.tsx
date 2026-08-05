"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("jordan@lakeshorerestoration.com");
  const [password, setPassword] = useState("Demo1234!");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Login failed");
        return;
      }
      router.push(json.next || "/dashboard");
      router.refresh();
    });
  }

  return (
    <div className="panel p-6 sm:p-8">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">Sign in</h1>
      <p className="mt-2 text-sm text-ink/60">
        Access your territory workspace, storms, and campaigns.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-[0.12em] text-ink/50">Email</span>
          <input
            className="mt-1.5 w-full rounded-xl border border-ink/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-signal"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-[0.12em] text-ink/50">Password</span>
          <input
            className="mt-1.5 w-full rounded-xl border border-ink/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-signal"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </label>

        {error && (
          <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="btn btn-signal w-full justify-center disabled:opacity-60"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-ink/60">
        New here?{" "}
        <Link href="/signup" className="font-medium text-signal hover:underline">
          Create an account
        </Link>
      </p>
      <p className="mt-3 text-center text-xs text-ink/45">
        Demo seed: jordan@lakeshorerestoration.com / Demo1234!
      </p>
    </div>
  );
}
