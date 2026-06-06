import Link from "next/link";
import { CalendarCheck, CreditCard, MessageCircle, Plus, Search } from "lucide-react";
import {
  BookingSource,
  PaymentStatus,
  ReservationStatus,
  UserRole,
} from "@/generated/prisma/enums";
import {
  cancelReservationAction,
} from "@/app/reservations/actions";
import { AppShell } from "@/components/layout/app-shell";
import { ActionFeedbackBanner } from "@/components/ui/action-feedback-banner";
import { GlassCard } from "@/components/ui/glass-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { requirePagePermission } from "@/lib/action-guard";
import { getActionFeedback, type ActionFeedbackSearchParams } from "@/lib/action-feedback";
import { formatDateId, formatIdr } from "@/lib/formatters";
import {
  bookingSourceLabels,
  maskContact,
  paymentStatusLabels,
  paymentStatusTone,
  reservationStatusLabels,
  reservationStatusTone,
} from "@/lib/labels";
import { getPrisma } from "@/lib/prisma";
import { isBookingSource, isPaymentStatus } from "@/lib/reservations";
import {
  canViewGuestContactData,
  canViewStayFinancialData,
  hasPermission,
} from "@/lib/permissions";

export const dynamic = "force-dynamic";

type ReservationsPageProps = {
  searchParams: Promise<{
    q?: string;
    status?: string;
    payment?: string;
    source?: string;
  } & ActionFeedbackSearchParams>;
};

