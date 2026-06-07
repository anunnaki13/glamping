"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  HousekeepingStatus,
  Priority,
  ReservationStatus,
  UnitBlockType,
} from "@/generated/prisma/enums";
import { activityActor, requirePermission } from "@/lib/action-guard";
import { redirectWithActionError, redirectWithActionSuccess } from "@/lib/action-feedback";
import { unitBlockTypeLabels } from "@/lib/labels";
import { normalizeReservationPaymentInput } from "@/lib/payments";
import { getPrisma } from "@/lib/prisma";
import {
  assertUnitAvailable,
  calculateReservationTotal,
  countNights,
  formatDateInput,
  parseStayDate,
} from "@/lib/reservations";

const dateInputSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const calendarBlockTypeValues = [
  UnitBlockType.MAINTENANCE,
  UnitBlockType.PRIVATE_HOLD,
  UnitBlockType.OUT_OF_SERVICE,
  UnitBlockType.OWNER_STAY,
] as const;
const editableCalendarReservationStatuses = [
  ReservationStatus.PENDING,
  ReservationStatus.CONFIRMED,
] as const;

const rescheduleSchema = z.object({
  reservationId: z.string().min(1),
  unitId: z.string().min(1),
  checkInDate: dateInputSchema,
  checkOutDate: dateInputSchema,
  calendarStart: dateInputSchema.optional(),
});

const createBlockSchema = z.object({
  unitId: z.string().min(1),
  startDate: dateInputSchema,
  endDate: dateInputSchema,
  type: z.enum(calendarBlockTypeValues).default(UnitBlockType.MAINTENANCE),
  reason: z.string().trim().min(3).max(120),
  notes: z.string().trim().max(500).optional(),
  calendarStart: dateInputSchema.optional(),
});

const releaseBlockSchema = z.object({
  blockId: z.string().min(1),
  calendarStart: dateInputSchema.optional(),
});

function formDataObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function calendarPath(start?: string) {
  return start && dateInputSchema.safeParse(start).success ? `/calendar?start=${start}` : "/calendar";
}

function assertDateRange(checkInDate: Date, checkOutDate: Date) {
  if (checkOutDate <= checkInDate) {
    throw new Error("Tanggal akhir harus setelah tanggal mulai.");
  }
}

function canRescheduleReservation(status: ReservationStatus) {
  return editableCalendarReservationStatuses.includes(status as (typeof editableCalendarReservationStatuses)[number]);
}

function revalidateCalendarSurfaces(reservationId?: string, unitId?: string | null) {
  revalidatePath("/calendar");
  revalidatePath("/reservations");
  revalidatePath("/units");
  revalidatePath("/housekeeping");
  revalidatePath("/reports");

  if (reservationId) {
    revalidatePath(`/reservations/${reservationId}`);
    revalidatePath(`/reservations/${reservationId}/edit`);
  }

  if (unitId) {
    revalidatePath(`/units/${unitId}`);
  }
}

export async function rescheduleReservationFromCalendarAction(formData: FormData) {
  const session = await requirePermission("reservation:write");
  const parsedPayload = rescheduleSchema.safeParse(formDataObject(formData));
  const fallbackPath = calendarPath(String(formData.get("calendarStart") ?? ""));

  if (!parsedPayload.success) {
    redirectWithActionError(fallbackPath, parsedPayload.error);
  }

  const payload = parsedPayload.data;
  const actionPath = calendarPath(payload.calendarStart);
  const checkInDate = parseStayDate(payload.checkInDate, 14);
  const checkOutDate = parseStayDate(payload.checkOutDate, 11);

  try {
    assertDateRange(checkInDate, checkOutDate);
  } catch (error) {
    redirectWithActionError(actionPath, error);
  }

  const prisma = getPrisma();
  const existing = await prisma.reservation.findFirst({
    where: {
      id: payload.reservationId,
      unit: {
        propertyId: session.propertyId,
      },
    },
    include: {
      guest: true,
      unit: true,
    },
  });

  if (!existing) {
    redirectWithActionError(actionPath, "Reservasi tidak ditemukan.");
  }

  if (!canRescheduleReservation(existing.status)) {
    redirectWithActionError(actionPath, "Hanya reservasi Pending atau Confirmed yang bisa di-reschedule dari calendar.");
  }

  await assertUnitAvailableOrRedirect(actionPath, {
    propertyId: session.propertyId,
    unitId: payload.unitId,
    checkInDate,
    checkOutDate,
    currentReservationId: existing.id,
  });

  const nights = countNights(checkInDate, checkOutDate);
  const totalAmount = calculateReservationTotal(Number(existing.roomRate), nights, Number(existing.discount));
  const amountPaid = normalizeReservationPaymentInput({
    amountPaid: Number(existing.amountPaid),
    paymentStatus: existing.paymentStatus,
    totalAmount,
  });

  const reservation = await prisma.reservation.update({
    where: { id: existing.id },
    data: {
      unitId: payload.unitId,
      checkInDate,
      checkOutDate,
      totalAmount: String(totalAmount),
      amountPaid: String(amountPaid),
    },
    include: { unit: true },
  });

  await prisma.activityLog.create({
    data: {
      ...activityActor(session),
      action: "reservation.rescheduled",
      entityType: "Reservation",
      entityId: reservation.id,
      description: `${session.name} rescheduled ${reservation.bookingCode} from calendar.`,
      metadata: {
        previousUnit: existing.unit?.code ?? null,
        nextUnit: reservation.unit?.code ?? null,
        checkInDate: formatDateInput(reservation.checkInDate),
        checkOutDate: formatDateInput(reservation.checkOutDate),
      },
    },
  });

  revalidateCalendarSurfaces(reservation.id, existing.unitId);
  revalidateCalendarSurfaces(reservation.id, reservation.unitId);
  redirectWithActionSuccess(actionPath, `Reservasi ${reservation.bookingCode} berhasil di-reschedule.`);
}

