import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Edit, LogIn, LogOut, MessageCircle, UserRound } from "lucide-react";
import { ReservationStatus, UserRole } from "@/generated/prisma/enums";
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
  orderStatusLabels,
  orderStatusTone,
  paymentStatusLabels,
  paymentStatusTone,
  priorityLabels,
  priorityTone,
  requestStatusLabels,
  requestStatusTone,
  requestTypeLabels,
  reservationStatusLabels,
  reservationStatusTone,
  unitStatusLabels,
  unitStatusTone,
} from "@/lib/labels";
import { getPrisma } from "@/lib/prisma";
import {
  canInitiateGuestMessages,
  canViewGuestContactData,
  canViewOperationalFinancialData,
  canViewStayFinancialData,
  hasPermission,
} from "@/lib/permissions";

export const dynamic = "force-dynamic";

type ReservationDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<ActionFeedbackSearchParams>;
};

export default async function ReservationDetailPage({ params, searchParams }: ReservationDetailPageProps) {
  const { id } = await params;
  const feedback = getActionFeedback(await searchParams);
  const session = await requirePagePermission("reservation:read");
  const role = session.role as UserRole;
  const canWrite = hasPermission(role, "reservation:write");
  const canManageCheckIn = hasPermission(role, "checkin:write");
  const canViewFinancials = canViewStayFinancialData(role);
  const canViewOrderFinancials = canViewOperationalFinancialData(role);
  const canViewGuestContact = canViewGuestContactData(role);
  const canMessageGuest = canInitiateGuestMessages(role);
  const reservation = await getPrisma().reservation.findFirst({
    where: { id, unit: { propertyId: session.propertyId } },
    include: {
      guest: true,
      unit: { include: { unitType: true } },
      serviceRequests: { orderBy: { createdAt: "desc" } },
      orders: { orderBy: { createdAt: "desc" }, include: { items: true } },
    },
  });

  if (!reservation) {
    notFound();
  }

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
  const nights = Math.max(
    1,
    Math.round((reservation.checkOutDate.getTime() - reservation.checkInDate.getTime()) / (1000 * 60 * 60 * 24)),
  );
  const whatsappText = encodeURIComponent(
    `Halo ${reservation.guest.fullName}, reservasi ${reservation.bookingCode} di Nusa Escape telah tercatat untuk ${formatDateId(reservation.checkInDate)} - ${formatDateId(reservation.checkOutDate)}.`,
  );
  const whatsappUrl = canMessageGuest && reservation.guest.phone ? `https://wa.me/${reservation.guest.phone.replace(/\D/g, "")}?text=${whatsappText}` : null;

  const timeline = [
    { title: "Reservation created", value: formatDateId(reservation.createdAt) },
    { title: `Status: ${reservationStatusLabels[reservation.status]}`, value: bookingSourceLabels[reservation.source] },
    ...(canViewFinancials
      ? [{ title: `Payment: ${paymentStatusLabels[reservation.paymentStatus]}`, value: formatIdr(Number(reservation.totalAmount)) }]
      : [{ title: "Operational scope", value: reservation.unit?.code ?? "Unassigned" }]),
  ];

  return (
    <AppShell>
      <Link href="/reservations" className="inline-flex items-center gap-2 text-sm font-bold text-[#b8fbff]">
        <ArrowLeft className="size-4" />
        Kembali ke Reservasi
      </Link>

      <ActionFeedbackBanner feedback={feedback} />

      <section className="mt-5 grid gap-5 xl:grid-cols-[1fr_360px]">
        <GlassCard variant="strong" className="p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex flex-wrap gap-2">
                <StatusBadge label={reservationStatusLabels[reservation.status]} tone={reservationStatusTone[reservation.status]} dot />
                {canViewFinancials ? <StatusBadge label={paymentStatusLabels[reservation.paymentStatus]} tone={paymentStatusTone[reservation.paymentStatus]} /> : null}
              </div>
              <h2 className="mt-5 font-mono text-4xl font-black tracking-normal text-white">{reservation.bookingCode}</h2>
              <p className="mt-2 text-lg font-bold text-white/70">{reservation.guest.fullName} · {reservation.unit?.code ?? "Unassigned"}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {canCheckIn ? (
                <Link
                  href={`/check-in/${reservation.id}`}
                  className="gold-gradient inline-flex min-h-11 items-center justify-center gap-2 rounded-[22px] px-4 text-sm font-black text-[#041015]"
                >
                  <LogIn className="size-5" />
                  Check-in
                </Link>
              ) : null}
              {canCheckOut ? (
                <Link
                  href={`/check-out/${reservation.id}`}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[22px] border border-[#29f1ff]/24 bg-[#29f1ff]/10 px-4 text-sm font-black text-[#b8fbff]"
                >
                  <LogOut className="size-5" />
                  Check-out
                </Link>
              ) : null}
              {canEdit ? (
                <Link
                  href={`/reservations/${reservation.id}/edit`}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[22px] surface-field px-4 text-sm font-black text-white"
                >
                  <Edit className="size-5" />
                  Edit
                </Link>
              ) : null}
              {canCancel ? (
                <form action={cancelAction}>
                  <button className="min-h-11 rounded-[22px] border border-red-300/20 bg-red-500/10 px-4 text-sm font-black text-red-100">
                    Cancel
                  </button>
                </form>
              ) : null}
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <InfoBlock icon={<CalendarDays className="size-4" />} label="Check-in" value={formatDateId(reservation.checkInDate)} />
            <InfoBlock icon={<CalendarDays className="size-4" />} label="Check-out" value={formatDateId(reservation.checkOutDate)} />
            <InfoBlock label="Nights" value={`${nights} malam`} />
            <InfoBlock label="Source" value={bookingSourceLabels[reservation.source]} />
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <h3 className="text-lg font-black text-white">Quick Contact</h3>
          <div className="mt-4 rounded-[22px] surface-inset p-4">
            <div className="flex items-center gap-3">
              <div className="grid size-12 place-items-center rounded-[22px] bg-[#29f1ff]/14 text-[#b8fbff]">
                <UserRound className="size-6" />
              </div>
              <div>
                <p className="font-black text-white">{reservation.guest.fullName}</p>
                <p className="mt-1 text-xs font-semibold text-white/52">
                  {canViewGuestContact
                    ? reservation.guest.phone ?? reservation.guest.email ?? "No contact"
                    : maskContact(reservation.guest.phone ?? reservation.guest.email)}
                </p>
              </div>
            </div>
            {whatsappUrl ? (
              <a
                href={whatsappUrl}
                className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[22px] border border-[#29f1ff]/24 bg-[#29f1ff]/10 text-sm font-black text-[#b8fbff]"
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle className="size-5" />
                Open WhatsApp
              </a>
            ) : null}
          </div>
        </GlassCard>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-3">
        <GlassCard className="p-5">
          <h3 className="text-lg font-black text-white">Stay Summary</h3>
          <div className="mt-4 space-y-3">
            <InfoRow label="Unit" value={reservation.unit ? `${reservation.unit.code} · ${reservation.unit.name}` : "Unassigned"} />
            <InfoRow label="Room type" value={reservation.unit?.unitType.name ?? "-"} />
            <InfoRow label="Unit status" value={reservation.unit ? unitStatusLabels[reservation.unit.status] : "-"} />
            {reservation.unit ? <StatusBadge label={unitStatusLabels[reservation.unit.status]} tone={unitStatusTone[reservation.unit.status]} /> : null}
          </div>
        </GlassCard>

        {canViewFinancials ? (
          <GlassCard className="p-5">
            <h3 className="text-lg font-black text-white">Financial Summary</h3>
            <div className="mt-4 space-y-3">
              <InfoRow label="Room rate" value={formatIdr(Number(reservation.roomRate))} />
              <InfoRow label="Discount" value={formatIdr(Number(reservation.discount))} />
              <InfoRow label="Reservation total" value={formatIdr(Number(reservation.totalAmount))} strong />
              <InfoRow label="Orders" value={formatIdr(reservation.orders.reduce((sum, order) => sum + Number(order.total), 0))} />
            </div>
          </GlassCard>
        ) : null}

        <GlassCard className="p-5">
          <h3 className="text-lg font-black text-white">Timeline</h3>
          <div className="mt-4 space-y-3">
            {timeline.map((item) => (
              <div key={item.title} className="rounded-[22px] surface-inset p-4">
                <p className="font-bold text-white">{item.title}</p>
                <p className="mt-1 text-xs font-semibold text-white/52">{item.value}</p>
              </div>
            ))}
          </div>
        </GlassCard>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-2">
        <GlassCard className="p-5">
          <h3 className="text-lg font-black text-white">Service Requests</h3>
          <div className="mt-4 space-y-3">
            {reservation.serviceRequests.map((request) => (
              <div key={request.id} className="rounded-[22px] surface-inset p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-white">{request.title}</p>
                    <p className="mt-1 text-xs font-semibold text-white/52">
                      {requestTypeLabels[request.type]} · {priorityLabels[request.priority]}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <StatusBadge label={requestStatusLabels[request.status]} tone={requestStatusTone[request.status]} />
                    <StatusBadge label={priorityLabels[request.priority]} tone={priorityTone[request.priority]} />
                  </div>
                </div>
              </div>
            ))}
            {reservation.serviceRequests.length === 0 ? <EmptyLine label="Belum ada service request untuk reservasi ini." /> : null}
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <h3 className="text-lg font-black text-white">Orders</h3>
          <div className="mt-4 space-y-3">
            {reservation.orders.map((order) => (
              <div key={order.id} className="rounded-[22px] surface-inset p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-white">{order.code}</p>
                    <p className="mt-1 text-xs font-semibold text-white/52">{order.items.map((item) => item.name).join(", ") || "Belum ada item"}</p>
                  </div>
                  <div className="text-right">
                    <StatusBadge label={orderStatusLabels[order.status]} tone={orderStatusTone[order.status]} />
                    {canViewOrderFinancials ? <p className="mt-2 text-sm font-black text-[#b8fbff]">{formatIdr(Number(order.total))}</p> : null}
                  </div>
                </div>
              </div>
            ))}
            {reservation.orders.length === 0 ? <EmptyLine label="Belum ada order tambahan untuk reservasi ini." /> : null}
          </div>
        </GlassCard>
      </section>
    </AppShell>
  );
}

function InfoBlock({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-[22px] surface-inset p-4">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-normal text-white/42">
        {icon}
        {label}
      </p>
      <p className="mt-2 font-black text-white">{value}</p>
    </div>
  );
}

function InfoRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[22px] surface-inset p-3">
      <span className="text-sm font-semibold text-white/56">{label}</span>
      <span className={strong ? "text-lg font-black text-[#b8fbff]" : "text-sm font-black text-white"}>{value}</span>
    </div>
  );
}

function EmptyLine({ label }: { label: string }) {
  return (
    <div className="rounded-[22px] border border-dashed border-white/10 bg-white/[0.025] p-5 text-center text-sm font-semibold text-white/42">
      {label}
    </div>
  );
}
