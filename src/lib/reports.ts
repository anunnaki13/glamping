import { addDays, differenceInCalendarDays, endOfDay, startOfDay, subDays } from "date-fns";
import {
  BookingSource,
  HousekeepingStatus,
  OrderStatus,
  PaymentStatus,
  PosCategory,
  Priority,
  RequestStatus,
  RequestType,
  ReservationStatus,
  UnitStatus,
} from "@/generated/prisma/enums";
import {
  bookingSourceLabels,
  housekeepingStatusLabels,
  paymentStatusLabels,
  posCategoryLabels,
  priorityLabels,
  requestStatusLabels,
  requestTypeLabels,
  unitStatusLabels,
} from "@/lib/labels";
import { getPrisma } from "@/lib/prisma";

export type ReportRange = {
  from: Date;
  to: Date;
  fromInput: string;
  toInput: string;
};

export type ReportData = Awaited<ReturnType<typeof getReportData>>;

const propertyTimeZone = "Asia/Makassar";

export function parseReportRange(params?: { from?: string; to?: string }): ReportRange {
  const todayInput = formatDateInput(new Date());
  const fallbackFromInput = formatDateInput(subDays(parseDateStart(todayInput), 30));
  const requestedFromInput = isDateInput(params?.from) ? params.from : fallbackFromInput;
  const requestedToInput = isDateInput(params?.to) ? params.to : todayInput;
  const requestedFrom = parseDateStart(requestedFromInput);
  const requestedTo = parseDateStart(requestedToInput);
  const fromInput = requestedFrom <= requestedTo ? requestedFromInput : requestedToInput;
  const toInput = requestedFrom <= requestedTo ? requestedToInput : requestedFromInput;

  return {
    from: parseDateStart(fromInput),
    to: parseDateEnd(toInput),
    fromInput,
    toInput,
  };
}

