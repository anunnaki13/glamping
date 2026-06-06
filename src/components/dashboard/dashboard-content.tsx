"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BedDouble,
  CalendarCheck,
  ClipboardCheck,
  DollarSign,
  Home,
  Plus,
  Sparkles,
  TrendingUp,
  Users,
  Wrench,
} from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

export type DashboardIconKey =
  | "users"
  | "dollar"
  | "calendar"
  | "home"
  | "trend"
  | "wrench"
  | "bed"
  | "clipboard"
  | "sparkles";

export type DashboardData = {
  kpis: Array<{
    title: string;
    value: string;
    description?: string;
    trend?: { value: string; direction: "up" | "down" | "flat" };
    icon: DashboardIconKey;
    tone?: "forest" | "gold" | "sage" | "blue" | "violet" | "cyan" | "teal" | "amber" | "green";
  }>;
  canViewFinancials: boolean;
  financialTrendTitle: string;
  occupancyTrend: Array<{ day: string; value: number }>;
  revenueTrend: Array<{ day: string; value: number }>;
  requestTrend: Array<{ day: string; value: number }>;
  unitStatus: Array<{ name: string; value: number; color: string }>;
  totalUnits: number;
  arrivals: Array<{ time: string; guest: string; meta: string; unit: string }>;
  reservations: Array<{ guest: string; date: string; status: string; amount: string | null; tone: StatusTone }>;
  serviceRequests: Array<{ icon: DashboardIconKey; title: string; unit: string; age: string; priority: "Urgent" | "High" | "Medium" | "Low" }>;
  bookingSources: Array<{ source: string; value: number }>;
  priorityTasks: Array<{ label: string; status: string; tone: StatusTone }>;
  quickActions: Array<{
    label: string;
    href: string;
    variant: "primary" | "secondary";
    icon: "plus" | "sparkles" | "wrench" | "clipboard";
  }>;
};

const iconMap: Record<DashboardIconKey, LucideIcon> = {
  users: Users,
  dollar: DollarSign,
  calendar: CalendarCheck,
  home: Home,
  trend: TrendingUp,
  wrench: Wrench,
  bed: BedDouble,
  clipboard: ClipboardCheck,
  sparkles: Sparkles,
};

const quickActionIconMap: Record<DashboardData["quickActions"][number]["icon"], LucideIcon> = {
  plus: Plus,
  sparkles: Sparkles,
  wrench: Wrench,
  clipboard: ClipboardCheck,
};

const priorityTone = {
  Urgent: "danger",
  High: "danger",
  Medium: "warning",
  Low: "success",
} as const;

