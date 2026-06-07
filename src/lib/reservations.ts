import { differenceInCalendarDays, format } from "date-fns";
import {
  ReservationStatus,
  UnitStatus,
  type BookingSource,
  type PaymentStatus,
} from "@/generated/prisma/enums";
import { getPrisma } from "@/lib/prisma";

export const activeReservationStatuses = [
  ReservationStatus.PENDING,
  ReservationStatus.CONFIRMED,
  ReservationStatus.CHECKED_IN,
] as const;

export function parseStayDate(date: string, hour: 11 | 14) {
  return new Date(`${date}T${String(hour).padStart(2, "0")}:00:00+08:00`);
}

export function formatDateInput(date: Date) {
  return format(date, "yyyy-MM-dd");
}

export function countNights(checkInDate: Date, checkOutDate: Date) {
  return Math.max(1, differenceInCalendarDays(checkOutDate, checkInDate));
}

export function calculateReservationTotal(roomRate: number, nights: number, discount: number) {
  return Math.max(0, Math.round(roomRate * nights - discount));
}

export async function assertUnitAvailable({
  unitId,
  checkInDate,
  checkOutDate,
  currentReservationId,
  currentBlockId,
  propertyId,
}: {
  unitId: string;
  checkInDate: Date;
  checkOutDate: Date;
  currentReservationId?: string;
  currentBlockId?: string;
  propertyId: string;
}) {
  const prisma = getPrisma();
  const unit = await prisma.unit.findFirst({
    where: { id: unitId, propertyId },
  });

  if (!unit) {
    throw new Error("Unit tidak ditemukan.");
  }

  if (unit.status === UnitStatus.MAINTENANCE || unit.status === UnitStatus.OUT_OF_ORDER) {
    throw new Error("Unit sedang maintenance atau out of order.");
  }

  const overlap = await prisma.reservation.findFirst({
    where: {
      unitId,
      id: currentReservationId ? { not: currentReservationId } : undefined,
      status: { in: [...activeReservationStatuses] },
      checkInDate: { lt: checkOutDate },
      checkOutDate: { gt: checkInDate },
    },
    select: {
      bookingCode: true,
      checkInDate: true,
      checkOutDate: true,
    },
  });

  if (overlap) {
    throw new Error(`Unit overlap dengan booking ${overlap.bookingCode}.`);
  }

  const block = await prisma.unitBlock.findFirst({
    where: {
      unitId,
      id: currentBlockId ? { not: currentBlockId } : undefined,
      startDate: { lt: checkOutDate },
      endDate: { gt: checkInDate },
    },
    select: {
      reason: true,
      startDate: true,
      endDate: true,
      type: true,
    },
  });

  if (block) {
    throw new Error(`Unit diblokir untuk ${block.reason}.`);
  }

  return unit;
}

export async function getAvailableUnitIds({
  propertyId,
  checkInDate,
  checkOutDate,
  currentReservationId,
  currentBlockId,
}: {
  propertyId: string;
  checkInDate: Date;
  checkOutDate: Date;
  currentReservationId?: string;
  currentBlockId?: string;
}) {
  const prisma = getPrisma();
  const blockedReservations = await prisma.reservation.findMany({
    where: {
      id: currentReservationId ? { not: currentReservationId } : undefined,
      unit: { propertyId },
      status: { in: [...activeReservationStatuses] },
      checkInDate: { lt: checkOutDate },
      checkOutDate: { gt: checkInDate },
    },
    select: { unitId: true },
  });

  const blockedUnitIds = new Set(blockedReservations.map((reservation) => reservation.unitId).filter(Boolean));
  const blockedCalendarUnits = await prisma.unitBlock.findMany({
    where: {
      id: currentBlockId ? { not: currentBlockId } : undefined,
      unit: { propertyId },
      startDate: { lt: checkOutDate },
      endDate: { gt: checkInDate },
    },
    select: { unitId: true },
  });

  for (const block of blockedCalendarUnits) {
    blockedUnitIds.add(block.unitId);
  }

  const units = await prisma.unit.findMany({
    where: {
      propertyId,
      status: { notIn: [UnitStatus.MAINTENANCE, UnitStatus.OUT_OF_ORDER] },
    },
    select: { id: true },
  });

  return new Set(units.map((unit) => unit.id).filter((id) => !blockedUnitIds.has(id)));
}

export function isBookingSource(value: string): value is BookingSource {
  return ["DIRECT_WEBSITE", "WHATSAPP", "WALK_IN", "BOOKING_COM", "AIRBNB", "AGODA", "TRAVEL_AGENT", "OTHER"].includes(value);
}

export function isPaymentStatus(value: string): value is PaymentStatus {
  return ["UNPAID", "PARTIAL", "PAID", "REFUNDED"].includes(value);
}
