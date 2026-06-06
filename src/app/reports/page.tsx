import Link from "next/link";
import {
  BarChart3,
  CalendarDays,
  Download,
  PieChart,
  ReceiptText,
  TrendingUp,
} from "lucide-react";
import { UserRole } from "@/generated/prisma/enums";
import { AppShell } from "@/components/layout/app-shell";
import { ActionFeedbackBanner } from "@/components/ui/action-feedback-banner";
import { GlassCard } from "@/components/ui/glass-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { getActionFeedback, type ActionFeedback, type ActionFeedbackSearchParams } from "@/lib/action-feedback";
import { formatDateId, formatIdr } from "@/lib/formatters";
import { getReportData, parseReportRange } from "@/lib/reports";
import { requirePagePermission } from "@/lib/action-guard";
import { canViewOperationalFinancialData, canViewStayFinancialData } from "@/lib/permissions";

export const dynamic = "force-dynamic";

type ReportsPageProps = {
  searchParams: Promise<{
    from?: string;
    to?: string;
  } & ActionFeedbackSearchParams>;
};

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const session = await requirePagePermission("report:read");
  const role = session.role as UserRole;
  const canViewStayFinancials = canViewStayFinancialData(role);
  const canViewOperationalFinancials = canViewOperationalFinancialData(role);
  const params = await searchParams;
  const range = parseReportRange(params);
  const feedback = getActionFeedback(params) ?? getReportRangeFeedback(params);
  const report = await getReportData(session.propertyId, range);
  const exportHref = `/reports/export?from=${range.fromInput}&to=${range.toInput}`;
  const maxDailyRevenue = Math.max(1, ...report.dailyRows.map((row) => row.totalRevenue));
  const maxSourceCount = Math.max(1, ...report.bookingSources.map((source) => source.count));

  return (
    <AppShell>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-bold text-[#29f1ff]">Analytics</p>
          <h2 className="mt-2 text-3xl font-black tracking-normal text-white">Reports</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/62">
            {canViewStayFinancials
              ? "Ringkasan okupansi, revenue, source booking, SLA request, housekeeping, dan POS untuk periode operasional."
              : canViewOperationalFinancials
                ? "Ringkasan okupansi, order revenue, SLA request, housekeeping, dan POS untuk periode operasional."
                : "Ringkasan okupansi, source booking, SLA request, housekeeping, dan POS untuk periode operasional."}
          </p>
        </div>
        {canViewStayFinancials ? (
          <Link
            href={exportHref}
            className="gold-gradient inline-flex min-h-11 items-center justify-center gap-2 rounded-[22px] px-4 text-sm font-black text-[#041015]"
          >
            <Download className="size-5" />
            Export CSV
          </Link>
        ) : null}
      </div>

      <ActionFeedbackBanner feedback={feedback} />

      <GlassCard variant="strong" className="mt-6 p-5">
        <form className="grid gap-3 md:grid-cols-[1fr_1fr_auto_auto]">
          <DateField name="from" label="From" defaultValue={range.fromInput} />
          <DateField name="to" label="To" defaultValue={range.toInput} />
          <button className="min-h-12 rounded-[22px] border border-[#29f1ff]/24 bg-[#29f1ff]/10 px-5 text-sm font-black text-[#b8fbff]">
            Apply
          </button>
          <Link
            href="/reports"
            className="inline-flex min-h-12 items-center justify-center rounded-[22px] border border-white/10 px-5 text-sm font-black text-white/70"
          >
            Reset
          </Link>
        </form>
      </GlassCard>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard title="Occupancy" value={`${report.summary.occupancyRate}%`} detail={`${report.summary.occupiedRoomNights} / ${report.summary.roomNightsAvailable} room-nights`} icon={<PieChart className="size-5" />} />
        {canViewStayFinancials ? <MetricCard title="Total Revenue" value={formatIdr(report.summary.totalRevenue)} detail={`Rooms ${formatIdr(report.summary.reservationRevenue)}`} icon={<TrendingUp className="size-5" />} /> : null}
        <MetricCard
          title={canViewOperationalFinancials ? "Order Revenue" : "Recent Orders"}
          value={canViewOperationalFinancials ? formatIdr(report.summary.orderRevenue) : String(report.recentOrders.length)}
          detail={canViewOperationalFinancials ? `${report.recentOrders.length} recent orders` : "POS activity count"}
          icon={<ReceiptText className="size-5" />}
        />
        {canViewStayFinancials ? <MetricCard title="ADR" value={formatIdr(report.summary.adr)} detail={`RevPAR ${formatIdr(report.summary.revPar)}`} icon={<BarChart3 className="size-5" />} /> : null}
        <MetricCard title="SLA Completion" value={`${report.summary.slaCompletionRate}%`} detail={`${report.summary.openRequests} open requests`} icon={<CalendarDays className="size-5" />} />
      </section>

      <section className="mt-6 grid gap-5 2xl:grid-cols-[1.25fr_0.75fr]">
        <GlassCard variant="strong" className="overflow-hidden p-0">
          <div className="border-b border-white/10 p-5">
            <h3 className="text-lg font-black text-white">Daily Performance</h3>
            <p className="mt-1 text-sm font-semibold text-white/50">
              {formatDateId(report.range.from)} - {formatDateId(report.range.to)}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className={`w-full border-separate border-spacing-y-2 p-4 text-left ${canViewStayFinancials ? "min-w-[980px]" : canViewOperationalFinancials ? "min-w-[720px]" : "min-w-[560px]"}`}>
              <thead>
                <tr className="text-xs font-black uppercase tracking-normal text-white/42">
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Occupancy</th>
                  {canViewStayFinancials ? <th className="px-4 py-2">Room Revenue</th> : null}
                  {canViewOperationalFinancials ? <th className="px-4 py-2">Order Revenue</th> : null}
                  {canViewStayFinancials ? <th className="px-4 py-2">Total</th> : null}
                  <th className="px-4 py-2">Requests</th>
                </tr>
              </thead>
              <tbody>
                {report.dailyRows.map((row) => (
                  <tr key={row.label} className="surface-row text-sm font-semibold text-white/76">
                    <td className="rounded-l-[20px] px-4 py-4 font-black text-white">{row.label}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-28 overflow-hidden rounded-full bg-white/10">
                          <div className="h-full rounded-full bg-[#4fb8ff]" style={{ width: `${row.occupancy}%` }} />
                        </div>
                        <span className="font-black text-white">{row.occupancy}%</span>
                      </div>
                    </td>
                    {canViewStayFinancials ? <td className="px-4 py-4">{formatIdr(row.reservationRevenue)}</td> : null}
                    {canViewOperationalFinancials ? <td className="px-4 py-4">{formatIdr(row.orderRevenue)}</td> : null}
                    {canViewStayFinancials ? (
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-2 w-28 overflow-hidden rounded-full bg-white/10">
                            <div className="h-full rounded-full bg-[#a989ff]" style={{ width: `${Math.round((row.totalRevenue / maxDailyRevenue) * 100)}%` }} />
                          </div>
                          <span className="font-black text-white">{formatIdr(row.totalRevenue)}</span>
                        </div>
                      </td>
                    ) : null}
                    <td className="rounded-r-[20px] px-4 py-4">{row.requestsCreated}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>

        <div className="space-y-5">
          <GlassCard className="p-5">
            <h3 className="text-lg font-black text-white">Booking Source</h3>
            <div className="mt-4 space-y-3">
              {report.bookingSources.map((source) => (
                <ProgressRow
                  key={source.key}
                  label={source.label}
                  value={String(source.count)}
                  percent={Math.round((source.count / maxSourceCount) * 100)}
                />
              ))}
            </div>
          </GlassCard>

          <GlassCard className="p-5">
            <h3 className="text-lg font-black text-white">Unit Status</h3>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 2xl:grid-cols-1">
              {report.unitStatus.map((status) => (
                <div key={status.key} className="surface-inset flex items-center justify-between gap-3 rounded-[22px] p-3">
                  <span className="text-sm font-bold text-white/72">{status.label}</span>
                  <StatusBadge label={String(status.count)} tone={status.count > 0 ? "info" : "muted"} />
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-3">
        <ReportPanel title="Service SLA">
          <div className="space-y-3">
            {report.requestStatus.map((status) => (
              <div key={status.key} className="surface-inset flex items-center justify-between gap-3 rounded-[22px] p-3">
                <span className="text-sm font-bold text-white/72">{status.label}</span>
                <span className="font-black text-white">{status.count}</span>
              </div>
            ))}
          </div>
        </ReportPanel>

        <ReportPanel title="Request Mix">
          <div className="space-y-3">
            {report.requestTypes.filter((type) => type.count > 0).map((type) => (
              <div key={type.key} className="surface-inset flex items-center justify-between gap-3 rounded-[22px] p-3">
                <span className="text-sm font-bold text-white/72">{type.label}</span>
                <span className="font-black text-white">{type.count}</span>
              </div>
            ))}
          </div>
        </ReportPanel>

        <ReportPanel title="Housekeeping">
          <div className="space-y-3">
            {report.housekeepingStatus.filter((status) => status.count > 0).map((status) => (
              <div key={status.key} className="surface-inset flex items-center justify-between gap-3 rounded-[22px] p-3">
                <span className="text-sm font-bold text-white/72">{status.label}</span>
                <span className="font-black text-white">{status.count}</span>
              </div>
            ))}
          </div>
        </ReportPanel>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <GlassCard className="p-5">
          <h3 className="text-lg font-black text-white">Top POS Items</h3>
          <div className="mt-4 space-y-3">
            {report.topItems.map((item) => (
              <div key={item.name} className="surface-inset rounded-[22px] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-white">{item.name}</p>
                    <p className="mt-1 text-xs font-semibold text-white/50">{item.quantity} sold</p>
                  </div>
                  <p className="font-black text-[#b8fbff]">{canViewOperationalFinancials ? formatIdr(item.revenue) : `${item.quantity} sold`}</p>
                </div>
              </div>
            ))}
            {report.topItems.length === 0 ? <EmptyLine label="Belum ada POS item pada periode ini." /> : null}
          </div>
        </GlassCard>

        <GlassCard variant="strong" className="overflow-hidden p-0">
          <div className="border-b border-white/10 p-5">
            <h3 className="text-lg font-black text-white">Recent Reservations</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-separate border-spacing-y-2 p-4 text-left">
              <thead>
                <tr className="text-xs font-black uppercase tracking-normal text-white/42">
                  <th className="px-4 py-2">Booking</th>
                  <th className="px-4 py-2">Guest</th>
                  <th className="px-4 py-2">Stay</th>
                  {canViewStayFinancials ? <th className="px-4 py-2">Revenue</th> : null}
                </tr>
              </thead>
              <tbody>
                {report.recentReservations.map((reservation) => (
                  <tr key={reservation.id} className="surface-row text-sm font-semibold text-white/76">
                    <td className="rounded-l-[20px] px-4 py-4 font-mono font-black text-[#b8fbff]">{reservation.bookingCode}</td>
                    <td className="px-4 py-4">
                      <p className="font-black text-white">{reservation.guest.fullName}</p>
                      <p className="mt-1 text-xs text-white/50">{reservation.unit?.code ?? "Unassigned"}</p>
                    </td>
                    <td className={`${canViewStayFinancials ? "px-4 py-4" : "rounded-r-[20px] px-4 py-4"}`}>{formatDateId(reservation.checkInDate)} - {formatDateId(reservation.checkOutDate)}</td>
                    {canViewStayFinancials ? <td className="rounded-r-[20px] px-4 py-4 font-black text-white">{formatIdr(Number(reservation.totalAmount))}</td> : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </section>
    </AppShell>
  );
}

function getReportRangeFeedback(params: { from?: string; to?: string }): ActionFeedback | null {
  const invalidFrom = Boolean(params.from && !isDateInput(params.from));
  const invalidTo = Boolean(params.to && !isDateInput(params.to));

  if (invalidFrom || invalidTo) {
    return {
      status: "error",
      message: "Tanggal laporan tidak valid, sistem memakai rentang aman.",
    };
  }

  if (params.from && params.to && params.from > params.to) {
    return {
      status: "error",
      message: "Range tanggal laporan dibalik otomatis agar tetap bisa dibaca.",
    };
  }

  return null;
}

function isDateInput(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function DateField({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label>
      <span className="mb-2 block text-xs font-black uppercase tracking-normal text-white/42">{label}</span>
      <input
        {...props}
        type="date"
        className="surface-field min-h-12 w-full rounded-[22px] px-4 text-sm font-bold text-white outline-none"
      />
    </label>
  );
}

function MetricCard({ title, value, detail, icon }: { title: string; value: string; detail: string; icon: React.ReactNode }) {
  return (
    <GlassCard variant="compact" className="p-5">
      <div className="grid size-11 place-items-center rounded-[22px] bg-[#29f1ff]/14 text-[#b8fbff]">{icon}</div>
      <p className="mt-4 text-sm font-bold text-white/58">{title}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
      <p className="mt-2 text-xs font-semibold text-white/45">{detail}</p>
    </GlassCard>
  );
}

function ProgressRow({ label, value, percent }: { label: string; value: string; percent: number }) {
  return (
    <div className="surface-inset rounded-[22px] p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-bold text-white/72">{label}</span>
        <span className="font-black text-white">{value}</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-[#29f1ff]" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function ReportPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <GlassCard className="p-5">
      <h3 className="text-lg font-black text-white">{title}</h3>
      <div className="mt-4">{children}</div>
    </GlassCard>
  );
}

function EmptyLine({ label }: { label: string }) {
  return (
    <div className="rounded-[22px] border border-dashed border-white/10 bg-white/[0.025] p-5 text-center text-sm font-semibold text-white/36">
      {label}
    </div>
  );
}
