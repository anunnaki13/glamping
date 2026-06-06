"use server";

import { addHours, format } from "date-fns";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  HousekeepingStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  PaymentTransactionType,
  Priority,
  ReservationStatus,
  UnitStatus,
} from "@/generated/prisma/enums";
import { activityActor, requirePermission } from "@/lib/action-guard";
import { redirectWithActionError } from "@/lib/action-feedback";
import { normalizeReservationPaymentInput } from "@/lib/payments";
import { getPrisma } from "@/lib/prisma";

const paymentStatusValues = [
  PaymentStatus.UNPAID,
  PaymentStatus.PARTIAL,
  PaymentStatus.PAID,
  PaymentStatus.REFUNDED,
] as const;

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

const checkoutSchema = z.object({
  paymentStatus: z.enum(paymentStatusValues),
  amountPaid: z.coerce.number().min(0).default(0),
  paymentMethod: z.enum(paymentMethodValues).default(PaymentMethod.CASH),
  paymentReference: z.string().trim().max(120).optional(),
  checkoutNotes: z.string().trim().max(800).optional(),
});

function formDataObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

async function createPaymentCode() {
  const prisma = getPrisma();
  const prefix = `PAY-${format(new Date(), "yyMMdd")}`;
  const count = await prisma.paymentTransaction.count({
    where: { code: { startsWith: prefix } },
  });

  return `${prefix}-${String(count + 1).padStart(4, "0")}`;
}

async function ensureCheckoutCleaningTask({
  unitId,
  bookingCode,
  guestName,
}: {
  unitId: string;
  bookingCode: string;
  guestName: string;
}) {
  const prisma = getPrisma();
  const openTask = await prisma.housekeepingTask.findFirst({
    where: {
      unitId,
      taskType: "Checkout Cleaning",
      status: {
        in: [
          HousekeepingStatus.DIRTY,
          HousekeepingStatus.ASSIGNED,
          HousekeepingStatus.IN_PROGRESS,
          HousekeepingStatus.INSPECTION,
          HousekeepingStatus.BLOCKED,
        ],
      },
    },
  });

  if (openTask) {
    return openTask;
  }

  return prisma.housekeepingTask.create({
    data: {
      unitId,
      taskType: "Checkout Cleaning",
      status: HousekeepingStatus.DIRTY,
      priority: Priority.HIGH,
      dueAt: addHours(new Date(), 4),
      notes: `Generated from checkout ${bookingCode} for ${guestName}.`,
    },
  });
}

function appendCheckoutNotes(existingNotes: string | null, checkoutNotes?: string) {
  if (!checkoutNotes) {
    return existingNotes;
  }

  return [existingNotes, `Checkout note: ${checkoutNotes}`].filter(Boolean).join("\n\n");
}

function revalidateCheckoutSurfaces(reservationId: string, unitId: string) {
  revalidatePath(`/check-out/${reservationId}`);
  revalidatePath(`/reservations/${reservationId}`);
  revalidatePath(`/reservations/${reservationId}/invoice`);
  revalidatePath("/payments");
  revalidatePath("/reservations");
  revalidatePath("/calendar");
  revalidatePath("/housekeeping");
  revalidatePath("/units");
  revalidatePath(`/units/${unitId}`);
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  revalidatePath("/orders");
}

export async function completeCheckoutWizardAction(reservationId: string, formData: FormData) {
  const session = await requirePermission("checkin:write");
  const actionPath = `/check-out/${reservationId}`;
  const parsedPayload = checkoutSchema.safeParse(formDataObject(formData));

  if (!parsedPayload.success) {
    redirectWithActionError(actionPath, parsedPayload.error);
  }

  const payload = parsedPayload.data;
  const prisma = getPrisma();

  const reservation = await prisma.reservation.findFirst({
    where: {
      id: reservationId,
      unit: { propertyId: session.propertyId },
    },
    include: {
      guest: true,
      unit: true,
    },
  });

  if (!reservation) {
    redirectWithActionError(actionPath, "Reservasi tidak ditemukan.");
  }

  if (!reservation.unitId || !reservation.unit) {
    redirectWithActionError(actionPath, "Reservasi belum memiliki unit, check-out tidak dapat diproses.");
  }

  if (reservation.status !== ReservationStatus.CHECKED_IN) {
    redirectWithActionError(actionPath, "Hanya reservasi yang sedang in-house yang bisa di-check-out.");
  }

  const nextAmountPaid = normalizeReservationPaymentInput({
    amountPaid: payload.amountPaid,
    paymentStatus: payload.paymentStatus,
    totalAmount: reservation.totalAmount,
  });
  const previousAmountPaid = Number(reservation.amountPaid);
  const paymentDelta = nextAmountPaid - previousAmountPaid;

  await prisma.reservation.update({
    where: { id: reservation.id },
    data: {
      status: ReservationStatus.CHECKED_OUT,
      paymentStatus: payload.paymentStatus,
      amountPaid: String(nextAmountPaid),
      notes: appendCheckoutNotes(reservation.notes, payload.checkoutNotes),
    },
  });

  if (paymentDelta !== 0) {
    await prisma.paymentTransaction.create({
      data: {
        code: await createPaymentCode(),
        propertyId: session.propertyId,
        reservationId: reservation.id,
        type: paymentDelta > 0 ? PaymentTransactionType.PAYMENT : PaymentTransactionType.REFUND,
        method: payload.paymentMethod,
        amount: String(Math.abs(paymentDelta)),
        reference: payload.paymentReference || null,
        note: "Recorded during check-out wizard.",
        recordedBy: session.name,
      },
    });
  }

  if (payload.paymentStatus === PaymentStatus.PAID) {
    await prisma.order.updateMany({
      where: {
        reservationId: reservation.id,
        status: { not: OrderStatus.CANCELLED },
        paymentStatus: { notIn: [PaymentStatus.PAID, PaymentStatus.REFUNDED] },
      },
      data: { paymentStatus: PaymentStatus.PAID },
    });
  }

  await prisma.unit.update({
    where: { id: reservation.unitId },
    data: { status: UnitStatus.DIRTY },
  });

  const housekeepingTask = await ensureCheckoutCleaningTask({
    unitId: reservation.unitId,
    bookingCode: reservation.bookingCode,
    guestName: reservation.guest.fullName,
  });

  await prisma.activityLog.create({
    data: {
      ...activityActor(session),
      action: "reservation.checked_out",
      entityType: "Reservation",
      entityId: reservation.id,
      description: `${session.name} completed checkout wizard for ${reservation.bookingCode}.`,
      metadata: {
        paymentStatus: payload.paymentStatus,
        amountPaid: nextAmountPaid,
        paymentDelta,
        unitId: reservation.unitId,
        housekeepingTaskId: housekeepingTask.id,
      },
    },
  });

  revalidateCheckoutSurfaces(reservation.id, reservation.unitId);
  redirect(`/check-out/${reservation.id}?done=1`);
}
