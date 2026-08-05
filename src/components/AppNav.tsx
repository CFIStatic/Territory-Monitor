"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CloudLightning,
  ContactRound,
  CreditCard,
  Eye,
  LayoutDashboard,
  LogOut,
  Mail,
  MapPinned,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import clsx from "clsx";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/map", label: "Territory map", icon: MapPinned },
  { href: "/contacts", label: "Contacts", icon: ContactRound },
  { href: "/storms", label: "Storms", icon: CloudLightning },
  { href: "/rules", label: "Rules", icon: SlidersHorizontal },
  { href: "/preview", label: "Preview", icon: Eye },
  { href: "/campaigns", label: "Campaigns", icon: Mail },
  { href: "/security", label: "Cyber defense", icon: ShieldCheck },
  { href: "/account/billing", label: "Billing", icon: CreditCard },
  { href: "/settings", label: "Settings", icon: Settings2 },
];

export function AppNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [userLabel, setUserLabel] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((json) => {
        if (json.authenticated && json.user) {
          setUserLabel(json.user.name || json.user.email);
        }
      })
      .catch(() => undefined);
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="panel sticky top-4 flex h-[calc(100vh-2rem)] w-full flex-col p-4 lg:w-64">
      <Link href="/" className="mb-6 block px-2">
        <div className="font-display text-xl font-bold tracking-tight text-ink">
          Territory Monitor
        </div>
        <p className="mt-1 text-xs text-ink/55">Storm-timed restoration outreach</p>
      </Link>

      <nav className="flex flex-1 flex-col gap-1">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                active ? "nav-link-active" : "nav-link"
              )}
            >
              <Icon size={17} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 space-y-2">
        {userLabel && (
          <div className="rounded-xl bg-mist/80 px-3 py-2 text-xs text-ink/70">
            Signed in as <span className="font-medium text-ink">{userLabel}</span>
          </div>
        )}
        <button
          type="button"
          onClick={logout}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-ink/70 transition hover:bg-ink/5"
        >
          <LogOut size={17} />
          Sign out
        </button>
        <div className="rounded-xl bg-ink px-3 py-3 text-white">
          <p className="text-xs uppercase tracking-[0.14em] text-white/55">Workflow</p>
          <p className="mt-1 text-sm leading-snug">
            Upload contacts → set rules → storms match territory → emails send on your timing.
          </p>
        </div>
      </div>
    </aside>
  );
}
