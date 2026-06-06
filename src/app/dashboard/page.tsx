import { addDays, differenceInCalendarDays, endOfDay, startOfDay, subDays } from "date-fns";
import {
  HousekeepingStatus,
  PaymentStatus,
  Priority,
  RequestStatus,
  RequestType,
  ReservationStatus,
  UnitStatus,
  UserRole,
} from "@/generated/prisma/enums";
import { DashboardContent, type DashboardData, type DashboardIconKey } from "@/components/dashboard/dashboard-content";
import { AppShell } from "@/components/layout/app-shell";
import { ActionFeedbackBanner } from "@/components/ui/action-feedback-banner";
import { getActionFeedback, type ActionFeedbackSearchParams } from "@/lib/action-feedback";
import { formatCompactIdr, formatDateId, formatIdr } from "@/lib/formatters";
import {
  bookingSourceLabels,
  priorityLabels,
  reservationStatusLabels,
  reservationStatusTone,
  unitStatusLabels,
} from "@/lib/labels";
import { getPrisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/action-guard";
import {
  canViewOperationalFinancialData,
  canViewStayFinancialData,
  hasPermission,
} from "@/lib/permissions";

export const dynamic = "force-dynamic";

function isActiveReservationStatus(status: ReservationStatus) {
  return (
    status === ReservationStatus.PENDING ||
    status === ReservationStatus.CONFIRMED ||
    status === ReservationStatus.CHECKED_IN
  );
}

function trendDirection(condition: boolean): "up" | "flat" {
  return condition ? "up" : "flat";
}

const unitStatusColors: Record<UnitStatus, string> = {
  AVAILABLE: "#29f1ff",
  READY: "#68d391",
  OCCUPIED: "#4fb8ff",
  DIRTY: "#f6b94b",
  CLEANING: "#a989ff",
  MAINTENANCE: "#ff6b5f",
  OUT_OF_ORDER: "#7d8996",
};

const requestIcon: Record<RequestType, DashboardIconKey> = {
  HOUSEKEEPING: "bed",
  ROOM_SERVICE: "home",
  FNB_ORDER: "clipboard",
  TRANSPORT: "home",
  ACTIVITY: "sparkles",
  MAINTENANCE: "wrench",
  SPECIAL_REQUEST: "clipboard",
  COMPLAINT: "wrench",
  OTHER: "clipboard",
};

type DashboardPageProps = {
  searchParams: Promise<ActionFeedbackSearchParams>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const session = await requirePagePermission("dashboard:read");
  const feedback = getActionFeedback(await searchParams);
  const role = session.role as UserRole;
  const prisma = getPrisma();
  const today = startOfDay(new Date());
  const todayEnd = endOfDay(today);
  const rangeStart = subDays(today, 6);
  const rangeEnd = addDays(todayEnd, 7);

  const [units, reservations, orders, serviceRequests, housekeepingTasks] = await Promise.all([
    prisma.unit.findMany({
      where: { propertyId: session.propertyId },
      include: { unitType: true },
      orderBy: { code: "asc" },
    }),
    prisma.reservation.findMany({
      where: {
        unit: { propertyId: session.propertyId },
        OR: [
          { checkInDate: { lte: rangeEnd }, checkOutDate: { gte: rangeStart } },
          { createdAt: { gte: rangeStart } },
        ],
      },
      include: {
        guest: true,
        unit: true,
      },
      orderBy: { createdAt: "desc" },
      take: 140,
    }),
    prisma.order.findMany({
      where: {
        reservation: { unit: { propertyId: session.propertyId } },
        createdAt: { gte: rangeStart },
      },
      include: { items: true },
      orderBy: { createdAt: "desc" },
      take: 120,
    }),
    prisma.serviceRequest.findMany({
      where: {
        OR: [
          { reservation: { unit: { propertyId: session.propertyId } } },
          { reservationId: null },
        ],
      },
      include: {
        reservation: { include: { unit: true } },
        guest: true,
      },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      take: 80,
    }),
    prisma.housekeepingTask.findMany({
      where: {
        unit: { propertyId: session.propertyId },
        status: { not: HousekeepingStatus.READY },
      },
      include: { unit: true },
      orderBy: [{ priority: "desc" }, { dueAt: "asc" }],
      take: 40,
    }),
  ]);

  const totalUnits = units.length;
  const activeToday = reservations.filter((reservation) =>
    isActiveReservationStatus(reservation.status) &&
    reservation.checkInDate <= todayEnd &&
    reservation.checkOutDate > today,
  );
  const occupancyToday = totalUnits > 0 ? Math.round((activeToday.length / totalUnits) * 100) : 0;
  const todayReservationRevenue = reservations
    .filter((reservation) => isSameDay(reservation.createdAt, today))
    .reduce((sum, reservation) => sum + Number(reservation.totalAmount), 0);
  const todayOrderRevenue = orders
    .filter((order) => isSameDay(order.createdAt, today) && order.status !== "CANCELLED")
    .reduce((sum, order) => sum + Number(order.total), 0);
  const availableUnits = units.filter((unit) => unit.status === UnitStatus.AVAILABLE || unit.status === UnitStatus.READY).length;
  const openRequests = serviceRequests.filter((request) => request.status !== RequestStatus.COMPLETED && request.status !== RequestStatus.CANCELLED).length;
  const canViewFinancials = canViewOperationalFinancialData(role);
  const canViewStayFinancials = canViewStayFinancialData(role);
  const visibleRevenueToday = (canViewStayFinancials ? todayReservationRevenue : 0) + (canViewFinancials ? todayOrderRevenue : 0);
  const roomRevPar = totalUnits > 0 ? Math.round(todayReservationRevenue / totalUnits) : 0;
  const dashboardKpis: DashboardData["kpis"] = [
    {
      title: "Occupancy Today",
      value: `${occupancyToday}%`,
      trend: { value: `${activeToday.length} stays`, direction: trendDirection(occupancyToday > 65) },
      icon: "users",
      tone: "cyan",
    },
    ...(canViewFinancials
      ? [
          {
            title: canViewStayFinancials ? "Revenue Today" : "Order Revenue",
            value: formatCompactIdr(visibleRevenueToday),
            trend: { value: `${orders.length} orders`, direction: trendDirection(visibleRevenueToday > 0) },
            icon: "dollar" as const,
            tone: "violet" as const,
          },
        ]
      : [
          {
            title: "Open Requests",
            value: String(openRequests),
            trend: { value: `${serviceRequests.length} total`, direction: trendDirection(openRequests > 0) },
            icon: "wrench" as const,
            tone: "amber" as const,
          },
        ]),
    {
      title: "Bookings",
      value: String(reservations.filter((reservation) => isActiveReservationStatus(reservation.status)).length),
      trend: { value: `${openRequests} requests`, direction: trendDirection(openRequests > 0) },
      icon: "calendar",
      tone: "blue",
    },
    {
      title: "Available Units",
      value: `${availableUnits} / ${totalUnits}`,
      description: `${totalUnits > 0 ? Math.round((availableUnits / totalUnits) * 100) : 0}% tersedia`,
      icon: "home",
      tone: "green",
    },
    ...(canViewStayFinancials
      ? [
          {
            title: "RevPAR",
            value: formatCompactIdr(roomRevPar),
            trend: { value: `${housekeepingTasks.length} HK`, direction: trendDirection(housekeepingTasks.length === 0) },
            icon: "trend" as const,
            tone: "violet" as const,
          },
        ]
      : [
          {
            title: "HK Queue",
            value: String(housekeepingTasks.length),
            trend: { value: `${housekeepingTasks.filter((task) => task.priority === Priority.URGENT || task.priority === Priority.HIGH).length} priority`, direction: trendDirection(housekeepingTasks.length === 0) },
            icon: "bed" as const,
            tone: "teal" as const,
          },
        ]),
  ];

  const data: DashboardData = {
    kpis: dashboardKpis,
    canViewFinancials,
    financialTrendTitle: canViewStayFinancials ? "Revenue Trend" : "Order Revenue",
    occupancyTrend: buildOccupancyTrend({ today, unitsTotal: totalUnits, reservations }),
    revenueTrend: canViewFinancials
      ? buildRevenueTrend({ today, reservations: canViewStayFinancials ? reservations : [], orders })
      : [],
    requestTrend: buildRequestTrend({ today, serviceRequests }),
    unitStatus: buildUnitStatus(units),
    totalUnits,
    arrivals: reservations
      .filter((reservation) => isActiveReservationStatus(reservation.status) && reservation.checkInDate >= today && reservation.checkInDate <= addDays(todayEnd, 3))
      .sort((a, b) => a.checkInDate.getTime() - b.checkInDate.getTime())
      .slice(0, 4)
      .map((reservation) => ({
        time: formatTimeId(reservation.checkInDate),
        guest: reservation.guest.fullName,
        meta: `${reservation.adults + reservation.children} guests · ${Math.max(1, differenceInCalendarDays(reservation.checkOutDate, reservation.checkInDate))} nights`,
        unit: reservation.unit?.code ?? "Unassigned",
      })),
    reservations: reservations.slice(0, 4).map((reservation) => ({
      guest: reservation.guest.fullName,
      date: `${formatDateId(reservation.checkInDate)} - ${formatDateId(reservation.checkOutDate)}`,
      status: reservationStatusLabels[reservation.status],
      amount: canViewStayFinancials ? formatIdr(Number(reservation.totalAmount)) : null,
      tone: reservationStatusTone[reservation.status],
    })),
    serviceRequests: serviceRequests
      .filter((request) => request.status !== RequestStatus.COMPLETED && request.status !== RequestStatus.CANCELLED)
      .slice(0, 4)
      .map((request) => ({
        icon: requestIcon[request.type] ?? "clipboard",
        title: request.title,
        unit: request.reservation?.unit?.code ?? request.guest?.fullName ?? "Standalone",
        age: ageLabel(request.createdAt),
        priority: priorityLabel(request.priority),
      })),
    bookingSources: buildBookingSources(reservations),
    priorityTasks: buildPriorityTasks({
      serviceRequests,
      housekeepingTasks,
      reservations,
      includePaymentFollowups: canViewStayFinancials,
    }),
    quickActions: buildQuickActions(role),
  };

  return (
    <AppShell>
      <ActionFeedbackBanner feedback={feedback} />
      <DashboardContent data={data} />
    </AppShell>
  );
}

function buildQuickActions(role: UserRole): DashboardData["quickActions"] {
  const actions: DashboardData["quickActions"] = [];

  if (hasPermission(role, "reservation:write")) {
    actions.push({
      label: "Buat Reservasi",
      href: "/reservations/new",
      variant: "primary",
      icon: "plus",
    });
  }

  if (hasPermission(role, "request:write")) {
    actions.push({
      label: "Buat Request",
      href: "/service-requests",
      variant: actions.length === 0 ? "primary" : "secondary",
      icon: "wrench",
    });
  }

  if (hasPermission(role, "housekeeping:read")) {
    actions.push({
      label: "Lihat Housekeeping",
      href: "/housekeeping",
      variant: "secondary",
      icon: "sparkles",
    });
  }

  if (hasPermission(role, "pos:write")) {
    actions.push({
      label: "Buat Order",
      href: "/orders",
      variant: actions.length === 0 ? "primary" : "secondary",
      icon: "clipboard",
    });
  }

  return actions.slice(0, 3);
}

function buildOccupancyTrend({
  today,
  unitsTotal,
  reservations,
}: {
  today: Date;
  unitsTotal: number;
  reservations: Array<{ status: ReservationStatus; checkInDate: Date; checkOutDate: Date }>;
}) {
  return Array.from({ length: 7 }, (_, index) => {
    const day = subDays(today, 6 - index);
    const dayEnd = endOfDay(day);
    const occupied = reservations.filter((reservation) =>
      isActiveReservationStatus(reservation.status) &&
      reservation.checkInDate <= dayEnd &&
      reservation.checkOutDate > day,
    ).length;

    return {
      day: formatShortDate(day),
      value: unitsTotal > 0 ? Math.round((occupied / unitsTotal) * 100) : 0,
    };
  });
}

function buildRevenueTrend({
  today,
  reservations,
  orders,
}: {
  today: Date;
  reservations: Array<{ createdAt: Date; totalAmount: unknown }>;
  orders: Array<{ createdAt: Date; status: string; total: unknown }>;
}) {
  return Array.from({ length: 7 }, (_, index) => {
    const day = subDays(today, 6 - index);
    const reservationRevenue = reservations
      .filter((reservation) => isSameDay(reservation.createdAt, day))
      .reduce((sum, reservation) => sum + Number(reservation.totalAmount), 0);
    const orderRevenue = orders
      .filter((order) => isSameDay(order.createdAt, day) && order.status !== "CANCELLED")
      .reduce((sum, order) => sum + Number(order.total), 0);

    return {
      day: formatShortDate(day),
      value: Number(((reservationRevenue + orderRevenue) / 1_000_000).toFixed(1)),
    };
  });
}

function buildRequestTrend({
  today,
  serviceRequests,
}: {
  today: Date;
  serviceRequests: Array<{ createdAt: Date }>;
}) {
  return Array.from({ length: 7 }, (_, index) => {
    const day = subDays(today, 6 - index);

    return {
      day: formatShortDate(day),
      value: serviceRequests.filter((request) => isSameDay(request.createdAt, day)).length,
    };
  });
}

function buildUnitStatus(units: Array<{ status: UnitStatus }>) {
  return Object.values(UnitStatus)
    .map((status) => ({
      name: unitStatusLabels[status],
      value: units.filter((unit) => unit.status === status).length,
      color: unitStatusColors[status],
    }))
    .filter((item) => item.value > 0);
}

function buildBookingSources(reservations: Array<{ source: keyof typeof bookingSourceLabels }>) {
  return Object.entries(bookingSourceLabels)
    .map(([source, label]) => ({
      source: label,
      value: reservations.filter((reservation) => reservation.source === source).length,
    }))
    .filter((item) => item.value > 0);
}

function buildPriorityTasks({
  serviceRequests,
  housekeepingTasks,
  reservations,
  includePaymentFollowups,
}: {
  serviceRequests: Array<{ title: string; priority: Priority; status: RequestStatus }>;
  housekeepingTasks: Array<{ taskType: string; priority: Priority; unit: { code: string } }>;
  reservations: Array<{ bookingCode: string; paymentStatus: PaymentStatus; guest: { fullName: string } }>;
  includePaymentFollowups: boolean;
}) {
  const tasks: DashboardData["priorityTasks"] = [];

  serviceRequests
    .filter((request) => request.status !== RequestStatus.COMPLETED && request.status !== RequestStatus.CANCELLED)
    .filter((request) => request.priority === Priority.URGENT || request.priority === Priority.HIGH)
    .slice(0, 2)
    .forEach((request) => {
      tasks.push({ label: request.title, status: priorityLabels[request.priority], tone: request.priority === Priority.URGENT ? "danger" : "warning" });
    });

  housekeepingTasks.slice(0, 2).forEach((task) => {
    tasks.push({ label: `${task.unit.code}: ${task.taskType}`, status: priorityLabels[task.priority], tone: task.priority === Priority.URGENT ? "danger" : "warning" });
  });

  if (includePaymentFollowups) {
    reservations
      .filter((reservation) => reservation.paymentStatus !== PaymentStatus.PAID)
      .slice(0, 2)
      .forEach((reservation) => {
        tasks.push({ label: `Follow-up payment ${reservation.bookingCode} - ${reservation.guest.fullName}`, status: "Payment", tone: "warning" });
      });
  }

  return tasks.slice(0, 5);
}

function priorityLabel(priority: Priority): "Urgent" | "High" | "Medium" | "Low" {
  if (priority === Priority.URGENT) return "Urgent";
  if (priority === Priority.HIGH) return "High";
  if (priority === Priority.MEDIUM) return "Medium";
  return "Low";
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short" }).format(date);
}

function formatTimeId(date: Date) {
  return new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function ageLabel(date: Date) {
  const minutes = Math.max(1, Math.round((Date.now() - date.getTime()) / 60_000));

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.round(minutes / 60);

  if (hours < 24) {
    return `${hours} hr`;
  }

  return `${Math.round(hours / 24)} d`;
}
