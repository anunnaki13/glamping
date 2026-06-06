import type { ReactNode } from "react";
import { BrandLockup } from "@/components/brand/brand-lockup";
import { AppHeader } from "@/components/layout/app-header";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { Sidebar } from "@/components/layout/sidebar";
import { requireSession } from "@/lib/action-guard";

type AppShellProps = {
  children: ReactNode;
};

export async function AppShell({ children }: AppShellProps) {
  const session = await requireSession();

  return (
    <div className="min-h-screen p-0 text-white lg:p-3">
      <div className="mx-auto flex min-h-screen w-full max-w-[1800px] overflow-hidden border-white/12 bg-[rgba(5,8,14,0.74)] shadow-[0_0_0_1px_rgba(184,251,255,0.10),0_34px_110px_rgba(0,0,0,0.48)] backdrop-blur-2xl lg:min-h-[calc(100vh-24px)] lg:rounded-[var(--radius-shell)] lg:border">
        <Sidebar name={session.name} role={session.role} />
        <main className="min-w-0 flex-1 px-4 pb-28 pt-4 md:px-6 lg:px-6 lg:py-5 xl:px-6">
          <div className="mb-6 flex items-center justify-between lg:hidden">
            <BrandLockup compact />
            <div className="rounded-full border border-[#29f1ff]/18 bg-[#29f1ff]/10 px-3 py-2 text-xs font-bold text-[#b8fbff]">
              {session.role.replaceAll("_", " ")}
            </div>
          </div>
          <AppHeader name={session.name} role={session.role} />
          <div className="mt-5">{children}</div>
        </main>
      </div>
      <MobileBottomNav role={session.role} />
    </div>
  );
}
