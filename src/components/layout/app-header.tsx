import Link from "next/link";
import { Bell, CalendarDays, Search, ShieldCheck } from "lucide-react";
import type { UserRole } from "@/generated/prisma/enums";
import { formatDateId } from "@/lib/formatters";

type AppHeaderProps = {
  name: string;
  role: UserRole;
};

const roleLabels: Record<UserRole, string> = {
  OWNER: "Owner",
  MANAGER: "Manager",
  FRONT_OFFICE: "Front Office",
  HOUSEKEEPING: "Housekeeping",
  FNB_ACTIVITY: "F&B / Activity",
  VIEWER: "Viewer",
};

function firstName(name: string) {
  return name.split(" ").filter(Boolean)[0] ?? name;
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U";
}

export function AppHeader({ name, role }: AppHeaderProps) {
  const todayLabel = formatDateId(new Date());
  const roleLabel = roleLabels[role];

  return (
    <header className="flex min-h-[96px] flex-col gap-5 pb-5 pt-2 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0 lg:w-[360px]">
        <h1 className="truncate text-2xl font-semibold tracking-normal text-white md:text-[28px]">
          Welcome back, {firstName(name)}
        </h1>
        <p className="mt-2 text-sm font-medium text-white/48">Here&apos;s what&apos;s happening at your resort today.</p>
      </div>

      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-3">
        <form
          action="/reservations"
          className="hidden min-h-12 w-[min(460px,34vw)] items-center gap-3 rounded-full border border-white/12 bg-black/18 px-5 text-white/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl xl:flex"
          role="search"
        >
          <input
            name="q"
            aria-label="Cari data operasional"
            className="w-full bg-transparent text-sm font-medium text-white outline-none placeholder:text-white/45"
            placeholder="Cari reservasi, tamu, unit..."
          />
          <button type="submit" className="grid size-8 shrink-0 place-items-center rounded-full bg-[#29f1ff]/10 text-[#b8fbff] transition hover:bg-[#29f1ff]/16" aria-label="Cari">
            <Search className="size-4" />
          </button>
        </form>

        <time className="hidden min-h-12 items-center gap-3 rounded-full border border-white/12 bg-black/18 px-4 text-sm font-bold text-white/76 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl md:inline-flex">
          <CalendarDays className="size-5" />
          {todayLabel}
        </time>

        <div className="hidden min-h-12 items-center gap-3 px-2 lg:flex">
          <div className="grid size-2.5 place-items-center rounded-full bg-[#68d391] shadow-[0_0_14px_rgba(104,211,145,0.55)]" />
          <div>
            <p className="text-xs font-black text-white">System Status</p>
            <p className="mt-1 text-[11px] font-semibold text-white/46">All systems operational</p>
          </div>
        </div>

        <Link
          href="/messages"
          aria-label="Buka messages"
          className="relative grid size-12 place-items-center rounded-[18px] border border-white/12 bg-black/18 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl transition hover:border-[#29f1ff]/40"
        >
          <Bell className="size-5" />
          <span className="absolute right-2.5 top-2.5 size-2.5 rounded-full bg-[#ff6b5f]" />
        </Link>

        <div className="hidden min-h-12 items-center gap-3 rounded-full border border-white/12 bg-black/18 py-1.5 pl-1.5 pr-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl lg:flex">
          <div className="grid size-9 place-items-center rounded-full border border-[#29f1ff]/28 bg-[#29f1ff]/14 text-sm font-black text-[#b8fbff]">
            {initials(name)}
          </div>
          <div className="min-w-0 leading-none">
            <p className="max-w-[140px] truncate text-xs font-bold text-white">{name}</p>
            <p className="mt-1.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-normal text-white/42">
              <ShieldCheck className="size-3 text-[#29f1ff]" /> {roleLabel}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
