import { Suspense } from "react";
import { CopilotDock } from "@/components/copilot-dock";
import { Rail, RailFallback } from "@/components/rail";
import { copilotLabel, isCopilotConfigured } from "@/lib/copilot/env";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <a href="#main" className="skip-link">Skip to content</a>
      <aside className="w-60 shrink-0 border-r border-line bg-rail text-on-rail">
        <Suspense fallback={<RailFallback />}>
          <Rail />
        </Suspense>
      </aside>
      <main id="main" className="min-w-0 flex-1">
        <div className="mx-auto max-w-[1720px] px-8 py-8 xl:px-10">{children}</div>
      </main>
      <CopilotDock configured={isCopilotConfigured()} label={copilotLabel()} />
    </div>
  );
}
