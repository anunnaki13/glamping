"use server";

import { format } from "date-fns";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  PaymentMethod,
  PaymentTransactionStatus,
  PaymentTransactionType,
} from "@/generated/prisma/enums";
import { activityActor, requirePermission } from "@/lib/action-guard";
import { redirectWithActionError, redirectWithActionSuccess } from "@/lib/action-feedback";
import {
  derivePaymentStatusFromAmount,
  getLedgerNetAmount,
  getPaymentTransactionSignedAmount,
} from "@/lib/payments";
import { getPrisma } from "@/lib/prisma";

const paymentMethodValues = [
  PaymentMethod.CASH,
  PaymentMethod.BANK_TRANSFER,
  PaymentMethod.CREDIT_CARD,
  PaymentMethod.DEBIT_CARD,
  PaymentMethod.QRIS,
  PaymentMethod.E_WALLET,
  PaymentMethod.OTA_COLLECT,
  PaymentMethod.OTHER,
] as const;

const paymentTransactionTypeValues = [
  PaymentTransactionType.PAYMENT,
  PaymentTransactionType.REFUND,
  PaymentTransactionType.ADJUSTMENT,
] as const;

const paymentTransactionSchema = z.object({
  reservationId: z.string().min(1),
  type: z.enum(paymentTransactionTypeValues).default(PaymentTransactionType.PAYMENT),
  method: z.enum(paymentMethodValues).default(PaymentMethod.CASH),
  amount: z.coerce.number().positive(),
  reference: z.string().trim().max(120).optional(),
  note: z.string().trim().max(800).optional(),
  returnTo: z.string().trim().optional(),
});

const voidPaymentSchema = z.object({
  voidReason: z.string().trim().min(8).max(800),
  returnTo: z.string().trim().optional(),
});

function formDataObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function safeReturnTo(value: string | undefined, fallback: string) {
  if (value?.startsWith("/") && !value.startsWith("//")) {
    return value;
  }

  return fallback;
}

async function createPaymentCode() {
  const prisma = getPrisma();
  const prefix = `PAY-${format(new Date(), "yyMMdd")}`;
  const count = await prisma.paymentTransaction.count({
    where: { code: { startsWith: prefix } },
  });

  return `${prefix}-${String(count + 1).padStart(4, "0")}`;
}

function revalidatePaymentSurfaces(reservationId: string) {
  revalidatePath("/payments");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  revalidatePath("/reservations");
  revalidatePath(`/reservations/${reservationId}`);
  revalidatePath(`/reservations/${reservationId}/invoice`);
}

async function syncReservationPaymentState(reservationId: string) {
  const prisma = getPrisma();
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      paymentTransactions: {
        where: { orderId: null },
      },
    },
  });

  if (!reservation) {
    return;
  }

  const ledgerPaid = getLedgerNetAmount(reservation.paymentTransactions);
  const amountPaid = Math.min(ledgerPaid, Number(reservation.totalAmount));
  const hasRefund = reservation.paymentTransactions.some(
    (transaction) =>
      transaction.status === PaymentTransactionStatus.POSTED &&
      transaction.type === PaymentTransactionType.REFUND,
  );

  await prisma.reservation.update({
    where: { id: reservation.id },
    data: {
      amountPaid: String(amountPaid),
      paymentStatus: derivePaymentStatusFromAmount({
        amountPaid,
        hasRefund,
        totalAmount: reservation.totalAmount,
      }),
    },
  });
}

export async function createPaymentTransactionAction(formData: FormData) {
  const session = await requirePermission("payment:write");
  const parsedPayload = paymentTransactionSchema.safeParse(formDataObject(formData));
  const fallbackPath = "/payments";

  if (!parsedPayload.success) {
    redirectWithActionError(fallbackPath, parsedPayload.error);
  }

  const payload = parsedPayload.data;
  const returnTo = safeReturnTo(payload.returnTo, fallbackPath);
  const prisma = getPrisma();
  const reservation = await prisma.reservation.findFirst({
    where: {
      id: payload.reservationId,
      unit: { propertyId: session.propertyId },
    },
    include: {
      guest: true,
      unit: true,
    },
  });

  if (!reservation) {
    redirectWithActionError(returnTo, "Reservasi tidak ditemukan.");
  }

  const transaction = await prisma.paymentTransaction.create({
    data: {
      code: await createPaymentCode(),
      propertyId: session.propertyId,
      reservationId: reservation.id,
      type: payload.type,
      method: payload.method,
      amount: String(payload.amount),
      reference: payload.reference || null,
      note: payload.note || null,
      recordedBy: session.name,
    },
  });

  await syncReservationPaymentState(reservation.id);

  await prisma.activityLog.create({
    data: {
      ...activityActor(session),
      action: "payment_transaction.posted",
      entityType: "PaymentTransaction",
      entityId: transaction.id,
      description: `${session.name} posted ${transaction.code} for ${reservation.bookingCode}.`,
      metadata: {
        bookingCode: reservation.bookingCode,
        type: transaction.type,
        method: transaction.method,
        amount: getPaymentTransactionSignedAmount(transaction),
      },
    },
  });

  revalidatePaymentSurfaces(reservation.id);
  redirectWithActionSuccess(returnTo, `Transaksi ${transaction.code} berhasil diposting.`);
}

export async function voidPaymentTransactionAction(transactionId: string, formData: FormData) {
  const session = await requirePermission("payment:write");
  const parsedPayload = voidPaymentSchema.safeParse(formDataObject(formData));
  const fallbackPath = "/payments";

  if (!parsedPayload.success) {
    redirectWithActionError(fallbackPath, parsedPayload.error);
  }

  const payload = parsedPayload.data;
  const returnTo = safeReturnTo(payload.returnTo, fallbackPath);
  const prisma = getPrisma();
  const transaction = await prisma.paymentTransaction.findFirst({
    where: {
      id: transactionId,
      propertyId: session.propertyId,
    },
    include: {
      reservation: true,
    },
  });

  if (!transaction) {
    redirectWithActionError(returnTo, "Transaksi pembayaran tidak ditemukan.");
  }

  if (transaction.status === PaymentTransactionStatus.VOIDED) {
    redirectWithActionError(returnTo, "Transaksi ini sudah voided.");
  }

  const voidedTransaction = await prisma.paymentTransaction.update({
    where: { id: transaction.id },
    data: {
      status: PaymentTransactionStatus.VOIDED,
      voidReason: payload.voidReason,
    },
  });

  await syncReservationPaymentState(transaction.reservationId);

  await prisma.activityLog.create({
    data: {
      ...activityActor(session),
      action: "payment_transaction.voided",
      entityType: "PaymentTransaction",
      entityId: transaction.id,
      description: `${session.name} voided ${transaction.code}.`,
      metadata: {
        bookingCode: transaction.reservation.bookingCode,
        reason: payload.voidReason,
      },
    },
  });

  revalidatePaymentSurfaces(transaction.reservationId);
  redirectWithActionSuccess(returnTo, `Transaksi ${voidedTransaction.code} berhasil di-void.`);
}
