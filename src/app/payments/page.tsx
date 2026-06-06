import type { ReactNode } from "react";
import Link from "next/link";
import {
  Banknote,
  CreditCard,
  ReceiptText,
  RotateCcw,
  Search,
} from "lucide-react";
import {
  PaymentMethod,
  PaymentTransactionStatus,
  PaymentTransactionType,
  ReservationStatus,
  UserRole,
} from "@/generated/prisma/enums";
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
import { formatDateTimeId, formatIdr } from "@/lib/formatters";
import {
  paymentMethodLabels,
  paymentTransactionStatusLabels,
  paymentTransactionStatusTone,
  paymentTransactionTypeLabels,
  paymentTransactionTypeTone,
} from "@/lib/labels";
import {
  calculateBalanceDue,
  getPaymentTransactionSignedAmount,
  getReservationPaidAmount,
} from "@/lib/payments";
import { hasPermission } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";

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

type PaymentsPageProps = {
  searchParams: Promise<{ q?: string } & ActionFeedbackSearchParams>;
};

export default async function PaymentsPage({ searchParams }: PaymentsPageProps) {
  const session = await requirePagePermission("payment:read");
  const role = session.role as UserRole;
  const canWrite = hasPermission(role, "payment:write");
  const params = await searchParams;
  const feedback = getActionFeedback(params);
  const query = params.q?.trim();
  const prisma = getPrisma();
  const [transactions, reservations] = await Promise.all([
    prisma.paymentTransaction.findMany({
      where: {
        propertyId: session.propertyId,
        OR: query
          ? [
              { code: { contains: query, mode: "insensitive" } },
              { reference: { contains: query, mode: "insensitive" } },
              { reservation: { bookingCode: { contains: query, mode: "insensitive" } } },
              { reservation: { guest: { fullName: { contains: query, mode: "insensitive" } } } },
            ]
          : undefined,
      },
      include: {
        reservation: {
          include: {
            guest: true,
            unit: true,
          },
        },
      },
      orderBy: { postedAt: "desc" },
      take: 120,
    }),
    prisma.reservation.findMany({
      where: {
        unit: { propertyId: session.propertyId },
        status: {
          in: [
            ReservationStatus.PENDING,
            ReservationStatus.CONFIRMED,
            ReservationStatus.CHECKED_IN,
          ],
        },
      },
      include: {
        guest: true,
        unit: true,
      },
      orderBy: { checkInDate: "asc" },
      take: 120,
    }),
  ]);

  const postedTransactions = transactions.filter((transaction) => transaction.status === PaymentTransactionStatus.POSTED);
  const incoming = postedTransactions
    .filter((transaction) => transaction.type !== PaymentTransactionType.REFUND)
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const refunds = postedTransactions
    .filter((transaction) => transaction.type === PaymentTransactionType.REFUND)
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const net = postedTransactions.reduce((sum, transaction) => sum + getPaymentTransactionSignedAmount(transaction), 0);
  const outstanding = reservations.reduce((sum, reservation) => {
    const paid = getReservationPaidAmount({
      amountPaid: reservation.amountPaid,
      paymentStatus: reservation.paymentStatus,
      totalAmount: reservation.totalAmount,
    });

    return sum + calculateBalanceDue(reservation.totalAmount, paid);
  }, 0);

  return (
    <AppShell>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-bold text-[#29f1ff]">Finance</p>
          <h2 className="mt-2 text-3xl font-black tracking-normal text-white">Payments</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/62">
            Ledger transaksi untuk deposit, settlement room, refund, adjustment, reference payment, dan void audit.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge label={`${postedTransactions.length} posted`} tone="success" dot />
          <StatusBadge label={`${transactions.filter((transaction) => transaction.status === PaymentTransactionStatus.VOIDED).length} voided`} tone="muted" dot />
        </div>
      </div>

      <ActionFeedbackBanner feedback={feedback} />

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Incoming" value={formatIdr(incoming)} icon={<Banknote className="size-5" />} tone="success" />
        <MetricCard title="Refunds" value={formatIdr(refunds)} icon={<RotateCcw className="size-5" />} tone="warning" />
        <MetricCard title="Net Posted" value={formatIdr(net)} icon={<CreditCard className="size-5" />} tone="info" />
        <MetricCard title="Active Outstanding" value={formatIdr(outstanding)} icon={<ReceiptText className="size-5" />} tone="danger" />
      </section>

      <section className="mt-6 grid gap-5 2xl:grid-cols-[1fr_420px]">
        <GlassCard variant="strong" className="overflow-hidden p-0">
          <div className="border-b border-white/10 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-lg font-black text-white">Payment Ledger</h3>
                <p className="mt-1 text-sm font-semibold text-white/50">Posted transaction menjadi sumber audit untuk paid amount reservasi.</p>
              </div>
              <form className="flex min-h-12 items-center gap-3 rounded-full border border-white/12 bg-black/18 px-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                <Search className="size-5 text-[#29f1ff]" />
                <input
                  name="q"
                  defaultValue={query}
                  placeholder="Search code, booking, guest, reference..."
                  className="w-full min-w-0 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-white/36 lg:w-80"
                />
              </form>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] border-separate border-spacing-y-2 p-4 text-left">
              <thead>
                <tr className="text-xs font-black uppercase tracking-normal text-white/42">
                  <th className="px-4 py-2">Transaction</th>
                  <th className="px-4 py-2">Reservation</th>
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2">Method</th>
                  <th className="px-4 py-2">Amount</th>
                  <th className="px-4 py-2">Reference</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Audit</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => {
                  const voidAction = voidPaymentTransactionAction.bind(null, transaction.id);
                  const signedAmount = getPaymentTransactionSignedAmount(transaction);

                  return (
                    <tr key={transaction.id} className="surface-row text-sm font-semibold text-white/76">
                      <td className="rounded-l-[20px] px-4 py-4">
                        <p className="font-mono text-sm font-black text-[#b8fbff]">{transaction.code}</p>
                        <p className="mt-1 text-xs text-white/45">{formatDateTimeId(transaction.postedAt)}</p>
                      </td>
                      <td className="px-4 py-4">
                        <Link href={`/reservations/${transaction.reservation.id}`} className="font-black text-white">
                          {transaction.reservation.bookingCode}
                        </Link>
                        <p className="mt-1 text-xs text-white/50">
                          {transaction.reservation.guest.fullName} - {transaction.reservation.unit?.code ?? "No unit"}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge label={paymentTransactionTypeLabels[transaction.type]} tone={paymentTransactionTypeTone[transaction.type]} />
                      </td>
                      <td className="px-4 py-4">{paymentMethodLabels[transaction.method]}</td>
                      <td className={signedAmount < 0 ? "px-4 py-4 font-black text-amber-100" : "px-4 py-4 font-black text-white"}>
                        {formatIdr(signedAmount)}
                      </td>
                      <td className="px-4 py-4">
                        <p className="max-w-[180px] truncate">{transaction.reference ?? "-"}</p>
                        {transaction.note ? <p className="mt-1 max-w-[220px] truncate text-xs text-white/45">{transaction.note}</p> : null}
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge label={paymentTransactionStatusLabels[transaction.status]} tone={paymentTransactionStatusTone[transaction.status]} />
                        {transaction.voidReason ? <p className="mt-1 max-w-[200px] truncate text-xs text-white/45">{transaction.voidReason}</p> : null}
                      </td>
                      <td className="rounded-r-[20px] px-4 py-4">
                        {canWrite && transaction.status === PaymentTransactionStatus.POSTED ? (
                          <form action={voidAction} className="grid gap-2">
                            <input type="hidden" name="returnTo" value="/payments" />
                            <input
                              name="voidReason"
                              minLength={8}
                              required
                              placeholder="Void reason"
                              className="min-h-10 rounded-[16px] surface-field px-3 text-xs font-bold text-white outline-none placeholder:text-white/34"
                            />
                            <button className="min-h-10 rounded-[16px] border border-red-300/20 bg-red-500/10 px-3 text-xs font-black text-red-100">
                              Void
                            </button>
                          </form>
                        ) : (
                          <span className="surface-chip inline-flex min-h-10 items-center rounded-[16px] px-3 text-xs font-black text-white/58">
                            {transaction.recordedBy ?? "System"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {transactions.length === 0 ? (
              <div className="m-5 rounded-[22px] surface-inset p-8 text-center text-sm font-semibold text-white/58">
                Belum ada transaksi pembayaran yang cocok.
              </div>
            ) : null}
          </div>
        </GlassCard>

        <aside className="space-y-5">
          {canWrite ? (
            <GlassCard className="p-5">
              <h3 className="text-lg font-black text-white">Post Transaction</h3>
              <p className="mt-1 text-sm font-semibold leading-6 text-white/50">
                Posting akan langsung memperbarui amount paid dan status payment reservasi.
              </p>
              <form action={createPaymentTransactionAction} className="mt-5 space-y-4">
                <input type="hidden" name="returnTo" value="/payments" />
                <SelectField name="reservationId" label="Reservation" required>
                  {reservations.map((reservation) => {
                    const paid = getReservationPaidAmount({
                      amountPaid: reservation.amountPaid,
                      paymentStatus: reservation.paymentStatus,
                      totalAmount: reservation.totalAmount,
                    });
                    const due = calculateBalanceDue(reservation.totalAmount, paid);

                    return (
                      <option key={reservation.id} value={reservation.id}>
                        {reservation.bookingCode} - {reservation.guest.fullName} - Due {formatIdr(due)}
                      </option>
                    );
                  })}
                </SelectField>
                <div className="grid gap-3 sm:grid-cols-2">
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
                <TextField name="amount" label="Amount" type="number" min="1" required />
                <TextField name="reference" label="Reference" placeholder="Transfer ref, QRIS id, card approval..." />
                <TextareaField name="note" label="Note" placeholder="Payment context or finance note" />
                <button className="gold-gradient min-h-11 w-full rounded-[22px] text-sm font-black text-[#041015]">
                  Post Transaction
                </button>
              </form>
            </GlassCard>
          ) : null}
        </aside>
      </section>
    </AppShell>
  );
}

function MetricCard({
  title,
  value,
  icon,
  tone,
}: {
  title: string;
  value: string;
  icon: ReactNode;
  tone: "warning" | "info" | "danger" | "success";
}) {
  const toneClass = {
    warning: "bg-amber-400/12 text-amber-100",
    info: "bg-sky-400/12 text-sky-100",
    danger: "bg-red-400/12 text-red-100",
    success: "bg-emerald-400/12 text-emerald-100",
  };

  return (
    <GlassCard className="p-5">
      <div className={`grid size-11 place-items-center rounded-[22px] ${toneClass[tone]}`}>{icon}</div>
      <p className="mt-4 text-sm font-bold text-white/58">{title}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </GlassCard>
  );
}

function fieldClass() {
  return "mt-2 min-h-12 w-full rounded-[22px] surface-field px-4 text-sm font-semibold text-white outline-none transition placeholder:text-white/34 focus:border-[#29f1ff]/50";
}

function TextField(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string }) {
  const { label, ...inputProps } = props;
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-normal text-white/52">{label}</span>
      <input className={fieldClass()} {...inputProps} />
    </label>
  );
}

function TextareaField(props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; name: string }) {
  const { label, ...textareaProps } = props;
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-normal text-white/52">{label}</span>
      <textarea className={`${fieldClass()} min-h-28 py-3`} {...textareaProps} />
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
