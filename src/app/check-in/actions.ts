"use server";

import { format } from "date-fns";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  PaymentMethod,
  PaymentStatus,
  PaymentTransactionType,
  ReservationStatus,
  UnitStatus,
  UserRole,
} from "@/generated/prisma/enums";
import { activityActor, requirePermission } from "@/lib/action-guard";
import { redirectWithActionError } from "@/lib/action-feedback";
import { normalizeReservationPaymentInput } from "@/lib/payments";
import { getPrisma } from "@/lib/prisma";

const finalPaymentStatusValues = [
  PaymentStatus.PARTIAL,
  PaymentStatus.PAID,
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

const checkinSchema = z.object({
  paymentStatus: z.enum(finalPaymentStatusValues),
  amountPaid: z.coerce.number().min(0).default(0),
  paymentMethod: z.enum(paymentMethodValues).default(PaymentMethod.CASH),
  paymentReference: z.string().trim().max(120).optional(),
  overrideReason: z.string().trim().max(800).optional(),
  checkinNotes: z.string().trim().max(800).optional(),
});

function formDataObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function canUseManagerOverride(role: string) {
  return role === UserRole.OWNER || role === UserRole.MANAGER;
}

function appendCheckinNotes(existingNotes: string | null, checkinNotes?: string) {
  if (!checkinNotes) {
    return existingNotes;
  }

  return [existingNotes, `Check-in note: ${checkinNotes}`].filter(Boolean).join("\n\n");
}

async function createPaymentCode() {
  const prisma = getPrisma();
  const prefix = `PAY-${format(new Date(), "yyMMdd")}`;
  const count = await prisma.paymentTransaction.count({
    where: { code: { startsWith: prefix } },
  });

  return `${prefix}-${String(count + 1).padStart(4, "0")}`;
}

function getCheckinBlockers({
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
    hardBlocks.push("Reservasi harus berstatus Pending atau Confirmed untuk diproses check-in.");
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

  if (unitStatus !== UnitStatus.READY && unitStatus !== UnitStatus.AVAILABLE) {
    if (
      unitStatus === UnitStatus.DIRTY ||
      unitStatus === UnitStatus.CLEANING
    ) {
      overrideBlocks.push("Unit belum READY/AVAILABLE dan masih perlu konfirmasi manager.");
    }
  }

  return { hardBlocks, overrideBlocks };
}

function revalidateCheckinSurfaces(reservationId: string, unitId: string) {
  revalidatePath(`/check-in/${reservationId}`);
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
}

export async function completeCheckinWizardAction(reservationId: string, formData: FormData) {
  const session = await requirePermission("checkin:write");
  const actionPath = `/check-in/${reservationId}`;
  const parsedPayload = checkinSchema.safeParse(formDataObject(formData));

  if (!parsedPayload.success) {
    redirectWithActionError(actionPath, parsedPayload.error);
  }

  const payload = parsedPayload.data;
  const overrideRequested = formData.get("override") === "on";
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
    redirectWithActionError(actionPath, "Reservasi belum memiliki unit, check-in tidak dapat diproses.");
  }

  const { hardBlocks, overrideBlocks } = getCheckinBlockers({
    reservationStatus: reservation.status,
    unitStatus: reservation.unit.status,
  });

  if (hardBlocks.length > 0) {
    redirectWithActionError(actionPath, hardBlocks.join(" "));
  }

  const canOverride = canUseManagerOverride(session.role);

  if (overrideBlocks.length > 0) {
    if (!canOverride) {
      redirectWithActionError(actionPath, "Check-in membutuhkan override Owner/Manager.");
    }

    if (!overrideRequested || !payload.overrideReason || payload.overrideReason.length < 10) {
      redirectWithActionError(actionPath, "Alasan override wajib diisi minimal 10 karakter.");
    }
  }

  const nextAmountPaid = normalizeReservationPaymentInput({
    amountPaid: payload.amountPaid,
    paymentStatus: payload.paymentStatus,
    totalAmount: reservation.totalAmount,
  });
  const previousAmountPaid = Number(reservation.amountPaid);
  const paymentDelta = nextAmountPaid - previousAmountPaid;

  const reservationAfterCheckin = await prisma.reservation.update({
    where: { id: reservation.id },
    data: {
      status: ReservationStatus.CHECKED_IN,
      paymentStatus: payload.paymentStatus,
      amountPaid: String(nextAmountPaid),
      notes: appendCheckinNotes(reservation.notes, payload.checkinNotes),
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
        note: "Recorded during check-in wizard.",
        recordedBy: session.name,
      },
    });
  }

  await prisma.unit.update({
    where: { id: reservation.unitId },
    data: { status: UnitStatus.OCCUPIED },
  });

  await prisma.activityLog.create({
    data: {
      ...activityActor(session),
      action: "reservation.checked_in",
      entityType: "Reservation",
      entityId: reservation.id,
      description:
        overrideBlocks.length > 0
          ? `${session.name} checked in ${reservation.guest.fullName} for ${reservation.bookingCode} with manager override.`
          : `${session.name} checked in ${reservation.guest.fullName} for ${reservation.bookingCode}.`,
      metadata: {
        previousStatus: reservation.status,
        paymentStatus: payload.paymentStatus,
        amountPaid: nextAmountPaid,
        paymentDelta,
        unitId: reservation.unitId,
        unitStatusBefore: reservation.unit.status,
        overrideUsed: overrideBlocks.length > 0,
        overrideReason: overrideBlocks.length > 0 ? payload.overrideReason : null,
        overrideBlocks,
      },
    },
  });

  revalidateCheckinSurfaces(reservationAfterCheckin.id, reservation.unitId);
  redirect(`/check-in/${reservation.id}?done=1`);
}
