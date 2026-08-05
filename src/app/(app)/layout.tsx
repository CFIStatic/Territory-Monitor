import { AppNav } from "@/components/AppNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="radar-grid min-h-screen">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 p-4 lg:flex-row">
        <AppNav />
        <main className="min-w-0 flex-1 pb-10 pt-2 lg:pt-4">{children}</main>
      </div>
    </div>
  );
}
