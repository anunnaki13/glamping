import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Edit, LogIn, LogOut, MessageCircle, ReceiptText, UserRound } from "lucide-react";
import {
  OrderStatus,
  PaymentMethod,
  PaymentTransactionStatus,
  PaymentTransactionType,
  ReservationStatus,
  UserRole,
} from "@/generated/prisma/enums";
import {
  cancelReservationAction,
} from "@/app/reservations/actions";
import {
  createPaymentTransactionAction,
  voidPaymentTransactionAction,
} from "@/app/payments/actions";
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
  paymentMethodLabels,
  paymentStatusLabels,
  paymentStatusTone,
  paymentTransactionStatusLabels,
  paymentTransactionStatusTone,
  paymentTransactionTypeLabels,
  paymentTransactionTypeTone,
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
import {
  calculateBalanceDue,
  getInvoiceNumber,
  getOrderPaidAmount,
  getPaymentTransactionSignedAmount,
  getReservationPaidAmount,
} from "@/lib/payments";

export const dynamic = "force-dynamic";

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

const paymentTransactionTypeOrder = [
  PaymentTransactionType.PAYMENT,
  PaymentTransactionType.REFUND,
  PaymentTransactionType.ADJUSTMENT,
];

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
  const canViewPayments = hasPermission(role, "payment:read");
  const canManagePayments = hasPermission(role, "payment:write");
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
      paymentTransactions: { orderBy: { postedAt: "desc" } },
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
  const activeOrders = reservation.orders.filter((order) => order.status !== OrderStatus.CANCELLED);
  const reservationTotal = Number(reservation.totalAmount);
  const reservationPaid = getReservationPaidAmount({
    amountPaid: reservation.amountPaid,
    paymentStatus: reservation.paymentStatus,
    totalAmount: reservation.totalAmount,
  });
  const orderTotal = activeOrders.reduce((sum, order) => sum + Number(order.total), 0);
  const paidOrderTotal = activeOrders.reduce((sum, order) => sum + getOrderPaidAmount(order), 0);
  const folioTotal = reservationTotal + orderTotal;
  const paidTotal = reservationPaid + paidOrderTotal;
  const balanceDue = calculateBalanceDue(folioTotal, paidTotal);
  const invoiceNumber = getInvoiceNumber(reservation);

  const timeline = [
    { title: "Reservation created", value: formatDateId(reservation.createdAt) },
    { title: `Status: ${reservationStatusLabels[reservation.status]}`, value: bookingSourceLabels[reservation.source] },
    ...(canViewFinancials
      ? [{ title: `Invoice: ${invoiceNumber}`, value: `Balance ${formatIdr(balanceDue)}` }]
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
              {canViewFinancials ? (
                <Link
                  href={`/reservations/${reservation.id}/invoice`}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[22px] surface-field px-4 text-sm font-black text-white"
                >
                  <ReceiptText className="size-5" />
                  Invoice
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
              <InfoRow label="Invoice" value={invoiceNumber} />
              <InfoRow label="Room rate" value={formatIdr(Number(reservation.roomRate))} />
              <InfoRow label="Discount" value={formatIdr(Number(reservation.discount))} />
              <InfoRow label="Reservation total" value={formatIdr(reservationTotal)} />
              <InfoRow label="Orders" value={formatIdr(orderTotal)} />
              <InfoRow label="Amount collected" value={formatIdr(reservationPaid)} />
              <InfoRow label="Paid orders" value={formatIdr(paidOrderTotal)} />
              <InfoRow label="Folio total" value={formatIdr(folioTotal)} strong />
              <InfoRow label="Balance due" value={formatIdr(balanceDue)} strong />
            </div>
            {reservation.paymentNotes ? (
              <p className="mt-4 rounded-[22px] surface-inset p-4 text-sm font-semibold leading-6 text-white/58">
                {reservation.paymentNotes}
              </p>
            ) : null}
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

      {canViewPayments ? (
        <section className="mt-5 grid gap-5 xl:grid-cols-[1fr_380px]">
          <GlassCard variant="strong" className="p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="text-lg font-black text-white">Payment Ledger</h3>
                <p className="mt-1 text-sm font-semibold text-white/50">Posted, refund, adjustment, dan void audit untuk reservasi ini.</p>
              </div>
              <Link
                href="/payments"
                className="inline-flex min-h-10 items-center justify-center rounded-[16px] border border-[#29f1ff]/24 bg-[#29f1ff]/10 px-3 text-xs font-black text-[#b8fbff]"
              >
                Payment Board
              </Link>
            </div>
            <div className="mt-4 space-y-3">
              {reservation.paymentTransactions.map((transaction) => {
                const voidAction = voidPaymentTransactionAction.bind(null, transaction.id);
                const signedAmount = getPaymentTransactionSignedAmount(transaction);

                return (
                  <div key={transaction.id} className="rounded-[22px] surface-inset p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-mono text-sm font-black text-[#b8fbff]">{transaction.code}</p>
                          <StatusBadge label={paymentTransactionTypeLabels[transaction.type]} tone={paymentTransactionTypeTone[transaction.type]} />
                          <StatusBadge label={paymentTransactionStatusLabels[transaction.status]} tone={paymentTransactionStatusTone[transaction.status]} />
                        </div>
                        <p className="mt-2 text-xs font-semibold text-white/50">
                          {paymentMethodLabels[transaction.method]} - {formatDateId(transaction.postedAt)} - {transaction.recordedBy ?? "System"}
                        </p>
                        {transaction.reference || transaction.note || transaction.voidReason ? (
                          <p className="mt-2 max-w-3xl text-xs font-semibold leading-5 text-white/46">
                            {[transaction.reference, transaction.note, transaction.voidReason ? `Void: ${transaction.voidReason}` : null].filter(Boolean).join(" - ")}
                          </p>
                        ) : null}
                      </div>
                      <div className="min-w-[220px] text-left lg:text-right">
                        <p className={signedAmount < 0 ? "text-lg font-black text-amber-100" : "text-lg font-black text-white"}>
                          {formatIdr(signedAmount)}
                        </p>
                        {canManagePayments && transaction.status === PaymentTransactionStatus.POSTED ? (
                          <form action={voidAction} className="mt-3 grid gap-2 lg:ml-auto lg:max-w-[230px]">
                            <input type="hidden" name="returnTo" value={`/reservations/${reservation.id}`} />
                            <input
                              name="voidReason"
                              minLength={8}
                              required
                              placeholder="Void reason"
                              className="min-h-10 rounded-[16px] surface-field px-3 text-xs font-bold text-white outline-none placeholder:text-white/34"
                            />
                            <button className="min-h-10 rounded-[16px] border border-red-300/20 bg-red-500/10 px-3 text-xs font-black text-red-100">
                              Void Transaction
                            </button>
                          </form>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
              {reservation.paymentTransactions.length === 0 ? <EmptyLine label="Belum ada transaksi payment ledger untuk reservasi ini." /> : null}
            </div>
          </GlassCard>

          {canManagePayments ? (
            <GlassCard className="p-5">
              <h3 className="text-lg font-black text-white">Post Payment</h3>
              <p className="mt-1 text-sm font-semibold leading-6 text-white/50">Posting akan menyinkronkan paid amount dan status payment.</p>
              <form action={createPaymentTransactionAction} className="mt-5 space-y-4">
                <input type="hidden" name="reservationId" value={reservation.id} />
                <input type="hidden" name="returnTo" value={`/reservations/${reservation.id}`} />
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <SelectField name="type" label="Type" defaultValue={PaymentTransactionType.PAYMENT}>
                    {paymentTransactionTypeOrder.map((type) => (
                      <option key={type} value={type}>
                        {paymentTransactionTypeLabels[type]}
                      </option>
                    ))}
                  </SelectField>
                  <SelectField name="method" label="Method" defaultValue={PaymentMethod.BANK_TRANSFER}>
                    {paymentMethodOrder.map((method) => (
                      <option key={method} value={method}>
                        {paymentMethodLabels[method]}
                      </option>
                    ))}
                  </SelectField>
                </div>
                <FormTextField name="amount" label="Amount" type="number" min="1" required />
                <FormTextField name="reference" label="Reference" placeholder="Transfer ref, QRIS id, card approval..." />
                <FormTextArea name="note" label="Note" placeholder="Finance note" />
                <button className="gold-gradient min-h-11 w-full rounded-[22px] text-sm font-black text-[#041015]">
                  Post Transaction
                </button>
              </form>
            </GlassCard>
          ) : null}
        </section>
      ) : null}

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

function fieldClass() {
  return "mt-2 min-h-12 w-full rounded-[22px] surface-field px-4 text-sm font-semibold text-white outline-none transition placeholder:text-white/34 focus:border-[#29f1ff]/50";
}

function FormTextField(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string }) {
  const { label, ...inputProps } = props;
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-normal text-white/52">{label}</span>
      <input className={fieldClass()} {...inputProps} />
    </label>
  );
}

function FormTextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; name: string }) {
  const { label, ...textareaProps } = props;
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-normal text-white/52">{label}</span>
      <textarea className={`${fieldClass()} min-h-24 py-3`} {...textareaProps} />
    </label>
  );
}

function SelectField(props: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; name: string }) {
  const { label, children, ...selectProps } = props;
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-normal text-white/52">{label}</span>
      <select className={fieldClass()} {...selectProps}>
        {children}
      </select>
    </label>
  );
}
