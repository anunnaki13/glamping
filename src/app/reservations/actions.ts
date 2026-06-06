"use server";

import { revalidatePath } from "next/cache";
import { addHours, format } from "date-fns";
import { z } from "zod";
import {
  BookingSource,
  HousekeepingStatus,
  PaymentStatus,
  Priority,
  ReservationStatus,
  UnitStatus,
} from "@/generated/prisma/enums";
import { activityActor, requirePermission } from "@/lib/action-guard";
import { redirectWithActionError, redirectWithActionSuccess } from "@/lib/action-feedback";
import { getPrisma } from "@/lib/prisma";
import {
  assertUnitAvailable,
  calculateReservationTotal,
  countNights,
  parseStayDate,
} from "@/lib/reservations";

const reservationStatusValues = [
  ReservationStatus.PENDING,
  ReservationStatus.CONFIRMED,
  ReservationStatus.CHECKED_IN,
  ReservationStatus.CHECKED_OUT,
  ReservationStatus.CANCELLED,
  ReservationStatus.NO_SHOW,
] as const;

const bookingSourceValues = [
  BookingSource.DIRECT_WEBSITE,
  BookingSource.WHATSAPP,
  BookingSource.WALK_IN,
  BookingSource.BOOKING_COM,
  BookingSource.AIRBNB,
  BookingSource.AGODA,
  BookingSource.TRAVEL_AGENT,
  BookingSource.OTHER,
] as const;

const paymentStatusValues = [
  PaymentStatus.UNPAID,
  PaymentStatus.PARTIAL,
  PaymentStatus.PAID,
  PaymentStatus.REFUNDED,
] as const;

const preArrivalReservationStatuses = [
  ReservationStatus.PENDING,
  ReservationStatus.CONFIRMED,
] as const;

const terminalPreArrivalReservationStatuses = [
  ReservationStatus.CANCELLED,
  ReservationStatus.NO_SHOW,
] as const;

const reservationFormSchema = z.object({
  guestId: z.string().min(1),
  unitId: z.string().min(1),
  checkInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  adults: z.coerce.number().int().min(1).max(12),
  children: z.coerce.number().int().min(0).max(12),
  status: z.enum(reservationStatusValues).default(ReservationStatus.PENDING),
  source: z.enum(bookingSourceValues).default(BookingSource.WHATSAPP),
  paymentStatus: z.enum(paymentStatusValues).default(PaymentStatus.UNPAID),
  roomRate: z.coerce.number().min(0),
  discount: z.coerce.number().min(0).default(0),
  notes: z.string().trim().optional(),
});

function formDataObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

async function createBookingCode() {
  const prisma = getPrisma();
  const prefix = `NE${format(new Date(), "yyMMdd")}`;
  const count = await prisma.reservation.count({
    where: {
      bookingCode: {
        startsWith: prefix,
      },
    },
  });

  return `${prefix}-${String(count + 1).padStart(4, "0")}`;
}

function parseReservationPayload(formData: FormData) {
  const parsed = reservationFormSchema.parse(formDataObject(formData));
  const checkInDate = parseStayDate(parsed.checkInDate, 14);
  const checkOutDate = parseStayDate(parsed.checkOutDate, 11);

  if (checkOutDate <= checkInDate) {
    throw new Error("Tanggal checkout harus setelah check-in.");
  }

  const nights = countNights(checkInDate, checkOutDate);
  const totalAmount = calculateReservationTotal(parsed.roomRate, nights, parsed.discount);

  return {
    ...parsed,
    checkInDate,
    checkOutDate,
    nights,
    totalAmount,
  };
}

function parseReservationPayloadOrRedirect(formData: FormData, path: string) {
  try {
    return parseReservationPayload(formData);
  } catch (error) {
    redirectWithActionError(path, error);
  }
}

