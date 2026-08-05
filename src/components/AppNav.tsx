"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CloudLightning,
  ContactRound,
  LayoutDashboard,
  Mail,
  Settings2,
  SlidersHorizontal,
} from "lucide-react";
import clsx from "clsx";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/contacts", label: "Contacts", icon: ContactRound },
  { href: "/storms", label: "Storms", icon: CloudLightning },
  { href: "/rules", label: "Rules", icon: SlidersHorizontal },
  { href: "/campaigns", label: "Campaigns", icon: Mail },
  { href: "/settings", label: "Settings", icon: Settings2 },
];

export function AppNav() {
  const pathname = usePathname();

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
                active
                  ? "bg-ink text-white"
                  : "text-ink/70 hover:bg-white/70 hover:text-ink"
              )}
            >
              <Icon size={17} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 rounded-xl bg-ink px-3 py-3 text-white">
        <p className="text-xs uppercase tracking-[0.14em] text-white/55">Workflow</p>
        <p className="mt-1 text-sm leading-snug">
          Upload contacts → set rules → storms match territory → emails send on your timing.
        </p>
      </div>
    </aside>
  );
}
