import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Home,
  KeyRound,
  MessageCircle,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import {
  MessageTemplateCategory,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  RequestStatus,
  ReservationStatus,
  UnitStatus,
  UserRole,
} from "@/generated/prisma/enums";
import { completeCheckinWizardAction } from "@/app/check-in/actions";
import { AppShell } from "@/components/layout/app-shell";
import { ActionFeedbackBanner } from "@/components/ui/action-feedback-banner";
import { CurrencyInput } from "@/components/ui/currency-input";
import { GlassCard } from "@/components/ui/glass-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { requirePagePermission } from "@/lib/action-guard";
import { getActionFeedback, type ActionFeedbackSearchParams } from "@/lib/action-feedback";
import { formatDateId, formatDateTimeId, formatIdr } from "@/lib/formatters";
import {
  bookingSourceLabels,
  housekeepingStatusLabels,
  housekeepingStatusTone,
  maskSensitive,
  paymentMethodLabels,
  paymentStatusLabels,
  paymentStatusTone,
  priorityLabels,
  requestTypeLabels,
  reservationStatusLabels,
  reservationStatusTone,
  unitStatusLabels,
  unitStatusTone,
} from "@/lib/labels";
import { buildWhatsappUrl, renderMessageTemplate } from "@/lib/message-templates";
import { calculateBalanceDue, getOrderPaidAmount, getReservationPaidAmount } from "@/lib/payments";
import { getPrisma } from "@/lib/prisma";
import { countNights } from "@/lib/reservations";

export const dynamic = "force-dynamic";

type CheckinPageProps = {
  params: Promise<{ reservationId: string }>;
  searchParams: Promise<{ done?: string } & ActionFeedbackSearchParams>;
};