export function DashboardContent({ data }: { data: DashboardData }) {
  return (
    <>
      <section className="grid gap-4 xl:grid-cols-5">
        {data.kpis.map((kpi) => (
          <StatCard key={kpi.title} {...kpi} icon={iconMap[kpi.icon]} />
        ))}
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[1.12fr_1.12fr_0.88fr]">
        <ChartCard title="Occupancy Trend" action="7 Hari">
          <TrendList
            data={data.occupancyTrend}
            maxValue={100}
            tone="cyan"
            valueLabel={(value) => `${value}%`}
          />
        </ChartCard>

        {data.canViewFinancials ? (
          <ChartCard title={data.financialTrendTitle} action="7 Hari">
            <TrendList
              data={data.revenueTrend}
              tone="violet"
              valueLabel={(value) => `${formatOneDecimal(value)}M`}
            />
          </ChartCard>
        ) : (
          <ChartCard title="Request Load" action="7 Hari">
            <TrendList
              data={data.requestTrend}
              tone="violet"
              valueLabel={(value) => String(value)}
            />
          </ChartCard>
        )}

        <GlassCard className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white">Unit Status</h2>
            <span className="rounded-full border border-[#29f1ff]/20 bg-[#29f1ff]/10 px-2.5 py-1 text-xs font-bold text-[#b8fbff]">Live</span>
          </div>
          <div className="mt-5 space-y-4">
            <div className="rounded-[24px] surface-inset p-5 text-center">
              <p className="text-4xl font-semibold text-gradient-cyan">{data.totalUnits}</p>
              <p className="mt-1 text-xs font-semibold text-white/48">Total Units</p>
            </div>
            <div className="space-y-3">
              {data.unitStatus.map((item) => (
                <div key={item.name} className="rounded-[16px] border border-white/10 bg-white/[0.035] px-3 py-2.5">
                  <div className="flex items-center justify-between gap-3 text-sm font-semibold">
                    <span className="flex items-center gap-2 text-white/78">
                      <span className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      {item.name}
                    </span>
                    <span className="text-white/82">{item.value}</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full"
                      style={{
                        backgroundColor: item.color,
                        width: `${data.totalUnits > 0 ? Math.round((item.value / data.totalUnits) * 100) : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
              {data.unitStatus.length === 0 ? <EmptyLine label="Belum ada status unit." /> : null}
              </div>
            </div>
        </GlassCard>
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr_1.1fr]">
        <GlassCard className="p-5">
          <CardTitle title="Upcoming Arrivals" href="/reservations" />
          <div className="mt-4 space-y-2.5">
            {data.arrivals.map((arrival) => (
              <div key={`${arrival.time}-${arrival.guest}`} className="rounded-[20px] surface-inset p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                <div className="grid grid-cols-[72px_1fr_auto] items-center gap-3">
                  <div className="text-sm font-bold text-[#29f1ff]">
                    <p>{arrival.time}</p>
                    <p className="text-xs text-white/58">Arrival</p>
                  </div>
                  <div>
                    <p className="font-bold text-white">{arrival.guest}</p>
                    <p className="mt-1 text-xs font-medium text-white/58">{arrival.meta}</p>
                  </div>
                  <p className="max-w-[120px] text-right text-xs font-semibold text-[#b8fbff]">{arrival.unit}</p>
                </div>
              </div>
            ))}
            {data.arrivals.length === 0 ? <EmptyLine label="Tidak ada arrival aktif." /> : null}
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <CardTitle title="Recent Reservations" href="/reservations" />
          <div className="mt-4 space-y-2.5">
            {data.reservations.map((reservation) => (
              <div key={`${reservation.guest}-${reservation.date}`} className="grid grid-cols-[42px_1fr_auto] items-center gap-3 rounded-[20px] surface-inset p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                <div className="grid size-10 place-items-center rounded-[16px] border border-[#29f1ff]/18 bg-[#29f1ff]/10 text-[#b8fbff]">
                  <CalendarCheck className="size-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-white">{reservation.guest}</p>
                    <StatusBadge label={reservation.status} tone={reservation.tone} />
                  </div>
                  <p className="mt-1 text-xs font-medium text-white/58">{reservation.date}</p>
                </div>
                {reservation.amount ? <p className="text-right text-sm font-bold text-white">{reservation.amount}</p> : null}
              </div>
            ))}
            {data.reservations.length === 0 ? <EmptyLine label="Belum ada reservasi terbaru." /> : null}
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <CardTitle title="Pending Service Requests" href="/service-requests" />
          <div className="mt-4 space-y-2.5">
            {data.serviceRequests.map((request) => {
              const Icon = iconMap[request.icon];
              return (
                <div key={`${request.title}-${request.unit}`} className="grid grid-cols-[46px_1fr_auto] items-center gap-3 rounded-[20px] surface-inset p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                  <div className="grid size-11 place-items-center rounded-[var(--radius-input)] border border-[#f6b94b]/18 bg-[#f6b94b]/10 text-[#ffe0a3]">
                    <Icon className="size-5" />
                  </div>
                  <div>
                    <p className="font-bold text-white">{request.title}</p>
                    <p className="mt-1 text-xs font-medium text-white/58">{request.unit}</p>
                  </div>
                  <div className="text-right">
                    <p className="mb-2 text-xs font-semibold text-white/58">{request.age}</p>
                    <StatusBadge label={request.priority} tone={priorityTone[request.priority]} />
                  </div>
                </div>
              );
            })}
            {data.serviceRequests.length === 0 ? <EmptyLine label="Tidak ada pending request." /> : null}
          </div>
        </GlassCard>
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
        <ChartCard title="Booking Source" action="Bulan ini">
          <SourceList data={data.bookingSources} />
        </ChartCard>

        <GlassCard className="p-5">
          <CardTitle title="Priority Tasks" href="/service-requests" />
          <div className="mt-4 space-y-2.5">
            {data.priorityTasks.map((task) => (
              <div key={task.label} className="flex items-center justify-between gap-3 rounded-[20px] surface-inset p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-[16px] bg-white/[0.07] text-[#29f1ff]">
                    <Sparkles className="size-5" />
                  </div>
                  <p className="font-semibold text-white/84">{task.label}</p>
                </div>
                <StatusBadge label={task.status} tone={task.tone} />
              </div>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            {data.quickActions.map((action) => (
              <QuickActionLink key={action.href} {...action} />
            ))}
          </div>
        </GlassCard>
      </section>
    </>
  );
}

function ChartCard({ title, action, children }: { title: string; action: string; children: React.ReactNode }) {
  return (
    <GlassCard className="p-5">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-base font-bold text-white">{title}</h2>
        <span className="rounded-full border border-white/10 bg-white/[0.07] px-3 py-1.5 text-xs font-bold text-white/72">
          {action}
        </span>
      </div>
      {children}
    </GlassCard>
  );
}

function TrendList({
  data,
  maxValue,
  tone,
  valueLabel,
}: {
  data: Array<{ day: string; value: number }>;
  maxValue?: number;
  tone: "cyan" | "violet";
  valueLabel: (value: number) => string;
}) {
  const max = Math.max(maxValue ?? 0, ...data.map((item) => item.value), 1);
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const average = data.length > 0 ? total / data.length : 0;
  const toneClass = tone === "cyan" ? "bg-[#29f1ff] shadow-[0_0_16px_rgba(41,241,255,0.26)]" : "bg-[#a989ff] shadow-[0_0_16px_rgba(169,137,255,0.24)]";
  const textClass = tone === "cyan" ? "text-[#b8fbff]" : "text-[#d9ccff]";

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-[18px] surface-inset p-3">
          <p className="text-[11px] font-black uppercase tracking-normal text-white/34">Average</p>
          <p className={`mt-2 text-lg font-black ${textClass}`}>{valueLabel(Number(average.toFixed(1)))}</p>
        </div>
        <div className="rounded-[18px] surface-inset p-3">
          <p className="text-[11px] font-black uppercase tracking-normal text-white/34">Peak</p>
          <p className={`mt-2 text-lg font-black ${textClass}`}>{valueLabel(Math.max(...data.map((item) => item.value), 0))}</p>
        </div>
      </div>
      <div className="space-y-2.5 rounded-[22px] surface-inset p-4">
        {data.map((item) => {
          const width = Math.max(4, Math.round((item.value / max) * 100));

          return (
            <div key={item.day} className="grid grid-cols-[64px_1fr_58px] items-center gap-3">
              <p className="text-xs font-black text-white/50">{item.day}</p>
              <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                <div className={`h-full rounded-full ${toneClass}`} style={{ width: `${width}%` }} />
              </div>
              <p className="text-right text-xs font-black text-white/72">{valueLabel(item.value)}</p>
            </div>
          );
        })}
        {data.length === 0 ? <EmptyLine label="Belum ada data trend." /> : null}
      </div>
    </div>
  );
}

function SourceList({ data }: { data: Array<{ source: string; value: number }> }) {
  const max = Math.max(...data.map((item) => item.value), 1);

  return (
    <div className="space-y-3 rounded-[22px] surface-inset p-4">
      {data.map((item) => {
        const width = Math.max(6, Math.round((item.value / max) * 100));

        return (
          <div key={item.source}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-black text-white">{item.source}</p>
              <p className="text-sm font-black text-[#b8fbff]">{item.value}</p>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <div className="h-full rounded-full bg-[#29f1ff] shadow-[0_0_16px_rgba(41,241,255,0.24)]" style={{ width: `${width}%` }} />
            </div>
          </div>
        );
      })}
      {data.length === 0 ? <EmptyLine label="Belum ada booking source." /> : null}
    </div>
  );
}

function formatOneDecimal(value: number) {
  return value.toLocaleString("id-ID", {
    maximumFractionDigits: 1,
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
  });
}

function CardTitle({ title, href }: { title: string; href: string }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-base font-bold text-white">{title}</h2>
      <Link href={href} className="flex items-center gap-1 text-sm font-bold text-[#29f1ff] transition hover:text-[#b8fbff]">
        View all <ArrowRight className="size-4" />
      </Link>
    </div>
  );
}

function QuickActionLink({ label, href, variant, icon }: DashboardData["quickActions"][number]) {
  const Icon = quickActionIconMap[icon];

  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-button)] px-4 text-sm font-bold transition duration-200",
        variant === "primary"
          ? "gold-gradient text-[#041015] shadow-[0_16px_34px_rgba(41,241,255,0.18)] hover:brightness-110"
          : "border border-white/12 bg-white/[0.07] text-white hover:border-[#29f1ff]/42 hover:bg-[#29f1ff]/10",
      )}
    >
      <Icon className="size-5" />
      {label}
    </Link>
  );
}

function EmptyLine({ label }: { label: string }) {
  return (
    <div className="rounded-[var(--radius-input)] border border-dashed border-white/10 bg-white/[0.025] p-5 text-center text-sm font-semibold text-white/36">
      {label}
    </div>
  );
}