export async function getReportData(propertyId: string, range: ReportRange) {
  const prisma = getPrisma();
  const [units, reservations, orders, serviceRequests, housekeepingTasks] = await Promise.all([
    prisma.unit.findMany({
      where: { propertyId },
      include: { unitType: true },
      orderBy: { code: "asc" },
    }),
    prisma.reservation.findMany({
      where: {
        unit: { propertyId },
        OR: [
          { checkInDate: { lte: range.to }, checkOutDate: { gte: range.from } },
          { createdAt: { gte: range.from, lte: range.to } },
        ],
      },
      include: {
        guest: true,
        unit: true,
      },
      orderBy: { checkInDate: "asc" },
    }),
    prisma.order.findMany({
      where: {
        reservation: { unit: { propertyId } },
        createdAt: { gte: range.from, lte: range.to },
      },
      include: {
        items: { include: { item: true } },
        reservation: { include: { guest: true, unit: true } },
        guest: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.serviceRequest.findMany({
      where: {
        createdAt: { lte: range.to },
        OR: [
          { reservation: { unit: { propertyId } } },
          { reservationId: null },
        ],
      },
      include: {
        guest: true,
        reservation: {
          include: { guest: true, unit: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.housekeepingTask.findMany({
      where: { unit: { propertyId } },
      include: { unit: true },
      orderBy: [{ status: "asc" }, { dueAt: "asc" }],
    }),
  ]);

  const days = enumerateDays(range.from, range.to);
  const totalUnits = units.length;
  const roomNightsAvailable = totalUnits * days.length;
  const dailyRows = days.map((day) => {
    const dayEnd = endOfDay(day);
    const occupied = reservations.filter((reservation) =>
      isActiveReservationStatus(reservation.status) &&
      reservation.checkInDate <= dayEnd &&
      reservation.checkOutDate > day,
    ).length;
    const reservationRevenue = reservations
      .filter((reservation) => isInRange(reservation.createdAt, day, dayEnd) && isRevenueReservationStatus(reservation.status))
      .reduce((sum, reservation) => sum + Number(reservation.totalAmount), 0);
    const orderRevenue = orders
      .filter((order) => isInRange(order.createdAt, day, dayEnd) && order.status !== OrderStatus.CANCELLED)
      .reduce((sum, order) => sum + Number(order.total), 0);
    const requestsCreated = serviceRequests.filter((request) => isInRange(request.createdAt, day, dayEnd)).length;

    return {
      date: day,
      label: formatShortDate(day),
      occupied,
      occupancy: totalUnits > 0 ? Math.round((occupied / totalUnits) * 100) : 0,
      reservationRevenue,
      orderRevenue,
      totalRevenue: reservationRevenue + orderRevenue,
      requestsCreated,
    };
  });

  const occupiedRoomNights = dailyRows.reduce((sum, row) => sum + row.occupied, 0);
  const reservationRevenue = reservations
    .filter((reservation) => isInRange(reservation.createdAt, range.from, range.to) && isRevenueReservationStatus(reservation.status))
    .reduce((sum, reservation) => sum + Number(reservation.totalAmount), 0);
  const orderRevenue = orders
    .filter((order) => order.status !== OrderStatus.CANCELLED)
    .reduce((sum, order) => sum + Number(order.total), 0);
  const totalRevenue = reservationRevenue + orderRevenue;
  const occupancyRate = roomNightsAvailable > 0 ? Math.round((occupiedRoomNights / roomNightsAvailable) * 100) : 0;
  const adr = occupiedRoomNights > 0 ? Math.round(reservationRevenue / occupiedRoomNights) : 0;
  const revPar = roomNightsAvailable > 0 ? Math.round(totalRevenue / roomNightsAvailable) : 0;
  const requestsInRange = serviceRequests.filter((request) => isInRange(request.createdAt, range.from, range.to));
  const completedRequests = requestsInRange.filter((request) => request.status === RequestStatus.COMPLETED).length;
  const slaCompletionRate = requestsInRange.length > 0 ? Math.round((completedRequests / requestsInRange.length) * 100) : 0;

  return {
    range,
    summary: {
      totalUnits,
      periodDays: days.length,
      roomNightsAvailable,
      occupiedRoomNights,
      occupancyRate,
      reservationRevenue,
      orderRevenue,
      totalRevenue,
      adr,
      revPar,
      totalReservations: reservations.filter((reservation) => isInRange(reservation.createdAt, range.from, range.to)).length,
      openRequests: serviceRequests.filter((request) => request.status !== RequestStatus.COMPLETED && request.status !== RequestStatus.CANCELLED).length,
      slaCompletionRate,
    },
    dailyRows,
    bookingSources: aggregateEnum(Object.values(BookingSource), reservations.filter((reservation) => isInRange(reservation.createdAt, range.from, range.to)), "source", bookingSourceLabels),
    paymentStatus: aggregateEnum(Object.values(PaymentStatus), reservations.filter((reservation) => isInRange(reservation.createdAt, range.from, range.to)), "paymentStatus", paymentStatusLabels),
    unitStatus: aggregateEnum(Object.values(UnitStatus), units, "status", unitStatusLabels),
    requestStatus: aggregateEnum(Object.values(RequestStatus), requestsInRange, "status", requestStatusLabels),
    requestTypes: aggregateEnum(Object.values(RequestType), requestsInRange, "type", requestTypeLabels),
    requestPriority: aggregateEnum(Object.values(Priority), requestsInRange, "priority", priorityLabels),
    housekeepingStatus: aggregateEnum(Object.values(HousekeepingStatus), housekeepingTasks, "status", housekeepingStatusLabels),
    topItems: aggregateOrderItems(orders),
    posCategories: aggregatePosCategories(orders),
    recentReservations: reservations.filter((reservation) => isInRange(reservation.createdAt, range.from, range.to)).slice(0, 10),
    recentRequests: requestsInRange.slice(0, 10),
    recentOrders: orders.slice(0, 10),
  };
}

function isDateInput(value?: string): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function parseDateStart(value: string) {
  return new Date(`${value}T00:00:00+08:00`);
}

function parseDateEnd(value: string) {
  return new Date(`${value}T23:59:59.999+08:00`);
}

export function formatDateInput(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: propertyTimeZone,
    year: "numeric",
  }).format(date);
}

function enumerateDays(from: Date, to: Date) {
  const days = [];
  const totalDays = Math.max(1, differenceInCalendarDays(to, from) + 1);

  for (let index = 0; index < totalDays; index += 1) {
    days.push(startOfDay(addDays(from, index)));
  }

  return days;
}

function isInRange(value: Date, from: Date, to: Date) {
  return value >= from && value <= to;
}

function isActiveReservationStatus(status: ReservationStatus) {
  return (
    status === ReservationStatus.PENDING ||
    status === ReservationStatus.CONFIRMED ||
    status === ReservationStatus.CHECKED_IN
  );
}

function isRevenueReservationStatus(status: ReservationStatus) {
  return (
    status === ReservationStatus.PENDING ||
    status === ReservationStatus.CONFIRMED ||
    status === ReservationStatus.CHECKED_IN ||
    status === ReservationStatus.CHECKED_OUT
  );
}

function aggregateEnum<T extends string, Row extends Record<Key, T>, Key extends keyof Row>(
  values: T[],
  rows: Row[],
  key: Key,
  labels?: Partial<Record<T, string>>,
) {
  return values.map((value) => ({
    key: value,
    label: labels?.[value] ?? value,
    count: rows.filter((row) => row[key] === value).length,
  }));
}

function aggregateOrderItems(orders: Array<{ status: OrderStatus; items: Array<{ name: string; quantity: number; total: unknown }> }>) {
  const totals = new Map<string, { name: string; quantity: number; revenue: number }>();

  orders
    .filter((order) => order.status !== OrderStatus.CANCELLED)
    .flatMap((order) => order.items)
    .forEach((item) => {
      const current = totals.get(item.name) ?? { name: item.name, quantity: 0, revenue: 0 };
      current.quantity += item.quantity;
      current.revenue += Number(item.total);
      totals.set(item.name, current);
    });

  return Array.from(totals.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
}

function aggregatePosCategories(orders: Array<{ status: OrderStatus; items: Array<{ item?: { category?: PosCategory }; total: unknown }> }>) {
  const totals = new Map<PosCategory, { key: PosCategory; label: string; revenue: number }>();

  Object.values(PosCategory).forEach((category) => {
    totals.set(category, { key: category, label: posCategoryLabels[category], revenue: 0 });
  });

  orders
    .filter((order) => order.status !== OrderStatus.CANCELLED)
    .flatMap((order) => order.items)
    .forEach((item) => {
      const category = item.item?.category;

      if (!category) {
        return;
      }

      const current = totals.get(category);

      if (current) {
        current.revenue += Number(item.total);
      }
    });

  return Array.from(totals.values()).filter((item) => item.revenue > 0);
}

function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", timeZone: propertyTimeZone }).format(date);
}