export async function createUnitBlockFromCalendarAction(formData: FormData) {
  const session = await requirePermission("unit:write");
  const parsedPayload = createBlockSchema.safeParse(formDataObject(formData));
  const fallbackPath = calendarPath(String(formData.get("calendarStart") ?? ""));

  if (!parsedPayload.success) {
    redirectWithActionError(fallbackPath, parsedPayload.error);
  }

  const payload = parsedPayload.data;
  const actionPath = calendarPath(payload.calendarStart);
  const startDate = parseStayDate(payload.startDate, 14);
  const endDate = parseStayDate(payload.endDate, 11);

  try {
    assertDateRange(startDate, endDate);
  } catch (error) {
    redirectWithActionError(actionPath, error);
  }

  const prisma = getPrisma();
  const unit = await prisma.unit.findFirst({
    where: { id: payload.unitId, propertyId: session.propertyId },
  });

  if (!unit) {
    redirectWithActionError(actionPath, "Unit tidak ditemukan.");
  }

  const overlappingReservation = await prisma.reservation.findFirst({
    where: {
      unitId: unit.id,
      status: { in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN] },
      checkInDate: { lt: endDate },
      checkOutDate: { gt: startDate },
    },
    select: { bookingCode: true },
  });

  if (overlappingReservation) {
    redirectWithActionError(actionPath, `Tidak bisa block karena overlap dengan booking ${overlappingReservation.bookingCode}.`);
  }

  const overlappingBlock = await prisma.unitBlock.findFirst({
    where: {
      unitId: unit.id,
      startDate: { lt: endDate },
      endDate: { gt: startDate },
    },
    select: { reason: true },
  });

  if (overlappingBlock) {
    redirectWithActionError(actionPath, `Unit sudah punya block aktif: ${overlappingBlock.reason}.`);
  }

  const block = await prisma.unitBlock.create({
    data: {
      unitId: unit.id,
      startDate,
      endDate,
      type: payload.type,
      reason: payload.reason,
      notes: payload.notes || null,
      createdBy: session.name,
    },
  });

  if (payload.type === UnitBlockType.MAINTENANCE || payload.type === UnitBlockType.OUT_OF_SERVICE) {
    await prisma.housekeepingTask.create({
      data: {
        unitId: unit.id,
        taskType: `Calendar ${unitBlockTypeLabels[payload.type]}`,
        status: HousekeepingStatus.BLOCKED,
        priority: payload.type === UnitBlockType.OUT_OF_SERVICE ? Priority.URGENT : Priority.HIGH,
        dueAt: startDate,
        notes: `Calendar block ${block.id}: ${payload.reason}${payload.notes ? ` - ${payload.notes}` : ""}`,
      },
    });
  }

  await prisma.activityLog.create({
    data: {
      ...activityActor(session),
      action: "unit_block.created",
      entityType: "UnitBlock",
      entityId: block.id,
      description: `${session.name} blocked ${unit.code} for ${payload.reason}.`,
      metadata: {
        unitCode: unit.code,
        type: payload.type,
        startDate: formatDateInput(block.startDate),
        endDate: formatDateInput(block.endDate),
      },
    },
  });

  revalidateCalendarSurfaces(undefined, unit.id);
  redirectWithActionSuccess(actionPath, `${unit.code} berhasil diblok untuk ${payload.reason}.`);
}

export async function releaseUnitBlockFromCalendarAction(formData: FormData) {
  const session = await requirePermission("unit:write");
  const parsedPayload = releaseBlockSchema.safeParse(formDataObject(formData));
  const fallbackPath = calendarPath(String(formData.get("calendarStart") ?? ""));

  if (!parsedPayload.success) {
    redirectWithActionError(fallbackPath, parsedPayload.error);
  }

  const payload = parsedPayload.data;
  const actionPath = calendarPath(payload.calendarStart);
  const prisma = getPrisma();
  const block = await prisma.unitBlock.findFirst({
    where: {
      id: payload.blockId,
      unit: { propertyId: session.propertyId },
    },
    include: { unit: true },
  });

  if (!block) {
    redirectWithActionError(actionPath, "Calendar block tidak ditemukan.");
  }

  await prisma.housekeepingTask.deleteMany({
    where: {
      unitId: block.unitId,
      notes: { contains: `Calendar block ${block.id}` },
    },
  });

  await prisma.unitBlock.delete({ where: { id: block.id } });

  await prisma.activityLog.create({
    data: {
      ...activityActor(session),
      action: "unit_block.released",
      entityType: "UnitBlock",
      entityId: block.id,
      description: `${session.name} released calendar block ${block.reason} for ${block.unit.code}.`,
    },
  });

  revalidateCalendarSurfaces(undefined, block.unitId);
  redirectWithActionSuccess(actionPath, `Block ${block.reason} untuk ${block.unit.code} berhasil dibuka.`);
}

async function assertUnitAvailableOrRedirect(
  path: string,
  args: Parameters<typeof assertUnitAvailable>[0],
) {
  try {
    await assertUnitAvailable(args);
  } catch (error) {
    redirectWithActionError(path, error);
  }
}
