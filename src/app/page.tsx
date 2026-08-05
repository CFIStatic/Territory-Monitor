import Link from "next/link";
import { ArrowRight, CloudLightning, MapPinned, Timer } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <section className="relative min-h-[100svh] overflow-hidden hero-atmosphere text-white">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20" />
          <div className="absolute left-1/2 top-1/2 h-[360px] w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-teal-200/30 pulse-ring" />
          <div className="absolute left-1/2 top-1/2 h-[220px] w-[220px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/25" />
          <div
            className="sweep absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 origin-center"
            style={{
              background:
                "conic-gradient(from 0deg, transparent 0deg, rgba(15,138,122,0.35) 50deg, transparent 90deg)",
              maskImage: "radial-gradient(circle, transparent 28%, black 29%, black 49%, transparent 50%)",
            }}
          />
        </div>

        <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-6xl flex-col px-6 py-8">
          <header className="flex items-center justify-between">
            <div className="font-display text-lg tracking-tight">Territory Monitor</div>
            <Link href="/dashboard" className="btn btn-ghost border-white/20 bg-white/5 text-white hover:bg-white/10">
              Open app
            </Link>
          </header>

          <div className="flex flex-1 flex-col justify-center pb-16 pt-20">
            <h1 className="fade-up font-display max-w-3xl text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
              Territory Monitor
            </h1>
            <p className="fade-up-delay mt-5 max-w-xl text-lg leading-relaxed text-white/75">
              Event-driven email outreach for restoration sales — upload contacts, set rules, and
              reach the right homeowners before the storm arrives.
            </p>
            <div className="fade-up-delay mt-8 flex flex-wrap gap-3">
              <Link href="/dashboard" className="btn btn-signal">
                Launch workspace <ArrowRight size={16} />
              </Link>
              <Link href="/rules" className="btn btn-ghost border-white/20 bg-white/5 text-white hover:bg-white/10">
                Configure rules
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="font-display text-3xl tracking-tight text-ink">Built for storm-driven sales</h2>
        <p className="mt-3 max-w-2xl text-ink/60">
          When a weather event dictates the sales cycle, timing and territory matter more than blast volume.
        </p>

        <div className="mt-10 grid gap-8 md:grid-cols-3">
          <div>
            <MapPinned className="text-signal" />
            <h3 className="mt-3 font-display text-xl text-ink">Know who is in path</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink/60">
              Match contacts by city, state, and zip against an approaching storm so Milwaukee gets Milwaukee messaging.
            </p>
          </div>
          <div>
            <Timer className="text-signal" />
            <h3 className="mt-3 font-display text-xl text-ink">Time the outreach</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink/60">
              Set rules like “email 24 hours before ETA” and Territory Monitor schedules personalized sends automatically.
            </p>
          </div>
          <div>
            <CloudLightning className="text-signal" />
            <h3 className="mt-3 font-display text-xl text-ink">Personalize at scale</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink/60">
              Templates use contact and storm details so every message feels local, timely, and ready to help.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
