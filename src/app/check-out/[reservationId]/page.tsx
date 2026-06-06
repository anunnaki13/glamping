import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  LogOut,
  MessageCircle,
  ReceiptText,
  UserRound,
} from "lucide-react";
import {
  HousekeepingStatus,
  MessageTemplateCategory,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  ReservationStatus,
} from "@/generated/prisma/enums";
import { completeCheckoutWizardAction } from "@/app/check-out/actions";
import { AppShell } from "@/components/layout/app-shell";
import { ActionFeedbackBanner } from "@/components/ui/action-feedback-banner";
import { GlassCard } from "@/components/ui/glass-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { requirePagePermission } from "@/lib/action-guard";
import { getActionFeedback, type ActionFeedbackSearchParams } from "@/lib/action-feedback";
import { formatDateId, formatDateTimeId, formatIdr } from "@/lib/formatters";
import {
  orderStatusLabels,
  orderStatusTone,
  paymentStatusLabels,
  paymentStatusTone,
  paymentMethodLabels,
  priorityLabels,
  requestTypeLabels,
  reservationStatusLabels,
  reservationStatusTone,
  housekeepingStatusLabels,
  unitStatusLabels,
  unitStatusTone,
} from "@/lib/labels";
import { buildWhatsappUrl, renderMessageTemplate } from "@/lib/message-templates";
import { calculateBalanceDue, getOrderPaidAmount, getReservationPaidAmount } from "@/lib/payments";
import { getPrisma } from "@/lib/prisma";
import { countNights } from "@/lib/reservations";

export const dynamic = "force-dynamic";

type CheckoutPageProps = {
  params: Promise<{ reservationId: string }>;
  searchParams: Promise<{ done?: string } & ActionFeedbackSearchParams>;
};

const paymentStatusOrder = [
  PaymentStatus.UNPAID,
  PaymentStatus.PARTIAL,
  PaymentStatus.PAID,
  PaymentStatus.REFUNDED,
];

const paymentMethodOrder = [
  PaymentMethod.CASH,
  PaymentMethod.BANK_TRANSFER,
  PaymentMethod.CREDIT_CARD,
  PaymentMethod.DEBIT_CARD,
  PaymentMethod.QRIS,
  PaymentMethod.E_WALLET,
  PaymentMethod.OTA_COLLECT,
  PaymentMethod.OTHER,
];

const openHousekeepingStatuses = [
  HousekeepingStatus.DIRTY,
  HousekeepingStatus.ASSIGNED,
  HousekeepingStatus.IN_PROGRESS,
  HousekeepingStatus.INSPECTION,
  HousekeepingStatus.BLOCKED,
];