function runReservationGuard(path: string, guard: () => void) {
  try {
    guard();
  } catch (error) {
    redirectWithActionError(path, error);
  }
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

function isPreArrivalReservationStatus(status: ReservationStatus) {
  return preArrivalReservationStatuses.includes(status as (typeof preArrivalReservationStatuses)[number]);
}

function isEditablePreArrivalTargetStatus(status: ReservationStatus) {
  return (
    isPreArrivalReservationStatus(status) ||
    terminalPreArrivalReservationStatuses.includes(status as (typeof terminalPreArrivalReservationStatuses)[number])
  );
}

function assertCreateReservationStatus(status: ReservationStatus) {
  if (!isPreArrivalReservationStatus(status)) {
    throw new Error("Reservasi baru harus dibuat sebagai Pending atau Confirmed. Gunakan flow check-in untuk menjadikan in-house.");
  }
}

function assertEditableReservationStatusTransition(currentStatus: ReservationStatus, nextStatus: ReservationStatus) {
  if (currentStatus === nextStatus) {
    return;
  }

  if (
    isPreArrivalReservationStatus(currentStatus) &&
    isEditablePreArrivalTargetStatus(nextStatus)
  ) {
    return;
  }

  throw new Error("Perubahan status ini harus memakai flow check-in/check-out atau tidak diizinkan dari halaman edit.");
}

function assertEditableReservationFields(
  existing: {
    guestId: string;
    unitId: string | null;
    checkInDate: Date;
    checkOutDate: Date;
    status: ReservationStatus;
  },
  next: {
    guestId: string;
    unitId: string;
    checkInDate: Date;
    checkOutDate: Date;
  },
) {
  if (isPreArrivalReservationStatus(existing.status)) {
    return;
  }

  const stayIdentityChanged =
    existing.guestId !== next.guestId ||
    existing.unitId !== next.unitId ||
    existing.checkInDate.getTime() !== next.checkInDate.getTime() ||
    existing.checkOutDate.getTime() !== next.checkOutDate.getTime();

  if (stayIdentityChanged) {
    throw new Error("Guest, unit, dan tanggal hanya bisa diubah sebelum check-in.");
  }
}

function assertReservationCanBeCancelled(status: ReservationStatus) {
  if (!isPreArrivalReservationStatus(status)) {
    throw new Error("Hanya reservasi Pending atau Confirmed yang bisa dibatalkan.");
  }
}

function revalidateReservationSurfaces(reservationId?: string, unitId?: string | null) {
  revalidatePath("/reservations");
  revalidatePath("/calendar");
  revalidatePath("/housekeeping");
  revalidatePath("/units");

  if (reservationId) {
    revalidatePath(`/reservations/${reservationId}`);
    revalidatePath(`/reservations/${reservationId}/edit`);
  }

  if (unitId) {
    revalidatePath(`/units/${unitId}`);
  }
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

async function syncReservationOperationalState({
  reservationId,
  unitId,
  status,
  bookingCode,
  guestName,
}: {
  reservationId: string;
  unitId: string | null;
  status: ReservationStatus;
  bookingCode: string;
  guestName: string;
}) {
  if (!unitId) {
    return;
  }

  const prisma = getPrisma();

  if (status === ReservationStatus.CHECKED_IN) {
    await prisma.unit.update({
      where: { id: unitId },
      data: { status: UnitStatus.OCCUPIED },
    });
  }

  if (status === ReservationStatus.CHECKED_OUT) {
    await prisma.unit.update({
      where: { id: unitId },
      data: { status: UnitStatus.DIRTY },
    });
    await ensureCheckoutCleaningTask({ unitId, bookingCode, guestName });
  }

  revalidateReservationSurfaces(reservationId, unitId);
}

export async function createReservationAction(formData: FormData) {
  const session = await requirePermission("reservation:write");
  const actionPath = "/reservations/new";
  const payload = parseReservationPayloadOrRedirect(formData, actionPath);
  runReservationGuard(actionPath, () => assertCreateReservationStatus(payload.status));
  const prisma = getPrisma();

  const guest = await prisma.guest.findUnique({ where: { id: payload.guestId } });
  if (!guest) {
    redirectWithActionError(actionPath, "Guest tidak ditemukan.");
  }

  await assertUnitAvailableOrRedirect(actionPath, {
    propertyId: session.propertyId,
    unitId: payload.unitId,
    checkInDate: payload.checkInDate,
    checkOutDate: payload.checkOutDate,
  });

  const bookingCode = await createBookingCode();
  const reservation = await prisma.reservation.create({
    data: {
      bookingCode,
      guestId: payload.guestId,
      unitId: payload.unitId,
      checkInDate: payload.checkInDate,
      checkOutDate: payload.checkOutDate,
      adults: payload.adults,
      children: payload.children,
      status: payload.status,
      source: payload.source,
      paymentStatus: payload.paymentStatus,
      roomRate: String(payload.roomRate),
      discount: String(payload.discount),
      totalAmount: String(payload.totalAmount),
      notes: payload.notes || null,
    },
  });

  await syncReservationOperationalState({
    reservationId: reservation.id,
    unitId: reservation.unitId,
    status: reservation.status,
    bookingCode: reservation.bookingCode,
    guestName: guest.fullName,
  });

  await prisma.activityLog.create({
    data: {
      ...activityActor(session),
      action: "reservation.created",
      entityType: "Reservation",
      entityId: reservation.id,
      description: `${session.name} created reservation ${reservation.bookingCode}.`,
    },
  });

  revalidatePath("/reservations");
  revalidatePath("/calendar");
  redirectWithActionSuccess(`/reservations/${reservation.id}`, `Reservasi ${reservation.bookingCode} berhasil dibuat.`);
}

export async function updateReservationAction(reservationId: string, formData: FormData) {
  const session = await requirePermission("reservation:write");
  const actionPath = `/reservations/${reservationId}/edit`;
  const payload = parseReservationPayloadOrRedirect(formData, actionPath);
  const prisma = getPrisma();

  const existing = await prisma.reservation.findFirst({
    where: {
      id: reservationId,
      unit: {
        propertyId: session.propertyId,
      },
    },
  });

  if (!existing) {
    redirectWithActionError("/reservations", "Reservasi tidak ditemukan.");
  }

  runReservationGuard(actionPath, () => assertEditableReservationStatusTransition(existing.status, payload.status));
  runReservationGuard(actionPath, () => assertEditableReservationFields(existing, payload));

  await assertUnitAvailableOrRedirect(actionPath, {
    propertyId: session.propertyId,
    unitId: payload.unitId,
    checkInDate: payload.checkInDate,
    checkOutDate: payload.checkOutDate,
    currentReservationId: reservationId,
  });

  const reservation = await prisma.reservation.update({
    where: { id: reservationId },
    data: {
      guestId: payload.guestId,
      unitId: payload.unitId,
      checkInDate: payload.checkInDate,
      checkOutDate: payload.checkOutDate,
      adults: payload.adults,
      children: payload.children,
      status: payload.status,
      source: payload.source,
      paymentStatus: payload.paymentStatus,
      roomRate: String(payload.roomRate),
      discount: String(payload.discount),
      totalAmount: String(payload.totalAmount),
      notes: payload.notes || null,
    },
    include: { guest: true },
  });

  await syncReservationOperationalState({
    reservationId: reservation.id,
    unitId: reservation.unitId,
    status: reservation.status,
    bookingCode: reservation.bookingCode,
    guestName: reservation.guest.fullName,
  });

  await prisma.activityLog.create({
    data: {
      ...activityActor(session),
      action: "reservation.updated",
      entityType: "Reservation",
      entityId: reservation.id,
      description: `${session.name} updated reservation ${reservation.bookingCode}.`,
    },
  });

  revalidateReservationSurfaces(reservation.id, reservation.unitId);
  redirectWithActionSuccess(`/reservations/${reservation.id}`, `Reservasi ${reservation.bookingCode} berhasil diperbarui.`);
}

export async function cancelReservationAction(reservationId: string) {
  const session = await requirePermission("reservation:write");
  const prisma = getPrisma();
  const existing = await prisma.reservation.findFirst({
    where: {
      id: reservationId,
      unit: {
        propertyId: session.propertyId,
      },
    },
  });

  if (!existing) {
    redirectWithActionError("/reservations", "Reservasi tidak ditemukan.");
  }

  runReservationGuard(`/reservations/${reservationId}`, () => assertReservationCanBeCancelled(existing.status));

  const reservation = await prisma.reservation.update({
    where: { id: reservationId },
    data: { status: ReservationStatus.CANCELLED },
  });

  await prisma.activityLog.create({
    data: {
      ...activityActor(session),
      action: "reservation.cancelled",
      entityType: "Reservation",
      entityId: reservation.id,
      description: `${session.name} cancelled reservation ${reservation.bookingCode}.`,
    },
  });

  revalidateReservationSurfaces(reservation.id, reservation.unitId);
  redirectWithActionSuccess(`/reservations/${reservation.id}`, `Reservasi ${reservation.bookingCode} berhasil dibatalkan.`);
}