const finalPaymentStatusOrder = [
  PaymentStatus.PARTIAL,
  PaymentStatus.PAID,
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

function canUseOverride(role: string) {
  return role === UserRole.OWNER || role === UserRole.MANAGER;
}

function getPageBlockers({
  reservationStatus,
  unitStatus,
}: {
  reservationStatus: ReservationStatus;
  unitStatus: UnitStatus;
}) {
  const hardBlocks: string[] = [];
  const overrideBlocks: string[] = [];

  if (
    reservationStatus !== ReservationStatus.PENDING &&
    reservationStatus !== ReservationStatus.CONFIRMED
  ) {
    hardBlocks.push("Reservasi harus Pending atau Confirmed untuk check-in.");
  }

  if (reservationStatus === ReservationStatus.PENDING) {
    overrideBlocks.push("Reservasi masih Pending dan belum Confirmed.");
  }

  if (
    unitStatus === UnitStatus.OCCUPIED ||
    unitStatus === UnitStatus.MAINTENANCE ||
    unitStatus === UnitStatus.OUT_OF_ORDER
  ) {
    hardBlocks.push("Unit sedang occupied, maintenance, atau out of order.");
  }

  if (unitStatus === UnitStatus.DIRTY || unitStatus === UnitStatus.CLEANING) {
    overrideBlocks.push("Unit belum READY/AVAILABLE.");
  }

  return { hardBlocks, overrideBlocks };
}

export default async function CheckinWizardPage({ params, searchParams }: CheckinPageProps) {
  const { reservationId } = await params;
  const query = await searchParams;
  const { done } = query;
  const feedback = getActionFeedback(query);
  const session = await requirePagePermission("checkin:write");
  const prisma = getPrisma();

  const [reservation, property, welcomeTemplate] = await Promise.all([
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
        category: MessageTemplateCategory.WELCOME_MESSAGE,
        isActive: true,
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  if (!reservation || !property || !reservation.unit) {
    notFound();
  }

  const latestHousekeepingTask = await prisma.housekeepingTask.findFirst({
    where: { unitId: reservation.unit.id },
    orderBy: { createdAt: "desc" },
  });
  const nights = countNights(reservation.checkInDate, reservation.checkOutDate);
  const roomTotal = Number(reservation.totalAmount);
  const orderTotal = reservation.orders
    .filter((order) => order.status !== OrderStatus.CANCELLED)
    .reduce((sum, order) => sum + Number(order.total), 0);
  const paidOrderTotal = reservation.orders
    .filter((order) => order.status !== OrderStatus.CANCELLED)
    .reduce((sum, order) => sum + getOrderPaidAmount(order), 0);
  const reservationPaid = getReservationPaidAmount({
    amountPaid: reservation.amountPaid,
    paymentStatus: reservation.paymentStatus,
    totalAmount: reservation.totalAmount,
  });
  const grandTotal = roomTotal + orderTotal;
  const paidTotal = reservationPaid + paidOrderTotal;
  const balanceDue = calculateBalanceDue(grandTotal, paidTotal);
  const openRequests = reservation.serviceRequests.filter(
    (request) => request.status !== RequestStatus.COMPLETED && request.status !== RequestStatus.CANCELLED,
  );
  const canOverride = canUseOverride(session.role);
  const { hardBlocks, overrideBlocks } = getPageBlockers({
    reservationStatus: reservation.status,
    unitStatus: reservation.unit.status,
  });
  const isComplete = reservation.status === ReservationStatus.CHECKED_IN;
  const justCompleted = done === "1" && isComplete;
  const finalPaymentDefault =
    reservation.paymentStatus === PaymentStatus.PAID || reservation.paymentStatus === PaymentStatus.PARTIAL
      ? reservation.paymentStatus
      : PaymentStatus.PARTIAL;
  const amountPaidDefault = finalPaymentDefault === PaymentStatus.PAID ? roomTotal : reservationPaid;
  const checkinAction = completeCheckinWizardAction.bind(null, reservation.id);
  const guestIdLabel = reservation.guest.idNumber
    ? `${reservation.guest.idType ?? "ID"} ${maskSensitive(reservation.guest.idNumber)}`
    : "Belum tersimpan";
  const welcomeMessage = renderMessageTemplate(
    welcomeTemplate?.body ??
      "Selamat datang di {{property_name}}, {{guest_name}}. Semoga stay Anda nyaman. Jika membutuhkan bantuan selama menginap di {{unit_name}}, balas pesan ini atau hubungi {{property_phone}}.",
    {
      guest_name: reservation.guest.fullName,
      booking_code: reservation.bookingCode,
      property_name: property.name,
      property_phone: property.phone ?? "-",
      unit_name: reservation.unit.code,
      check_in: formatDateId(reservation.checkInDate),
      check_out: formatDateId(reservation.checkOutDate),
      payment_status: paymentStatusLabels[reservation.paymentStatus],
      total_amount: formatIdr(grandTotal),
    },
  );
  const welcomeWhatsappUrl = reservation.guest.phone ? buildWhatsappUrl(reservation.guest.phone, welcomeMessage) : null;
  const canSubmit = hardBlocks.length === 0 && (overrideBlocks.length === 0 || canOverride);

  return (
    <AppShell>
      <Link href={`/reservations/${reservation.id}`} className="inline-flex items-center gap-2 text-sm font-bold text-[#b8fbff]">
        <ArrowLeft className="size-4" />
        Kembali ke Detail Reservasi
      </Link>

      <div className="mt-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-bold text-[#29f1ff]">Front Office</p>
          <h2 className="mt-2 text-3xl font-black tracking-normal text-white">Check-in Wizard</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/62">
            Verifikasi reservasi, tamu, pembayaran, readiness unit, lalu finalisasi kedatangan.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge label={reservation.bookingCode} tone="info" dot />
          <StatusBadge label={reservationStatusLabels[reservation.status]} tone={reservationStatusTone[reservation.status]} />
          <StatusBadge label={unitStatusLabels[reservation.unit.status]} tone={unitStatusTone[reservation.unit.status]} />
        </div>
      </div>

      <ActionFeedbackBanner feedback={feedback} />

      {isComplete ? (
        <CheckinComplete
          justCompleted={justCompleted}
          bookingCode={reservation.bookingCode}
          guestName={reservation.guest.fullName}
          unitLabel={`${reservation.unit.code} - ${reservation.unit.name}`}
          stayDates={`${formatDateId(reservation.checkInDate)} - ${formatDateId(reservation.checkOutDate)}`}
          welcomeWhatsappUrl={welcomeWhatsappUrl}
          paymentLabel={paymentStatusLabels[reservation.paymentStatus]}
        />
      ) : (
        <form action={checkinAction} className="mt-6 grid gap-5 2xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="min-w-0 space-y-5">
            <GlassCard variant="strong" className="p-5">
              <div className="grid gap-3 md:grid-cols-5">
                <StepPill step="1" title="Reservasi" tone={reservation.status === ReservationStatus.CONFIRMED ? "success" : "warning"} />
                <StepPill step="2" title="Guest" tone={reservation.guest.phone ? "success" : "warning"} />
                <StepPill step="3" title="Payment" tone={reservation.paymentStatus === PaymentStatus.PAID || reservation.paymentStatus === PaymentStatus.PARTIAL ? "success" : "warning"} />
                <StepPill step="4" title="Unit" tone={reservation.unit.status === UnitStatus.READY || reservation.unit.status === UnitStatus.AVAILABLE ? "success" : "warning"} />
                <StepPill step="5" title="Final" tone={hardBlocks.length === 0 ? "info" : "danger"} />
              </div>
            </GlassCard>

            <ReadinessWarnings
              hardBlocks={hardBlocks}
              overrideBlocks={overrideBlocks}
              canOverride={canOverride}
              paymentStatus={reservation.paymentStatus}
            />

            <GlassCard className="p-5">
              <SectionTitle icon={<CalendarDays className="size-5" />} eyebrow="Step 1" title="Reservation Verification" />
              <div className="mt-4 grid gap-4 md:grid-cols-4">
                <InfoBlock label="Booking" value={reservation.bookingCode} />
                <InfoBlock label="Source" value={bookingSourceLabels[reservation.source]} />
                <InfoBlock label="Guests" value={`${reservation.adults} adults, ${reservation.children} children`} />
                <InfoBlock label="Stay Length" value={`${Math.max(1, nights)} malam`} />
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <InfoBlock label="Check-in" value={formatDateId(reservation.checkInDate)} />
                <InfoBlock label="Check-out" value={formatDateId(reservation.checkOutDate)} />
                <div className="rounded-[22px] surface-inset p-4">
                  <p className="text-xs font-bold uppercase tracking-normal text-white/42">Status</p>
                  <div className="mt-2">
                    <StatusBadge label={reservationStatusLabels[reservation.status]} tone={reservationStatusTone[reservation.status]} dot />
                  </div>
                </div>
              </div>
            </GlassCard>

            <GlassCard className="p-5">
              <SectionTitle icon={<UserRound className="size-5" />} eyebrow="Step 2" title="Guest Verification" />
              <div className="mt-4 grid gap-4 md:grid-cols-4">
                <InfoBlock label="Guest" value={reservation.guest.fullName} />
                <InfoBlock label="Phone" value={reservation.guest.phone ?? "Belum tersimpan"} />
                <InfoBlock label="Email" value={reservation.guest.email ?? "Belum tersimpan"} />
                <InfoBlock label="ID" value={guestIdLabel} />
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <InfoBlock label="Origin" value={[reservation.guest.city, reservation.guest.country].filter(Boolean).join(", ") || "-"} />
                <InfoBlock label="Guest Type" value={reservation.guest.guestType.replaceAll("_", " ")} />
                <InfoBlock label="Preferences" value={reservation.guest.preferences ?? "-"} />
              </div>
            </GlassCard>

            <GlassCard className="p-5">
              <SectionTitle icon={<CreditCard className="size-5" />} eyebrow="Step 3" title="Payment Confirmation" />
              <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
                <div className="space-y-3">
                  <MoneyRow label="Room total" value={roomTotal} />
                  <MoneyRow label="Extra charges" value={orderTotal} />
                  <MoneyRow label="Grand total" value={grandTotal} strong />
                  <MoneyRow label="Collected" value={paidTotal} />
                  <MoneyRow label="Balance due" value={balanceDue} strong />
                </div>
                <div className="space-y-3">
                  <div className="rounded-[22px] surface-inset p-4">
                    <p className="text-xs font-bold uppercase tracking-normal text-white/42">Current payment</p>
                    <div className="mt-3">
                      <StatusBadge label={paymentStatusLabels[reservation.paymentStatus]} tone={paymentStatusTone[reservation.paymentStatus]} dot />
                    </div>
                  </div>
                  <label className="block rounded-[22px] surface-inset p-4">
                    <span className="text-xs font-bold uppercase tracking-normal text-white/42">Final payment status</span>
                    <select
                      name="paymentStatus"
                      defaultValue={finalPaymentDefault}
                      className="mt-3 min-h-12 w-full rounded-[22px] surface-field px-4 text-sm font-bold text-white outline-none"
                    >
                      {finalPaymentStatusOrder.map((status) => (
                        <option key={status} value={status}>
                          {paymentStatusLabels[status]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block rounded-[22px] surface-inset p-4">
                    <span className="text-xs font-bold uppercase tracking-normal text-white/42">Amount paid for room</span>
                    <CurrencyInput
                      name="amountPaid"
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
              <SectionTitle icon={<Home className="size-5" />} eyebrow="Step 4" title="Unit Readiness" />
              <div className="mt-4 grid gap-4 md:grid-cols-4">
                <InfoBlock label="Unit" value={`${reservation.unit.code} - ${reservation.unit.name}`} />
                <InfoBlock label="Room Type" value={reservation.unit.unitType.name} />
                <InfoBlock label="Capacity" value={`${reservation.unit.unitType.capacity} guests`} />
                <div className="rounded-[22px] surface-inset p-4">
                  <p className="text-xs font-bold uppercase tracking-normal text-white/42">Unit status</p>
                  <div className="mt-2">
                    <StatusBadge label={unitStatusLabels[reservation.unit.status]} tone={unitStatusTone[reservation.unit.status]} dot />
                  </div>
                </div>
              </div>
              <div className="mt-4 rounded-[22px] surface-inset p-4">
                <p className="text-xs font-bold uppercase tracking-normal text-white/42">Latest housekeeping</p>
                {latestHousekeepingTask ? (
                  <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-black text-white">{latestHousekeepingTask.taskType}</p>
                      <p className="mt-1 text-xs font-semibold text-white/50">{formatDateTimeId(latestHousekeepingTask.updatedAt)}</p>
                    </div>
                    <StatusBadge label={housekeepingStatusLabels[latestHousekeepingTask.status]} tone={housekeepingStatusTone[latestHousekeepingTask.status]} />
                  </div>
                ) : (
                  <div className="mt-3">
                    <EmptyLine label="Belum ada task housekeeping untuk unit ini." />
                  </div>
                )}
              </div>
            </GlassCard>

            <GlassCard className="p-5">
              <SectionTitle icon={<ShieldCheck className="size-5" />} eyebrow="Step 5" title="Final Confirmation" />
              <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
                <label className="block rounded-[22px] surface-inset p-4">
                  <span className="text-xs font-bold uppercase tracking-normal text-white/42">Check-in notes</span>
                  <textarea
                    name="checkinNotes"
                    rows={5}
                    placeholder="Catatan deposit, estimasi arrival, request khusus, atau instruksi internal..."
                    className="mt-3 w-full resize-none rounded-[22px] surface-field p-4 text-sm font-semibold text-white outline-none placeholder:text-white/34"
                  />
                </label>
                <div className="space-y-4">
                  {overrideBlocks.length > 0 && canOverride ? (
                    <div className="rounded-[22px] border border-amber-300/20 bg-amber-400/10 p-4">
                      <label className="flex items-center gap-2 text-sm font-black text-amber-100">
                        <input type="checkbox" name="override" required className="size-4 accent-[#29f1ff]" />
                        Manager override
                      </label>
                      <textarea
                        name="overrideReason"
                        rows={4}
                        required
                        minLength={10}
                        placeholder="Alasan override..."
                        className="mt-3 w-full resize-none rounded-[22px] surface-field p-4 text-sm font-semibold text-white outline-none placeholder:text-white/34"
                      />
                    </div>
                  ) : null}
                  <div className="rounded-[22px] border border-[#29f1ff]/18 bg-[#29f1ff]/8 p-4">
                    <p className="text-sm font-black text-[#b8fbff]">Efek setelah submit</p>
                    <div className="mt-3 space-y-3 text-sm font-semibold leading-6 text-white/64">
                      <p>Reservasi berubah menjadi in-house.</p>
                      <p>Unit berubah menjadi occupied.</p>
                      <p>Activity log dibuat untuk audit operasional.</p>
                    </div>
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>

          <aside className="space-y-5">
            <GlassCard variant="strong" className="p-5">
              <h3 className="text-xl font-black text-white">Check-in Control</h3>
              <div className="mt-4 space-y-3">
                <InfoRow label="Booking" value={reservation.bookingCode} />
                <InfoRow label="Guest" value={reservation.guest.fullName} />
                <InfoRow label="Unit" value={reservation.unit.code} />
                <InfoRow label="Grand total" value={formatIdr(grandTotal)} strong />
                <InfoRow label="Open requests" value={String(openRequests.length)} />
              </div>
              <button
                disabled={!canSubmit}
                className="gold-gradient mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[22px] px-5 text-sm font-black text-[#041015] disabled:cursor-not-allowed disabled:opacity-45"
              >
                <CheckCircle2 className="size-5" />
                Final Check-in
              </button>
              {!canSubmit ? (
                <p className="mt-3 text-xs font-semibold leading-5 text-white/50">
                  Check-in belum bisa disubmit dari role ini karena masih ada blocker readiness.
                </p>
              ) : null}
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

function ReadinessWarnings({
  hardBlocks,
  overrideBlocks,
  canOverride,
  paymentStatus,
}: {
  hardBlocks: string[];
  overrideBlocks: string[];
  canOverride: boolean;
  paymentStatus: PaymentStatus;
}) {
  const paymentReady = paymentStatus === PaymentStatus.PAID || paymentStatus === PaymentStatus.PARTIAL;

  if (hardBlocks.length === 0 && overrideBlocks.length === 0 && paymentReady) {
    return (
      <GlassCard className="p-4">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-[22px] bg-emerald-400/14 text-emerald-100">
            <CheckCircle2 className="size-5" />
          </div>
          <div>
            <p className="font-black text-white">Readiness clear</p>
            <p className="mt-1 text-xs font-semibold text-white/50">Reservasi, pembayaran, dan unit siap untuk final check-in.</p>
          </div>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-5">
      <div className="flex items-start gap-3">
        <div className="grid size-11 place-items-center rounded-[22px] bg-amber-400/12 text-amber-100">
          <AlertTriangle className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-black text-white">Readiness warnings</h3>
          <div className="mt-3 space-y-2 text-sm font-semibold leading-6 text-white/64">
            {hardBlocks.map((block) => (
              <p key={block}>Hard block: {block}</p>
            ))}
            {overrideBlocks.map((block) => (
              <p key={block}>Override: {block}</p>
            ))}
            {!paymentReady ? <p>Payment: pilih final payment Partial atau Paid sebelum submit.</p> : null}
          </div>
          {overrideBlocks.length > 0 ? (
            <p className="mt-3 text-xs font-semibold text-white/50">
              {canOverride ? "Owner/Manager dapat melanjutkan dengan alasan override." : "Role ini membutuhkan Owner/Manager untuk override."}
            </p>
          ) : null}
        </div>
      </div>
    </GlassCard>
  );
}

function CheckinComplete({
  justCompleted,
  bookingCode,
  guestName,
  unitLabel,
  stayDates,
  welcomeWhatsappUrl,
  paymentLabel,
}: {
  justCompleted: boolean;
  bookingCode: string;
  guestName: string;
  unitLabel: string;
  stayDates: string;
  welcomeWhatsappUrl: string | null;
  paymentLabel: string;
}) {
  return (
    <GlassCard variant="strong" className="mt-6 p-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="grid size-14 place-items-center rounded-[22px] bg-emerald-400/14 text-emerald-100">
            <KeyRound className="size-7" />
          </div>
          <h3 className="mt-5 text-3xl font-black text-white">Check-in complete</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/62">
            {bookingCode} untuk {guestName} sudah in-house. Unit sudah occupied dan tim dapat melanjutkan welcome flow.
          </p>
          {justCompleted ? <p className="mt-3 text-sm font-bold text-emerald-100">Final check-in baru saja tersimpan.</p> : null}
        </div>
        {welcomeWhatsappUrl ? (
          <a
            href={welcomeWhatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[22px] border border-[#29f1ff]/24 bg-[#29f1ff]/10 px-4 text-sm font-black text-[#b8fbff]"
          >
            <MessageCircle className="size-5" />
            Welcome WhatsApp
          </a>
        ) : null}
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <InfoBlock label="Guest" value={guestName} />
        <InfoBlock label="Unit" value={unitLabel} />
        <InfoBlock label="Stay" value={stayDates} />
        <InfoBlock label="Payment" value={paymentLabel} />
      </div>
      {!welcomeWhatsappUrl ? <p className="mt-4 text-sm font-semibold text-white/58">Nomor WhatsApp tamu belum tersedia.</p> : null}
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
  tone: "success" | "warning" | "info" | "danger";
}) {
  const toneClass = {
    success: "border-emerald-300/22 bg-emerald-400/10 text-emerald-100",
    warning: "border-amber-300/22 bg-amber-400/10 text-amber-100",
    info: "border-sky-300/22 bg-sky-400/10 text-sky-100",
    danger: "border-red-300/22 bg-red-500/10 text-red-100",
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
