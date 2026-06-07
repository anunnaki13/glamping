import Link from "next/link";
import { addDays, subDays } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, Lock, MoveRight, Plus, UnlockKeyhole } from "lucide-react";
import { ReservationStatus, UnitBlockType, UserRole } from "@/generated/prisma/enums";
import {
  createUnitBlockFromCalendarAction,
  releaseUnitBlockFromCalendarAction,
  rescheduleReservationFromCalendarAction,
} from "@/app/calendar/actions";
import { AppShell } from "@/components/layout/app-shell";
import { ActionFeedbackBanner } from "@/components/ui/action-feedback-banner";
import { GlassCard } from "@/components/ui/glass-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { getActionFeedback, type ActionFeedback, type ActionFeedbackSearchParams } from "@/lib/action-feedback";
import { formatDateId, formatIdr } from "@/lib/formatters";
import {
  reservationStatusLabels,
  unitBlockTypeLabels,
  unitBlockTypeTone,
  unitStatusLabels,
  unitStatusTone,
} from "@/lib/labels";
import { getPrisma } from "@/lib/prisma";
import { activeReservationStatuses, formatDateInput } from "@/lib/reservations";
import { requirePagePermission } from "@/lib/action-guard";
import { cn } from "@/lib/utils";
import { canViewStayFinancialData, hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

type CalendarPageProps = {
  searchParams: Promise<{
    start?: string;
  } & ActionFeedbackSearchParams>;
};

type CalendarReservation = {
  id: string;
  bookingCode: string;
  checkInDate: Date;
  checkOutDate: Date;
  status: ReservationStatus;
  totalAmount: unknown;
  guest: {
    fullName: string;
  };
};

type CalendarUnitBlock = {
  id: string;
  startDate: Date;
  endDate: Date;
  type: UnitBlockType;
  reason: string;
  notes: string | null;
  createdBy: string | null;
};

type CalendarUnitOption = {
  id: string;
  code: string;
};

const visibleDays = 14;
const gridTemplateColumns = "176px repeat(14, minmax(116px, 1fr))";
const calendarBlockTypeOptions = [
  UnitBlockType.MAINTENANCE,
  UnitBlockType.PRIVATE_HOLD,
  UnitBlockType.OUT_OF_SERVICE,
  UnitBlockType.OWNER_STAY,
] as const;

const reservationCellTone: Record<ReservationStatus, string> = {
  PENDING: "border-amber-300/22 bg-amber-400/13 text-amber-50",
  CONFIRMED: "border-emerald-300/22 bg-emerald-400/13 text-emerald-50",
  CHECKED_IN: "border-sky-300/22 bg-sky-400/13 text-sky-50",
  CHECKED_OUT: "border-white/10 bg-white/[0.045] text-white/64",
  CANCELLED: "border-red-300/22 bg-red-400/10 text-red-100",
  NO_SHOW: "border-red-300/22 bg-red-400/10 text-red-100",
};

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const session = await requirePagePermission("reservation:read");
  const role = session.role as UserRole;
  const canWrite = hasPermission(role, "reservation:write");
  const canBlock = hasPermission(role, "unit:write");
  const canViewFinancials = canViewStayFinancialData(role);
  const params = await searchParams;
  const feedback = getActionFeedback(params) ?? getCalendarStartFeedback(params.start);
  const rangeStart = parseCalendarStart(params.start);
  const rangeEnd = addDays(rangeStart, visibleDays);
  const days = Array.from({ length: visibleDays }, (_, index) => addDays(rangeStart, index));
  const dayKeys = new Set(days.map((day) => formatDateInput(day)));
  const prisma = getPrisma();

  const units = await prisma.unit.findMany({
    where: { propertyId: session.propertyId },
    include: {
      unitType: true,
      reservations: {
        where: {
          status: { in: [...activeReservationStatuses] },
          checkInDate: { lt: rangeEnd },
          checkOutDate: { gt: rangeStart },
        },
        include: { guest: true },
        orderBy: { checkInDate: "asc" },
      },
      unitBlocks: {
        where: {
          startDate: { lt: rangeEnd },
          endDate: { gt: rangeStart },
        },
        orderBy: { startDate: "asc" },
      },
    },
    orderBy: { code: "asc" },
  });

  const reservations = units.flatMap((unit) => unit.reservations);
  const unitOptions = units.map((unit) => ({ id: unit.id, code: unit.code }));
  const occupiedCells = units.reduce(
    (sum, unit) =>
      sum +
      days.filter((day) =>
        unit.reservations.some((reservation) =>
          coversDate(reservation, formatDateInput(day)),
        ),
      ).length,
    0,
  );
  const blockedCells = units.reduce(
    (sum, unit) =>
      sum +
      days.filter((day) =>
        unit.unitBlocks.some((block) =>
          coversBlockDate(block, formatDateInput(day)),
        ),
      ).length,
    0,
  );
  const calendarBlocks = units.flatMap((unit) => unit.unitBlocks);
  const arrivals = reservations.filter((reservation) =>
    dayKeys.has(formatDateInput(reservation.checkInDate)),
  ).length;
  const departures = reservations.filter((reservation) =>
    dayKeys.has(formatDateInput(reservation.checkOutDate)),
  ).length;
  const revenueOnBoard = reservations.reduce(
    (sum, reservation) => sum + Number(reservation.totalAmount),
    0,
  );
  const availableCells = Math.max(0, units.length * days.length - occupiedCells - blockedCells);

  return (
    <AppShell>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-bold text-[#29f1ff]">Operations</p>
          <h2 className="mt-2 text-3xl font-black tracking-normal text-white">Calendar</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/62">
            Board okupansi unit, arrival, departure, dan blocking aktif untuk ritme operasional harian.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/calendar?start=${formatDateInput(subDays(rangeStart, visibleDays))}`}
            className="surface-chip inline-flex min-h-11 items-center justify-center gap-2 rounded-[22px] px-4 text-sm font-black text-white/76 transition hover:border-[#29f1ff]/30 hover:text-white"
          >
            <ChevronLeft className="size-4" />
            Prev
          </Link>
          <Link
            href={`/calendar?start=${formatDateInput(new Date())}`}
            className="inline-flex min-h-11 items-center justify-center rounded-[22px] border border-[#29f1ff]/24 bg-[#29f1ff]/10 px-4 text-sm font-black text-[#b8fbff]"
          >
            Today
          </Link>
          <Link
            href={`/calendar?start=${formatDateInput(addDays(rangeStart, visibleDays))}`}
            className="surface-chip inline-flex min-h-11 items-center justify-center gap-2 rounded-[22px] px-4 text-sm font-black text-white/76 transition hover:border-[#29f1ff]/30 hover:text-white"
          >
            Next
            <ChevronRight className="size-4" />
          </Link>
          {canWrite ? (
            <Link
              href={`/reservations/new?checkIn=${formatDateInput(rangeStart)}&checkOut=${formatDateInput(addDays(rangeStart, 1))}`}
              className="gold-gradient inline-flex min-h-11 items-center justify-center gap-2 rounded-[22px] px-4 text-sm font-black text-[#041015]"
            >
              <Plus className="size-5" />
              Reservasi
            </Link>
          ) : null}
        </div>
      </div>

      <ActionFeedbackBanner feedback={feedback} />

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Active Bookings" value={String(reservations.length)} />
        <MetricCard title="Arrivals" value={String(arrivals)} />
        <MetricCard title="Departures" value={String(departures)} />
        <MetricCard
          title={canViewFinancials ? "Board Revenue" : "Open Room-Nights"}
          value={canViewFinancials ? formatIdr(revenueOnBoard) : String(availableCells)}
        />
      </section>

      <GlassCard variant="strong" className="mt-6 overflow-hidden p-0">
        <div className="flex flex-col gap-3 border-b border-white/10 p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-[22px] bg-[#29f1ff]/14 text-[#b8fbff]">
                <CalendarDays className="size-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">
                  {formatDateId(rangeStart)} - {formatDateId(addDays(rangeEnd, -1))}
                </h3>
                <p className="mt-1 text-xs font-semibold text-white/52">
                  {units.length} units · {availableCells} open room-nights · {blockedCells} blocked
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {activeReservationStatuses.map((status) => (
              <StatusBadge
                key={status}
                label={reservationStatusLabels[status]}
                tone={status === ReservationStatus.PENDING ? "warning" : status === ReservationStatus.CONFIRMED ? "success" : "info"}
                dot
              />
            ))}
            {calendarBlocks.length > 0 ? (
              <StatusBadge label={`${calendarBlocks.length} blocks`} tone="warning" dot />
            ) : null}
          </div>
        </div>

        <div className="premium-scroll overflow-x-auto">
          <div className="min-w-[1800px]">
            <div
              className="grid border-b border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.065),rgba(255,255,255,0.018))]"
              style={{ gridTemplateColumns }}
            >
              <div className="sticky left-0 z-20 border-r border-white/10 bg-[rgba(8,13,22,0.96)] px-4 py-3 text-xs font-black uppercase tracking-normal text-white/44 backdrop-blur-2xl">
                Unit
              </div>
              {days.map((day) => {
                const dateKey = formatDateInput(day);
                const isToday = dateKey === formatDateInput(new Date());

                return (
                  <div
                    key={dateKey}
                    className={cn(
                      "border-r border-white/10 px-3 py-3 text-center",
                      isToday ? "bg-[#29f1ff]/10" : "bg-white/[0.018]",
                    )}
                  >
                    <p className="text-[11px] font-black uppercase tracking-normal text-white/42">
                      {formatWeekday(day)}
                    </p>
                    <p className={cn("mt-1 text-sm font-black", isToday ? "text-[#b8fbff]" : "text-white")}>
                      {formatShortDate(day)}
                    </p>
                  </div>
                );
              })}
            </div>

            {units.map((unit) => (
              <div
                key={unit.id}
                className="grid border-b border-white/[0.075] last:border-b-0"
                style={{ gridTemplateColumns }}
              >
                <div className="sticky left-0 z-10 border-r border-white/10 bg-[rgba(8,13,22,0.94)] p-4 shadow-[10px_0_28px_rgba(0,0,0,0.18)] backdrop-blur-2xl">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-black text-white">{unit.code}</p>
                      <p className="mt-1 truncate text-xs font-semibold text-white/52">{unit.unitType.name}</p>
                    </div>
                    <StatusBadge
                      label={unitStatusLabels[unit.status]}
                      tone={unitStatusTone[unit.status]}
                      className="shrink-0"
                      dot
                    />
                  </div>
                  <p className="mt-3 text-xs font-semibold text-[#b8fbff]">
                    {canViewFinancials ? formatIdr(Number(unit.unitType.baseRate)) : `${unit.unitType.capacity} guests`}
                  </p>
                </div>

                {days.map((day) => {
                  const dateKey = formatDateInput(day);
                  const reservation = unit.reservations.find((item) => coversDate(item, dateKey));
                  const departure = unit.reservations.find(
                    (item) => formatDateInput(item.checkOutDate) === dateKey,
                  );
                  const block = unit.unitBlocks.find((item) => coversBlockDate(item, dateKey));

                  return (
                    <CalendarCell
                      key={`${unit.id}-${dateKey}`}
                      dateKey={dateKey}
                      unitId={unit.id}
                      unitCode={unit.code}
                      calendarStartKey={formatDateInput(rangeStart)}
                      reservation={reservation}
                      departure={departure}
                      block={block}
                      units={unitOptions}
                      canWrite={canWrite}
                      canBlock={canBlock}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </GlassCard>
    </AppShell>
  );
}

function CalendarCell({
  dateKey,
  unitId,
  unitCode,
  calendarStartKey,
  reservation,
  departure,
  block,
  units,
  canWrite,
  canBlock,
}: {
  dateKey: string;
  unitId: string;
  unitCode: string;
  calendarStartKey: string;
  reservation?: CalendarReservation;
  departure?: CalendarReservation;
  block?: CalendarUnitBlock;
  units: CalendarUnitOption[];
  canWrite: boolean;
  canBlock: boolean;
}) {
  const todayKey = formatDateInput(new Date());
  const nextDateKey = addDateInputDays(dateKey, 1);
  const cellTestId = `calendar-cell-${unitCode}-${dateKey}`;

  if (reservation) {
    const isArrival = formatDateInput(reservation.checkInDate) === dateKey;
    const canMoveReservation = canWrite && (reservation.status === ReservationStatus.PENDING || reservation.status === ReservationStatus.CONFIRMED);

    return (
      <div data-testid={cellTestId} className={cn("min-h-[104px] border-r border-white/[0.075] p-2", dateKey === todayKey ? "bg-[#29f1ff]/8" : "bg-white/[0.012]")}>
        <div
          className={cn(
            "min-h-[88px] rounded-[18px] border p-2.5 shadow-[0_14px_28px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.08)]",
            reservationCellTone[reservation.status],
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <Link href={`/reservations/${reservation.id}`} className="min-w-0 transition hover:text-white">
              <span className="block truncate font-mono text-[11px] font-black">{reservation.bookingCode}</span>
              <p className="mt-2 truncate text-xs font-black">{reservation.guest.fullName}</p>
              <p className="mt-1 truncate text-[11px] font-semibold opacity-72">
                {reservationStatusLabels[reservation.status]}
              </p>
            </Link>
            {isArrival ? (
              <span className="shrink-0 rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[10px] font-black">
                IN
              </span>
            ) : null}
          </div>
          {canMoveReservation ? (
            <details className="mt-2">
              <summary className="flex cursor-pointer list-none items-center gap-1 rounded-[14px] border border-white/12 bg-black/16 px-2 py-1 text-[10px] font-black uppercase tracking-normal text-white/76">
                <MoveRight className="size-3" />
                Move
              </summary>
              <form action={rescheduleReservationFromCalendarAction} className="mt-2 space-y-2">
                <input type="hidden" name="reservationId" value={reservation.id} />
                <input type="hidden" name="calendarStart" value={calendarStartKey} />
                <select
                  name="unitId"
                  defaultValue={unitId}
                  aria-label={`Move ${reservation.bookingCode} unit`}
                  className="h-8 w-full rounded-[14px] border border-white/10 bg-black/24 px-2 text-[11px] font-bold text-white outline-none"
                >
                  {units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.code}
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-1">
                  <input
                    type="date"
                    name="checkInDate"
                    defaultValue={formatDateInput(reservation.checkInDate)}
                    aria-label={`Move ${reservation.bookingCode} check-in`}
                    className="h-8 min-w-0 rounded-[14px] border border-white/10 bg-black/24 px-1.5 text-[10px] font-bold text-white outline-none"
                  />
                  <input
                    type="date"
                    name="checkOutDate"
                    defaultValue={formatDateInput(reservation.checkOutDate)}
                    aria-label={`Move ${reservation.bookingCode} check-out`}
                    className="h-8 min-w-0 rounded-[14px] border border-white/10 bg-black/24 px-1.5 text-[10px] font-bold text-white outline-none"
                  />
                </div>
                <button className="h-8 w-full rounded-[14px] bg-white/16 text-[10px] font-black uppercase tracking-normal text-white">
                  Save Move
                </button>
              </form>
            </details>
          ) : null}
        </div>
      </div>
    );
  }

  if (departure) {
    return (
      <div data-testid={cellTestId} className={cn("min-h-[104px] border-r border-white/[0.075] p-2", dateKey === todayKey ? "bg-[#29f1ff]/8" : "bg-white/[0.012]")}>
        <Link
          href={`/reservations/${departure.id}`}
          className="surface-inset block min-h-[88px] rounded-[18px] p-2.5 text-white/58 transition hover:border-[#29f1ff]/32"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-mono text-[11px] font-black">{departure.bookingCode}</span>
            <span className="surface-chip rounded-full px-2 py-0.5 text-[10px] font-black">
              OUT
            </span>
          </div>
          <p className="mt-2 truncate text-xs font-black text-white/72">{departure.guest.fullName}</p>
          <p className="mt-1 text-[11px] font-semibold text-white/44">Checkout day</p>
        </Link>
      </div>
    );
  }

  if (block) {
    return (
      <div data-testid={cellTestId} className={cn("min-h-[104px] border-r border-white/[0.075] p-2", dateKey === todayKey ? "bg-[#29f1ff]/8" : "bg-white/[0.012]")}>
        <div className="min-h-[88px] rounded-[18px] border border-amber-300/24 bg-amber-400/12 p-2.5 text-amber-50 shadow-[0_14px_28px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.08)]">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <Lock className="size-3 shrink-0" />
                <p className="truncate text-[11px] font-black">{unitBlockTypeLabels[block.type]}</p>
              </div>
              <p className="mt-2 truncate text-xs font-black">{block.reason}</p>
              <p className="mt-1 truncate text-[11px] font-semibold opacity-72">{block.createdBy ?? "Calendar block"}</p>
            </div>
            <StatusBadge label="Block" tone={unitBlockTypeTone[block.type]} className="shrink-0" />
          </div>
          {canBlock ? (
            <form action={releaseUnitBlockFromCalendarAction} className="mt-2">
              <input type="hidden" name="blockId" value={block.id} />
              <input type="hidden" name="calendarStart" value={calendarStartKey} />
              <button className="inline-flex h-8 w-full items-center justify-center gap-1 rounded-[14px] border border-white/12 bg-black/16 text-[10px] font-black uppercase tracking-normal text-white/82">
                <UnlockKeyhole className="size-3" />
                Release
              </button>
            </form>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div data-testid={cellTestId} className={cn("min-h-[104px] border-r border-white/[0.075] p-2", dateKey === todayKey ? "bg-[#29f1ff]/8" : "bg-white/[0.012]")}>
      <div className="min-h-[88px] rounded-[18px] border border-white/[0.04] bg-white/[0.012] p-2">
        <div className="flex flex-wrap gap-1">
          {canWrite ? (
            <Link
              href={`/reservations/new?checkIn=${dateKey}&checkOut=${nextDateKey}&unitId=${unitId}`}
              className="inline-flex h-7 items-center justify-center rounded-[13px] border border-[#29f1ff]/20 bg-[#29f1ff]/8 px-2 text-[10px] font-black uppercase tracking-normal text-[#b8fbff]"
            >
              Book
            </Link>
          ) : null}
          {canBlock ? (
            <details className="min-w-0">
              <summary className="inline-flex h-7 cursor-pointer list-none items-center gap-1 rounded-[13px] border border-amber-300/20 bg-amber-400/10 px-2 text-[10px] font-black uppercase tracking-normal text-amber-100">
                <Lock className="size-3" />
                Block
              </summary>
              <form action={createUnitBlockFromCalendarAction} className="mt-2 w-full space-y-1.5 rounded-[18px] border border-white/10 bg-[#07101d] p-2 shadow-2xl">
                <input type="hidden" name="unitId" value={unitId} />
                <input type="hidden" name="calendarStart" value={calendarStartKey} />
                <input type="hidden" name="startDate" value={dateKey} />
                <div className="grid gap-1">
                  <select
                    name="type"
                    defaultValue={UnitBlockType.MAINTENANCE}
                    aria-label={`Block type ${dateKey}`}
                    className="h-7 min-w-0 rounded-[14px] border border-white/10 bg-black/24 px-1.5 text-[10px] font-bold text-white outline-none"
                  >
                    {calendarBlockTypeOptions.map((type) => (
                      <option key={type} value={type}>
                        {unitBlockTypeLabels[type]}
                      </option>
                    ))}
                  </select>
                  <input
                    type="date"
                    name="endDate"
                    defaultValue={nextDateKey}
                    aria-label={`Block end ${dateKey}`}
                    className="h-7 min-w-0 rounded-[14px] border border-white/10 bg-black/24 px-1.5 text-[10px] font-bold text-white outline-none"
                  />
                </div>
                <input
                  name="reason"
                  placeholder="Reason"
                  aria-label={`Block reason ${dateKey}`}
                  className="h-7 w-full rounded-[14px] border border-white/10 bg-black/24 px-2 text-[11px] font-bold text-white outline-none placeholder:text-white/32"
                />
                <input
                  name="notes"
                  placeholder="Notes"
                  aria-label={`Block notes ${dateKey}`}
                  className="h-7 w-full rounded-[14px] border border-white/10 bg-black/24 px-2 text-[11px] font-bold text-white outline-none placeholder:text-white/32"
                />
                <button className="h-7 w-full rounded-[14px] bg-amber-300/18 text-[10px] font-black uppercase tracking-normal text-amber-50">
                  Save Block
                </button>
              </form>
            </details>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <GlassCard variant="compact" className="p-5">
      <p className="text-sm font-bold text-white/58">{title}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </GlassCard>
  );
}

function coversDate(reservation: CalendarReservation, dateKey: string) {
  const checkInKey = formatDateInput(reservation.checkInDate);
  const checkOutKey = formatDateInput(reservation.checkOutDate);

  return checkInKey <= dateKey && checkOutKey > dateKey;
}

function coversBlockDate(block: CalendarUnitBlock, dateKey: string) {
  const startKey = formatDateInput(block.startDate);
  const endKey = formatDateInput(block.endDate);

  return startKey <= dateKey && endKey > dateKey;
}

function addDateInputDays(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return formatDateInput(new Date(year, month - 1, day + days));
}

function parseCalendarStart(value?: string) {
  const todayKey = formatDateInput(new Date());

  if (!isCalendarStartInput(value)) {
    return parseDateInput(todayKey);
  }

  return parseDateInput(value);
}

function getCalendarStartFeedback(value?: string): ActionFeedback | null {
  if (!value || isCalendarStartInput(value)) {
    return null;
  }

  return {
    status: "error",
    message: "Tanggal awal calendar tidak valid, board dikembalikan ke hari ini.",
  };
}

function isCalendarStartInput(value?: string): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = parseDateInput(value);
  return !Number.isNaN(parsed.getTime()) && formatDateInput(parsed) === value;
}

function parseDateInput(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatWeekday(date: Date) {
  return new Intl.DateTimeFormat("id-ID", { weekday: "short" }).format(date);
}

function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short" }).format(date);
}