export default async function ReservationsPage({ searchParams }: ReservationsPageProps) {
  const session = await requirePagePermission("reservation:read");
  const role = session.role as UserRole;
  const canWrite = hasPermission(role, "reservation:write");
  const canManageCheckIn = hasPermission(role, "checkin:write");
  const canViewFinancials = canViewStayFinancialData(role);
  const canViewGuestContact = canViewGuestContactData(role);
  const params = await searchParams;
  const feedback = getActionFeedback(params);
  const query = params.q?.trim();
  const status = Object.values(ReservationStatus).includes(params.status as ReservationStatus)
    ? (params.status as ReservationStatus)
    : undefined;
  const payment = canViewFinancials && params.payment && isPaymentStatus(params.payment) ? params.payment : undefined;
  const source = params.source && isBookingSource(params.source) ? params.source : undefined;
  const prisma = getPrisma();

  const reservations = await prisma.reservation.findMany({
    where: {
      unit: { propertyId: session.propertyId },
      status,
      paymentStatus: payment,
      source,
      OR: query
        ? [
            { bookingCode: { contains: query, mode: "insensitive" } },
            { guest: { fullName: { contains: query, mode: "insensitive" } } },
            ...(canViewGuestContact ? [{ guest: { phone: { contains: query, mode: "insensitive" as const } } }] : []),
            { unit: { code: { contains: query, mode: "insensitive" } } },
          ]
        : undefined,
    },
    include: {
      guest: true,
      unit: { include: { unitType: true } },
      orders: true,
      serviceRequests: true,
    },
    orderBy: { checkInDate: "desc" },
    take: 80,
  });

  const summary = {
    total: reservations.length,
    inHouse: reservations.filter((reservation) => reservation.status === ReservationStatus.CHECKED_IN).length,
    pendingPayment: reservations.filter((reservation) => reservation.paymentStatus !== PaymentStatus.PAID).length,
    revenue: reservations.reduce((sum, reservation) => sum + Number(reservation.totalAmount), 0),
    upcoming: reservations.filter((reservation) => reservation.status === ReservationStatus.PENDING || reservation.status === ReservationStatus.CONFIRMED).length,
    openRequests: reservations.reduce((sum, reservation) => sum + reservation.serviceRequests.length, 0),
  };
  const featuredReservation = reservations[0];

  return (
    <AppShell>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-bold text-[#29f1ff]">Operations</p>
          <h2 className="mt-2 text-3xl font-black tracking-normal text-white">Reservasi</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/62">
            {canViewFinancials
              ? "Kelola booking, status pembayaran, jadwal kedatangan, dan detail tamu dari satu sumber data."
              : "Kelola booking, jadwal kedatangan, unit, dan detail operasional tamu dari satu board."}
          </p>
        </div>
        {canWrite ? (
          <Link
            href="/reservations/new"
            className="gold-gradient inline-flex min-h-11 items-center justify-center gap-2 rounded-[22px] px-4 text-sm font-black text-[#041015]"
          >
            <Plus className="size-5" />
            Buat Reservasi
          </Link>
        ) : null}
      </div>

      <ActionFeedbackBanner feedback={feedback} />

      <section className="mt-6 grid gap-4 md:grid-cols-4">
        <MetricCard title="Total Booking" value={String(summary.total)} icon={<CalendarCheck className="size-5" />} />
        <MetricCard title="In-house Guests" value={String(summary.inHouse)} icon={<MessageCircle className="size-5" />} />
        {canViewFinancials ? (
          <>
            <MetricCard title="Pending Payment" value={String(summary.pendingPayment)} icon={<CreditCard className="size-5" />} />
            <MetricCard title="Revenue Envelope" value={formatIdr(summary.revenue)} icon={<CreditCard className="size-5" />} />
          </>
        ) : (
          <>
            <MetricCard title="Upcoming" value={String(summary.upcoming)} icon={<CalendarCheck className="size-5" />} />
            <MetricCard title="Linked Requests" value={String(summary.openRequests)} icon={<MessageCircle className="size-5" />} />
          </>
        )}
      </section>

      <section className="mt-6 grid gap-5 2xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <GlassCard className="p-5">
            <form className="grid gap-3 xl:grid-cols-[1fr_170px_170px_170px_auto_auto]">
              <label className="flex min-h-12 items-center gap-3 rounded-full border border-white/12 bg-black/18 px-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                <Search className="size-5 text-[#29f1ff]" />
                <input
                  name="q"
                  defaultValue={query}
                  placeholder={canViewGuestContact ? "Search booking, guest, phone, unit..." : "Search booking, guest, unit..."}
                  className="w-full bg-transparent text-sm font-semibold text-white outline-none placeholder:text-white/36"
                />
              </label>
              <SelectFilter name="status" value={status} options={ReservationStatus} labels={reservationStatusLabels} emptyLabel="All Status" />
              {canViewFinancials ? <SelectFilter name="payment" value={payment} options={PaymentStatus} labels={paymentStatusLabels} emptyLabel="All Payment" /> : null}
              <SelectFilter name="source" value={source} options={BookingSource} labels={bookingSourceLabels} emptyLabel="All Sources" />
              <button className="min-h-12 rounded-[18px] border border-[#29f1ff]/24 bg-[#29f1ff]/10 px-5 text-sm font-black text-[#b8fbff]">
                Filter
              </button>
              <Link className="inline-flex min-h-12 items-center justify-center rounded-[18px] border border-white/10 px-5 text-sm font-black text-white/70" href="/reservations">
                Reset
              </Link>
            </form>

            <div className="mt-5 overflow-x-auto">
              <table className={`w-full border-separate border-spacing-y-2 text-left ${canViewFinancials ? "min-w-[1120px]" : "min-w-[940px]"}`}>
                <thead>
                  <tr className="text-xs font-black uppercase tracking-normal text-white/38">
                    <th className="px-4 py-2">Booking</th>
                    <th className="px-4 py-2">Guest</th>
                    <th className="px-4 py-2">Unit</th>
                    <th className="px-4 py-2">Stay Dates</th>
                    <th className="px-4 py-2">Status</th>
                    {canViewFinancials ? <th className="px-4 py-2">Payment</th> : null}
                    <th className="px-4 py-2">Source</th>
                    {canViewFinancials ? <th className="px-4 py-2">Total</th> : null}
                    <th className="px-4 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reservations.map((reservation) => {
                    const cancelAction = cancelReservationAction.bind(null, reservation.id);
                    const canCheckIn =
                      canManageCheckIn &&
                      reservation.unitId &&
                      (reservation.status === ReservationStatus.PENDING || reservation.status === ReservationStatus.CONFIRMED);
                    const canCheckOut = canManageCheckIn && reservation.status === ReservationStatus.CHECKED_IN;
                    const canEdit =
                      canWrite &&
                      (reservation.status === ReservationStatus.PENDING || reservation.status === ReservationStatus.CONFIRMED);
                    const canCancel =
                      canWrite &&
                      (reservation.status === ReservationStatus.PENDING || reservation.status === ReservationStatus.CONFIRMED);

                    return (
                      <tr key={reservation.id} className="surface-row text-sm font-semibold text-white/76 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                        <td className="rounded-l-[20px] px-4 py-4">
                          <Link href={`/reservations/${reservation.id}`} className="font-mono text-sm font-black text-[#b8fbff]">
                            {reservation.bookingCode}
                          </Link>
                          <p className="mt-1 text-xs text-white/45">{reservation.serviceRequests.length} requests · {reservation.orders.length} orders</p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-black text-white">{reservation.guest.fullName}</p>
                          <p className="mt-1 text-xs text-white/50">{canViewGuestContact ? reservation.guest.phone ?? "-" : maskContact(reservation.guest.phone)}</p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-bold text-white">{reservation.unit?.code ?? "Unassigned"}</p>
                          <p className="mt-1 text-xs text-white/50">{reservation.unit?.unitType.name ?? "-"}</p>
                        </td>
                        <td className="px-4 py-4">
                          <p>{formatDateId(reservation.checkInDate)}</p>
                          <p className="mt-1 text-xs text-white/50">to {formatDateId(reservation.checkOutDate)}</p>
                        </td>
                        <td className="px-4 py-4">
                          <StatusBadge label={reservationStatusLabels[reservation.status]} tone={reservationStatusTone[reservation.status]} />
                        </td>
                        {canViewFinancials ? (
                          <td className="px-4 py-4">
                            <StatusBadge label={paymentStatusLabels[reservation.paymentStatus]} tone={paymentStatusTone[reservation.paymentStatus]} />
                          </td>
                        ) : null}
                        <td className="px-4 py-4">{bookingSourceLabels[reservation.source]}</td>
                        {canViewFinancials ? <td className="px-4 py-4 font-black text-white">{formatIdr(Number(reservation.totalAmount))}</td> : null}
                        <td className="rounded-r-[20px] px-4 py-4">
                          <div className="flex flex-wrap gap-2">
                            <Link
                              className="rounded-[16px] border border-white/10 px-3 py-2 text-xs font-black text-white/78"
                              href={`/reservations/${reservation.id}`}
                            >
                              Detail
                            </Link>
                            {canCheckIn ? (
                              <Link
                                href={`/check-in/${reservation.id}`}
                                className="rounded-[16px] border border-[#29f1ff]/24 bg-[#29f1ff]/10 px-3 py-2 text-xs font-black text-[#b8fbff]"
                              >
                                Check-in
                              </Link>
                            ) : null}
                            {canCheckOut ? (
                              <Link
                                href={`/check-out/${reservation.id}`}
                                className="rounded-[16px] border border-sky-300/20 bg-sky-500/10 px-3 py-2 text-xs font-black text-sky-100"
                              >
                                Check-out
                              </Link>
                            ) : null}
                            {canEdit ? (
                              <Link className="rounded-[16px] border border-white/10 px-3 py-2 text-xs font-black text-white/78" href={`/reservations/${reservation.id}/edit`}>
                                Edit
                              </Link>
                            ) : null}
                            {canCancel ? (
                              <form action={cancelAction}>
                                <button className="rounded-[16px] border border-red-300/20 bg-red-500/10 px-3 py-2 text-xs font-black text-red-100">
                                  Cancel
                                </button>
                              </form>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {reservations.length === 0 ? (
                <div className="rounded-[22px] surface-inset p-8 text-center text-sm font-semibold text-white/58">
                  Tidak ada reservasi yang cocok dengan filter.
                </div>
              ) : null}
            </div>
          </GlassCard>

          <GlassCard className="p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-white">Reservation Timeline</h3>
              <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-black text-white/58">
                Next stays
              </span>
            </div>
            <div className="mt-5 grid gap-3 lg:grid-cols-6">
              {reservations.slice(0, 6).map((reservation) => (
                <div key={reservation.id} className="rounded-[20px] border border-[#29f1ff]/14 bg-[#29f1ff]/[0.055] p-3">
                  <p className="truncate text-xs font-black text-[#b8fbff]">{reservation.unit?.code ?? "Open"}</p>
                  <p className="mt-2 truncate text-sm font-bold text-white">{reservation.guest.fullName}</p>
                  <p className="mt-1 text-[11px] font-semibold text-white/46">{formatDateId(reservation.checkInDate)}</p>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>

        <aside className="space-y-5">
          <GlassCard className="p-5">
            {featuredReservation ? (
              <>
                <div className="mx-auto grid size-20 place-items-center rounded-full border border-[#29f1ff]/30 bg-[#29f1ff]/12 text-2xl font-black text-[#b8fbff] shadow-[0_0_36px_rgba(41,241,255,0.18)]">
                  {featuredReservation.guest.fullName.slice(0, 1)}
                </div>
                <div className="mt-4 text-center">
                  <h3 className="text-xl font-black text-white">{featuredReservation.guest.fullName}</h3>
                  <p className="mt-1 text-sm font-semibold text-white/52">{canViewGuestContact ? featuredReservation.guest.email ?? "No email" : maskContact(featuredReservation.guest.email)}</p>
                  <p className="mt-1 text-sm font-semibold text-white/52">{canViewGuestContact ? featuredReservation.guest.phone ?? "-" : maskContact(featuredReservation.guest.phone)}</p>
                </div>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <StatusBadge label={reservationStatusLabels[featuredReservation.status]} tone={reservationStatusTone[featuredReservation.status]} dot />
                  {canViewFinancials ? <StatusBadge label={paymentStatusLabels[featuredReservation.paymentStatus]} tone={paymentStatusTone[featuredReservation.paymentStatus]} /> : null}
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/10 pt-5">
                  <MiniProfileStat label="Unit" value={featuredReservation.unit?.code ?? "Open"} />
                  <MiniProfileStat label="Source" value={bookingSourceLabels[featuredReservation.source]} />
                  <MiniProfileStat label="Check-in" value={formatDateId(featuredReservation.checkInDate)} />
                  <MiniProfileStat
                    label={canViewFinancials ? "Spend" : "Requests"}
                    value={canViewFinancials ? formatIdr(Number(featuredReservation.totalAmount)) : String(featuredReservation.serviceRequests.length)}
                  />
                </div>
              </>
            ) : (
              <p className="text-sm font-semibold text-white/54">Tidak ada tamu terpilih.</p>
            )}
          </GlassCard>
        </aside>
      </section>
    </AppShell>
  );
}

function MetricCard({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return (
    <GlassCard className="p-5">
      <div className="grid size-11 place-items-center rounded-[22px] bg-[#29f1ff]/14 text-[#b8fbff]">{icon}</div>
      <p className="mt-4 text-sm font-bold text-white/60">{title}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </GlassCard>
  );
}

function MiniProfileStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] surface-inset p-3">
      <p className="text-[11px] font-black uppercase tracking-normal text-white/34">{label}</p>
      <p className="mt-2 truncate text-sm font-black text-white">{value}</p>
    </div>
  );
}

function SelectFilter<T extends string>({
  name,
  value,
  options,
  labels,
  emptyLabel,
}: {
  name: string;
  value?: T;
  options: Record<string, T>;
  labels: Record<T, string>;
  emptyLabel: string;
}) {
  return (
    <select
      name={name}
      defaultValue={value ?? ""}
      className="min-h-12 rounded-[22px] surface-field px-4 text-sm font-bold text-white outline-none"
    >
      <option value="">{emptyLabel}</option>
      {Object.values(options).map((option) => (
        <option key={option} value={option}>
          {labels[option]}
        </option>
      ))}
    </select>
  );
}
