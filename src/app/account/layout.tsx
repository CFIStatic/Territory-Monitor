import Link from "next/link";

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="radar-grid min-h-screen">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <Link href="/" className="font-display text-xl font-bold tracking-tight text-ink">
            Territory Monitor
          </Link>
          <p className="text-xs uppercase tracking-[0.14em] text-ink/45">Account setup</p>
        </div>
        {children}
      </div>
    </div>
  );
}
