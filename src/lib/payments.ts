import {
  PaymentStatus,
  PaymentTransactionStatus,
  PaymentTransactionType,
} from "@/generated/prisma/enums";

export function normalizeMoney(value: unknown) {
  const amount = Number(value ?? 0);

  if (!Number.isFinite(amount)) {
    return 0;
  }

  return Math.max(0, Math.round(amount));
}

export function calculateBalanceDue(totalAmount: unknown, amountPaid: unknown) {
  return Math.max(0, normalizeMoney(totalAmount) - normalizeMoney(amountPaid));
}

export function getInvoiceNumber({
  bookingCode,
  invoiceNumber,
}: {
  bookingCode: string;
  invoiceNumber?: string | null;
}) {
  return invoiceNumber?.trim() || `INV-${bookingCode}`;
}

export function normalizeReservationPaymentInput({
  amountPaid,
  paymentStatus,
  totalAmount,
}: {
  amountPaid: unknown;
  paymentStatus: PaymentStatus;
  totalAmount: unknown;
}) {
  const total = normalizeMoney(totalAmount);
  const paid = normalizeMoney(amountPaid);

  if (paymentStatus === PaymentStatus.PAID) {
    return total;
  }

  if (paymentStatus === PaymentStatus.UNPAID || paymentStatus === PaymentStatus.REFUNDED) {
    return 0;
  }

  return Math.min(paid, total);
}

export function getReservationPaidAmount({
  amountPaid,
  paymentStatus,
  totalAmount,
}: {
  amountPaid: unknown;
  paymentStatus: PaymentStatus;
  totalAmount: unknown;
}) {
  const total = normalizeMoney(totalAmount);
  const paid = normalizeMoney(amountPaid);

  if (paymentStatus === PaymentStatus.REFUNDED) {
    return 0;
  }

  if (paymentStatus === PaymentStatus.PAID && paid === 0) {
    return total;
  }

  return Math.min(paid, total);
}

export function getOrderPaidAmount({
  paymentStatus,
  total,
}: {
  paymentStatus: PaymentStatus;
  total: unknown;
}) {
  return paymentStatus === PaymentStatus.PAID ? normalizeMoney(total) : 0;
}

export function getPaymentTransactionSignedAmount({
  amount,
  status,
  type,
}: {
  amount: unknown;
  status: PaymentTransactionStatus;
  type: PaymentTransactionType;
}) {
  if (status === PaymentTransactionStatus.VOIDED) {
    return 0;
  }

  const normalized = normalizeMoney(amount);

  if (type === PaymentTransactionType.REFUND) {
    return -normalized;
  }

  return normalized;
}

export function getLedgerNetAmount(
  transactions: Array<{
    amount: unknown;
    status: PaymentTransactionStatus;
    type: PaymentTransactionType;
  }>,
) {
  return Math.max(0, transactions.reduce((sum, transaction) => sum + getPaymentTransactionSignedAmount(transaction), 0));
}

export function derivePaymentStatusFromAmount({
  amountPaid,
  hasRefund = false,
  totalAmount,
}: {
  amountPaid: unknown;
  hasRefund?: boolean;
  totalAmount: unknown;
}) {
  const paid = normalizeMoney(amountPaid);
  const total = normalizeMoney(totalAmount);

  if (paid <= 0) {
    return hasRefund ? PaymentStatus.REFUNDED : PaymentStatus.UNPAID;
  }

  if (paid >= total) {
    return PaymentStatus.PAID;
  }

  return PaymentStatus.PARTIAL;
}
