import { Suspense } from "react";
import { Rail, RailFallback } from "@/components/rail";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <a href="#main" className="skip-link">Skip to content</a>
      <aside className="w-60 shrink-0 border-r border-line bg-surface">
        <Suspense fallback={<RailFallback />}>
          <Rail />
        </Suspense>
      </aside>
      <main id="main" className="min-w-0 flex-1">
        <div className="max-w-[1280px] px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
