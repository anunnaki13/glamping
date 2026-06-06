import type {
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

export const unitStatusLabels: Record<UnitStatus, string> = {
  AVAILABLE: "Available",
  OCCUPIED: "Occupied",
  DIRTY: "Dirty",
  CLEANING: "Cleaning",
  READY: "Ready",
  MAINTENANCE: "Maintenance",
  OUT_OF_ORDER: "Out of Order",
};

export const unitStatusDescriptions: Record<UnitStatus, string> = {
  AVAILABLE: "Unit tersedia untuk dijual.",
  OCCUPIED: "Unit sedang ditempati tamu.",
  DIRTY: "Unit perlu dibersihkan setelah checkout.",
  CLEANING: "Housekeeping sedang memproses unit.",
  READY: "Unit siap untuk arrival berikutnya.",
  MAINTENANCE: "Unit diblokir untuk perawatan.",
  OUT_OF_ORDER: "Unit tidak dapat dijual sampai dibuka kembali.",
};

export const unitStatusTone: Record<UnitStatus, "success" | "warning" | "danger" | "info" | "muted"> = {
  AVAILABLE: "success",
  OCCUPIED: "info",
  DIRTY: "warning",
  CLEANING: "info",
  READY: "success",
  MAINTENANCE: "danger",
  OUT_OF_ORDER: "danger",
};

export function humanizeGuestType(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function maskSensitive(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  if (value.length <= 4) {
    return "****";
  }

  return `${value.slice(0, 2)}****${value.slice(-2)}`;
}

export function maskContact(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const trimmed = value.trim();
  const atIndex = trimmed.indexOf("@");

  if (atIndex > 0) {
    const local = trimmed.slice(0, atIndex);
    const domain = trimmed.slice(atIndex + 1);
    const visibleLocal = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);

    return `${visibleLocal}***@${domain}`;
  }

  return maskSensitive(trimmed);
}

export const reservationStatusLabels: Record<ReservationStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  CHECKED_IN: "In-house",
  CHECKED_OUT: "Checked out",
  CANCELLED: "Cancelled",
  NO_SHOW: "No show",
};

export const reservationStatusTone: Record<ReservationStatus, "success" | "warning" | "danger" | "info" | "muted"> = {
  PENDING: "warning",
  CONFIRMED: "success",
  CHECKED_IN: "info",
  CHECKED_OUT: "muted",
  CANCELLED: "danger",
  NO_SHOW: "danger",
};

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  UNPAID: "Unpaid",
  PARTIAL: "Partial",
  PAID: "Paid",
  REFUNDED: "Refunded",
};

export const paymentStatusTone: Record<PaymentStatus, "success" | "warning" | "danger" | "info" | "muted"> = {
  UNPAID: "danger",
  PARTIAL: "warning",
  PAID: "success",
  REFUNDED: "muted",
};

export const bookingSourceLabels: Record<BookingSource, string> = {
  DIRECT_WEBSITE: "Website",
  WHATSAPP: "WhatsApp",
  WALK_IN: "Walk-in",
  BOOKING_COM: "Booking.com",
  AIRBNB: "Airbnb",
  AGODA: "Agoda",
  TRAVEL_AGENT: "Travel Agent",
  OTHER: "Other",
};

export const housekeepingStatusLabels: Record<HousekeepingStatus, string> = {
  DIRTY: "Dirty",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In Progress",
  INSPECTION: "Inspection",
  READY: "Ready",
  BLOCKED: "Blocked",
};

export const housekeepingStatusTone: Record<HousekeepingStatus, "success" | "warning" | "danger" | "info" | "muted"> = {
  DIRTY: "warning",
  ASSIGNED: "info",
  IN_PROGRESS: "info",
  INSPECTION: "warning",
  READY: "success",
  BLOCKED: "danger",
};

export const priorityLabels: Record<Priority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

export const priorityTone: Record<Priority, "success" | "warning" | "danger" | "info" | "muted"> = {
  LOW: "muted",
  MEDIUM: "info",
  HIGH: "warning",
  URGENT: "danger",
};

export const requestTypeLabels: Record<RequestType, string> = {
  HOUSEKEEPING: "Housekeeping",
  ROOM_SERVICE: "Room Service",
  FNB_ORDER: "F&B Order",
  TRANSPORT: "Transport",
  ACTIVITY: "Activity",
  MAINTENANCE: "Maintenance",
  SPECIAL_REQUEST: "Special Request",
  COMPLAINT: "Complaint",
  OTHER: "Other",
};

export const requestStatusLabels: Record<RequestStatus, string> = {
  OPEN: "Open",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In Progress",
  WAITING_GUEST: "Waiting Guest",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const requestStatusTone: Record<RequestStatus, "success" | "warning" | "danger" | "info" | "muted"> = {
  OPEN: "warning",
  ASSIGNED: "info",
  IN_PROGRESS: "info",
  WAITING_GUEST: "warning",
  COMPLETED: "success",
  CANCELLED: "muted",
};

export const orderStatusLabels: Record<OrderStatus, string> = {
  OPEN: "Open",
  CONFIRMED: "Confirmed",
  PREPARING: "Preparing",
  DELIVERED: "Delivered",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const orderStatusTone: Record<OrderStatus, "success" | "warning" | "danger" | "info" | "muted"> = {
  OPEN: "warning",
  CONFIRMED: "info",
  PREPARING: "warning",
  DELIVERED: "info",
  COMPLETED: "success",
  CANCELLED: "muted",
};

export const posCategoryLabels: Record<PosCategory, string> = {
  FOOD: "Food",
  BEVERAGE: "Beverage",
  SPA: "Spa",
  ACTIVITY: "Activity",
  TRANSPORT: "Transport",
  PACKAGE: "Package",
  MERCHANDISE: "Merchandise",
};
