import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="radar-grid min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-lg flex-col px-4 py-8">
        <Link href="/" className="mb-8 font-display text-xl font-bold tracking-tight text-ink">
          Territory Monitor
        </Link>
        <div className="flex flex-1 flex-col justify-center pb-16">{children}</div>
      </div>
    </div>
  );
}