export default async function CheckoutWizardPage({ params, searchParams }: CheckoutPageProps) {
  const { reservationId } = await params;
  const query = await searchParams;
  const { done } = query;
  const feedback = getActionFeedback(query);
  const session = await requirePagePermission("checkin:write");
  const prisma = getPrisma();

  const [reservation, property, reviewTemplate] = await Promise.all([
    prisma.reservation.findFirst({
      where: {
        id: reservationId,
        unit: { propertyId: session.propertyId },
      },
      include: {
        guest: true,
        unit: { include: { unitType: true } },
        orders: {
          include: { items: true },
          orderBy: { createdAt: "desc" },
        },
        serviceRequests: {
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    prisma.property.findUnique({ where: { id: session.propertyId } }),
    prisma.messageTemplate.findFirst({
      where: {
        propertyId: session.propertyId,
        category: MessageTemplateCategory.REVIEW_REQUEST,
        isActive: true,
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  if (!reservation || !property) {
    notFound();
  }

  const checkoutTask = reservation.unitId
    ? await prisma.housekeepingTask.findFirst({
        where: {
          unitId: reservation.unitId,
          taskType: "Checkout Cleaning",
          status: { in: openHousekeepingStatuses },
        },
        orderBy: { createdAt: "desc" },
      })
    : null;
  const nights = countNights(reservation.checkInDate, reservation.checkOutDate);
  const roomTotal = Number(reservation.totalAmount);
  const activeOrders = reservation.orders.filter((order) => order.status !== OrderStatus.CANCELLED);
  const orderTotal = activeOrders.reduce((sum, order) => sum + Number(order.total), 0);
  const paidOrderTotal = activeOrders.reduce((sum, order) => sum + getOrderPaidAmount(order), 0);
  const reservationPaid = getReservationPaidAmount({
    amountPaid: reservation.amountPaid,
    paymentStatus: reservation.paymentStatus,
    totalAmount: reservation.totalAmount,
  });
  const grandTotal = roomTotal + orderTotal;
  const paidTotal = reservationPaid + paidOrderTotal;
  const balanceDue = calculateBalanceDue(grandTotal, paidTotal);
  const openRequests = reservation.serviceRequests.filter(
    (request) => request.status !== "COMPLETED" && request.status !== "CANCELLED",
  );
  const canCheckout = reservation.status === ReservationStatus.CHECKED_IN && Boolean(reservation.unitId);
  const justCompleted = done === "1" && reservation.status === ReservationStatus.CHECKED_OUT;
  const isComplete = reservation.status === ReservationStatus.CHECKED_OUT;
  const checkoutAction = completeCheckoutWizardAction.bind(null, reservation.id);
  const amountPaidDefault = reservation.paymentStatus === PaymentStatus.PAID ? roomTotal : reservationPaid;
  const reviewMessage = renderMessageTemplate(
    reviewTemplate?.body ??
      "Halo {{guest_name}}, terima kasih sudah memilih {{property_name}}. Jika pengalaman Anda menyenangkan, kami sangat menghargai review singkat Anda.",
    {
      guest_name: reservation.guest.fullName,
      booking_code: reservation.bookingCode,
      property_name: property.name,
      property_phone: property.phone ?? "-",
      unit_name: reservation.unit?.code ?? "-",
      check_in: formatDateId(reservation.checkInDate),
      check_out: formatDateId(reservation.checkOutDate),
      payment_status: paymentStatusLabels[reservation.paymentStatus],
      total_amount: formatIdr(grandTotal),
    },
  );
  const reviewWhatsappUrl = reservation.guest.phone ? buildWhatsappUrl(reservation.guest.phone, reviewMessage) : null;

  return (
    <AppShell>
      <Link href={`/reservations/${reservation.id}`} className="inline-flex items-center gap-2 text-sm font-bold text-[#b8fbff]">
        <ArrowLeft className="size-4" />
        Kembali ke Detail Reservasi
      </Link>

      <div className="mt-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-bold text-[#29f1ff]">Front Office</p>
          <h2 className="mt-2 text-3xl font-black tracking-normal text-white">Check-out Wizard</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/62">
            Finalisasi stay, validasi extra charge, tandai status pembayaran, dan kirim unit ke alur housekeeping.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge label={reservation.bookingCode} tone="info" dot />
          <StatusBadge label={reservationStatusLabels[reservation.status]} tone={reservationStatusTone[reservation.status]} />
          <StatusBadge label={paymentStatusLabels[reservation.paymentStatus]} tone={paymentStatusTone[reservation.paymentStatus]} />
        </div>
      </div>

      <ActionFeedbackBanner feedback={feedback} />

      {isComplete ? (
        <CheckoutComplete
          justCompleted={justCompleted}
          bookingCode={reservation.bookingCode}
          guestName={reservation.guest.fullName}
          unitLabel={reservation.unit ? `${reservation.unit.code} - ${reservation.unit.name}` : "No unit"}
          grandTotal={grandTotal}
          reviewWhatsappUrl={reviewWhatsappUrl}
          checkoutTaskLabel={checkoutTask ? `${checkoutTask.taskType} - ${housekeepingStatusLabels[checkoutTask.status]}` : "Checkout cleaning task akan terlihat di Housekeeping."}
          checkoutTaskTime={checkoutTask?.createdAt ? formatDateTimeId(checkoutTask.createdAt) : null}
        />
      ) : !canCheckout ? (
        <GlassCard variant="strong" className="mt-6 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-2xl font-black text-white">Reservasi belum siap untuk check-out</h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">
                Wizard hanya bisa diproses untuk reservasi berstatus in-house dan memiliki unit aktif.
              </p>
            </div>
            <StatusBadge label={reservationStatusLabels[reservation.status]} tone={reservationStatusTone[reservation.status]} dot />
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <InfoBlock icon={<UserRound className="size-4" />} label="Guest" value={reservation.guest.fullName} />
            <InfoBlock icon={<CalendarDays className="size-4" />} label="Stay" value={`${formatDateId(reservation.checkInDate)} - ${formatDateId(reservation.checkOutDate)}`} />
            <InfoBlock icon={<LogOut className="size-4" />} label="Unit" value={reservation.unit?.code ?? "Unassigned"} />
          </div>
        </GlassCard>
      ) : (
        <form action={checkoutAction} className="mt-6 grid gap-5 2xl:grid-cols-[1fr_390px]">
          <div className="space-y-5">
            <GlassCard variant="strong" className="p-5">
              <div className="grid gap-3 md:grid-cols-4">
                <StepPill step="1" title="Stay" tone="success" />
                <StepPill step="2" title="Charges" tone={orderTotal > 0 ? "info" : "muted"} />
                <StepPill step="3" title="Payment" tone={reservation.paymentStatus === PaymentStatus.PAID ? "success" : "warning"} />
                <StepPill step="4" title="Confirm" tone="info" />
              </div>
            </GlassCard>

            <GlassCard className="p-5">
              <SectionTitle icon={<UserRound className="size-5" />} eyebrow="Step 1" title="Stay Summary" />
              <div className="mt-4 grid gap-4 md:grid-cols-4">
                <InfoBlock label="Guest" value={reservation.guest.fullName} />
                <InfoBlock label="Unit" value={reservation.unit ? `${reservation.unit.code} - ${reservation.unit.name}` : "Unassigned"} />
                <InfoBlock label="Room Type" value={reservation.unit?.unitType.name ?? "-"} />
                <InfoBlock label="Stay Length" value={`${Math.max(1, nights)} malam`} />
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <InfoBlock icon={<CalendarDays className="size-4" />} label="Check-in" value={formatDateId(reservation.checkInDate)} />
                <InfoBlock icon={<CalendarDays className="size-4" />} label="Check-out" value={formatDateId(reservation.checkOutDate)} />
                <div className="rounded-[22px] surface-inset p-4">
                  <p className="text-xs font-bold uppercase tracking-normal text-white/42">Unit Status</p>
                  {reservation.unit ? (
                    <div className="mt-2">
                      <StatusBadge label={unitStatusLabels[reservation.unit.status]} tone={unitStatusTone[reservation.unit.status]} dot />
                    </div>
                  ) : (
                    <p className="mt-2 font-black text-white">-</p>
                  )}
                </div>
              </div>
            </GlassCard>

            <GlassCard className="p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <SectionTitle icon={<ReceiptText className="size-5" />} eyebrow="Step 2" title="Extra Charges" />
                <Link
                  href="/orders"
                  className="inline-flex min-h-10 items-center justify-center rounded-[16px] border border-[#29f1ff]/24 bg-[#29f1ff]/10 px-3 text-xs font-black text-[#b8fbff]"
                >
                  Tambah order
                </Link>
              </div>
              <div className="mt-4 space-y-3">
                {reservation.orders.map((order) => (
                  <div key={order.id} className="rounded-[22px] surface-inset p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="font-mono text-sm font-black text-[#b8fbff]">{order.code}</p>
                        <p className="mt-1 max-w-2xl text-xs font-semibold text-white/52">
                          {order.items.map((item) => `${item.quantity}x ${item.name}`).join(", ") || "Belum ada item"}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 md:justify-end">
                        <StatusBadge label={orderStatusLabels[order.status]} tone={orderStatusTone[order.status]} />
                        <StatusBadge label={paymentStatusLabels[order.paymentStatus]} tone={paymentStatusTone[order.paymentStatus]} />
                        <p className="text-sm font-black text-white">{formatIdr(Number(order.total))}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {reservation.orders.length === 0 ? (
                  <p className="rounded-[22px] surface-inset p-4 text-sm font-semibold text-white/58">
                    Belum ada order tambahan untuk reservasi ini.
                  </p>
                ) : null}
              </div>
            </GlassCard>

            <GlassCard className="p-5">
              <SectionTitle icon={<CreditCard className="size-5" />} eyebrow="Step 3" title="Payment Summary" />
              <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
                <div className="space-y-3">
                  <MoneyRow label="Room total" value={roomTotal} />
                  <MoneyRow label="Extra charges" value={orderTotal} />
                  <MoneyRow label="Grand total" value={grandTotal} strong />
                  <MoneyRow label="Collected" value={paidTotal} />
                  <MoneyRow label="Balance due" value={balanceDue} strong />
                </div>
                <div className="space-y-3">
                  <label className="block rounded-[22px] surface-inset p-4">
                    <span className="text-xs font-bold uppercase tracking-normal text-white/42">Final payment status</span>
                    <select
                      name="paymentStatus"
                      defaultValue={reservation.paymentStatus}
                      className="mt-3 min-h-12 w-full rounded-[22px] surface-field px-4 text-sm font-bold text-white outline-none"
                    >
                      {paymentStatusOrder.map((status) => (
                        <option key={status} value={status}>
                          {paymentStatusLabels[status]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block rounded-[22px] surface-inset p-4">
                    <span className="text-xs font-bold uppercase tracking-normal text-white/42">Amount paid for room</span>
                    <input
                      name="amountPaid"
                      type="number"
                      min="0"
                      defaultValue={amountPaidDefault}
                      className="mt-3 min-h-12 w-full rounded-[22px] surface-field px-4 text-sm font-bold text-white outline-none"
                    />
                  </label>
                  <label className="block rounded-[22px] surface-inset p-4">
                    <span className="text-xs font-bold uppercase tracking-normal text-white/42">Payment method</span>
                    <select
                      name="paymentMethod"
                      defaultValue={PaymentMethod.BANK_TRANSFER}
                      className="mt-3 min-h-12 w-full rounded-[22px] surface-field px-4 text-sm font-bold text-white outline-none"
                    >
                      {paymentMethodOrder.map((method) => (
                        <option key={method} value={method}>
                          {paymentMethodLabels[method]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block rounded-[22px] surface-inset p-4">
                    <span className="text-xs font-bold uppercase tracking-normal text-white/42">Payment reference</span>
                    <input
                      name="paymentReference"
                      placeholder="Transfer ref, QRIS id, card approval..."
                      className="mt-3 min-h-12 w-full rounded-[22px] surface-field px-4 text-sm font-bold text-white outline-none placeholder:text-white/34"
                    />
                  </label>
                </div>
              </div>
            </GlassCard>

            <GlassCard className="p-5">
              <SectionTitle icon={<LogOut className="size-5" />} eyebrow="Step 4" title="Final Confirmation" />
              <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_300px]">
                <label className="block rounded-[22px] surface-inset p-4">
                  <span className="text-xs font-bold uppercase tracking-normal text-white/42">Checkout notes</span>
                  <textarea
                    name="checkoutNotes"
                    rows={5}
                    placeholder="Catatan deposit, barang tertinggal, kerusakan, atau follow-up internal..."
                    className="mt-3 w-full resize-none rounded-[22px] surface-field p-4 text-sm font-semibold text-white outline-none placeholder:text-white/34"
                  />
                </label>
                <div className="rounded-[22px] border border-[#29f1ff]/18 bg-[#29f1ff]/8 p-4">
                  <p className="text-sm font-black text-[#b8fbff]">Efek setelah submit</p>
                  <div className="mt-3 space-y-3 text-sm font-semibold leading-6 text-white/64">
                    <p>Reservasi berubah menjadi checked out.</p>
                    <p>Unit masuk status dirty.</p>
                    <p>Task checkout cleaning dibuat atau dipakai ulang jika sudah ada.</p>
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>

          <aside className="space-y-5">
            <GlassCard variant="strong" className="p-5">
              <h3 className="text-xl font-black text-white">Checkout Control</h3>
              <div className="mt-4 space-y-3">
                <InfoRow label="Booking" value={reservation.bookingCode} />
                <InfoRow label="Guest" value={reservation.guest.fullName} />
                <InfoRow label="Grand total" value={formatIdr(grandTotal)} strong />
                <InfoRow label="Balance due" value={formatIdr(balanceDue)} strong />
                <InfoRow label="Open requests" value={String(openRequests.length)} />
              </div>
              <button className="gold-gradient mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[22px] px-5 text-sm font-black text-[#041015]">
                <CheckCircle2 className="size-5" />
                Final Check-out
              </button>
            </GlassCard>

            <GlassCard className="p-5">
              <h3 className="text-lg font-black text-white">Open Service Requests</h3>
              <div className="mt-4 space-y-3">
                {openRequests.slice(0, 4).map((request) => (
                  <div key={request.id} className="rounded-[22px] surface-inset p-4">
                    <p className="font-bold text-white">{request.title}</p>
                    <p className="mt-1 text-xs font-semibold text-white/52">
                      {requestTypeLabels[request.type]} - {priorityLabels[request.priority]}
                    </p>
                  </div>
                ))}
                {openRequests.length === 0 ? <EmptyLine label="Tidak ada request terbuka." /> : null}
              </div>
            </GlassCard>
          </aside>
        </form>
      )}
    </AppShell>
  );
}

function CheckoutComplete({
  justCompleted,
  bookingCode,
  guestName,
  unitLabel,
  grandTotal,
  reviewWhatsappUrl,
  checkoutTaskLabel,
  checkoutTaskTime,
}: {
  justCompleted: boolean;
  bookingCode: string;
  guestName: string;
  unitLabel: string;
  grandTotal: number;
  reviewWhatsappUrl: string | null;
  checkoutTaskLabel: string;
  checkoutTaskTime: string | null;
}) {
  return (
    <GlassCard variant="strong" className="mt-6 p-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="grid size-14 place-items-center rounded-[22px] bg-emerald-400/14 text-emerald-100">
            <CheckCircle2 className="size-7" />
          </div>
          <h3 className="mt-5 text-3xl font-black text-white">Check-out complete</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/62">
            {bookingCode} untuk {guestName} sudah selesai. Unit masuk antrean housekeeping dan front office bisa lanjut ke review follow-up.
          </p>
          {justCompleted ? <p className="mt-3 text-sm font-bold text-emerald-100">Final check-out baru saja tersimpan.</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/housekeeping"
            className="inline-flex min-h-11 items-center justify-center rounded-[22px] surface-chip px-4 text-sm font-black text-white"
          >
            Housekeeping
          </Link>
          {reviewWhatsappUrl ? (
            <a
              href={reviewWhatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[22px] border border-[#29f1ff]/24 bg-[#29f1ff]/10 px-4 text-sm font-black text-[#b8fbff]"
            >
              <MessageCircle className="size-5" />
              Review WhatsApp
            </a>
          ) : null}
        </div>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <InfoBlock label="Guest" value={guestName} />
        <InfoBlock label="Unit" value={unitLabel} />
        <InfoBlock label="Grand total" value={formatIdr(grandTotal)} />
        <InfoBlock label="Housekeeping" value={checkoutTaskLabel} />
      </div>
      {checkoutTaskTime ? <p className="mt-4 text-xs font-semibold text-white/50">Task created: {checkoutTaskTime}</p> : null}
      {!reviewWhatsappUrl ? <p className="mt-4 text-sm font-semibold text-white/58">Nomor WhatsApp tamu belum tersedia.</p> : null}
    </GlassCard>
  );
}

function SectionTitle({ icon, eyebrow, title }: { icon: ReactNode; eyebrow: string; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid size-11 place-items-center rounded-[22px] bg-[#29f1ff]/14 text-[#b8fbff]">{icon}</div>
      <div>
        <p className="text-xs font-black uppercase tracking-normal text-[#29f1ff]">{eyebrow}</p>
        <h3 className="mt-1 text-lg font-black text-white">{title}</h3>
      </div>
    </div>
  );
}

function StepPill({
  step,
  title,
  tone,
}: {
  step: string;
  title: string;
  tone: "success" | "warning" | "info" | "muted";
}) {
  const toneClass = {
    success: "border-emerald-300/22 bg-emerald-400/10 text-emerald-100",
    warning: "border-amber-300/22 bg-amber-400/10 text-amber-100",
    info: "border-sky-300/22 bg-sky-400/10 text-sky-100",
    muted: "surface-chip text-white/62",
  }[tone];

  return (
    <div className={`flex min-h-14 items-center gap-3 rounded-[22px] border px-4 ${toneClass}`}>
      <span className="grid size-8 place-items-center rounded-full bg-white/12 text-sm font-black">{step}</span>
      <span className="text-sm font-black">{title}</span>
    </div>
  );
}

function InfoBlock({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
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

function MoneyRow({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[22px] surface-inset p-4">
      <span className="text-sm font-semibold text-white/56">{label}</span>
      <span className={strong ? "text-xl font-black text-[#b8fbff]" : "text-sm font-black text-white"}>{formatIdr(value)}</span>
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
