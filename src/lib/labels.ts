import type {
  BookingSource,
  HousekeepingStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  PaymentTransactionStatus,
  PaymentTransactionType,
  PosCategory,
  Priority,
  RequestStatus,
  RequestType,
  ReservationStatus,
  UnitBlockType,
  UnitStatus,
} from "@/generated/prisma/enums";
import type { StatusTone } from "@/components/ui/status-badge";

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

export const unitStatusTone: Record<UnitStatus, StatusTone> = {
  AVAILABLE: "blue",
  OCCUPIED: "violet",
  DIRTY: "orange",
  CLEANING: "cyan",
  READY: "success",
  MAINTENANCE: "warning",
  OUT_OF_ORDER: "danger",
};

export const unitBlockTypeLabels: Record<UnitBlockType, string> = {
  MAINTENANCE: "Maintenance",
  PRIVATE_HOLD: "Private Hold",
  OUT_OF_SERVICE: "Out of Service",
  OWNER_STAY: "Owner Stay",
};

export const unitBlockTypeTone: Record<UnitBlockType, StatusTone> = {
  MAINTENANCE: "warning",
  PRIVATE_HOLD: "violet",
  OUT_OF_SERVICE: "danger",
  OWNER_STAY: "cyan",
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

export const reservationStatusTone: Record<ReservationStatus, StatusTone> = {
  PENDING: "warning",
  CONFIRMED: "blue",
  CHECKED_IN: "cyan",
  CHECKED_OUT: "slate",
  CANCELLED: "danger",
  NO_SHOW: "orange",
};

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  UNPAID: "Unpaid",
  PARTIAL: "Partial",
  PAID: "Paid",
  REFUNDED: "Refunded",
};

export const paymentStatusTone: Record<PaymentStatus, StatusTone> = {
  UNPAID: "danger",
  PARTIAL: "amber",
  PAID: "success",
  REFUNDED: "violet",
};

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  CASH: "Cash",
  BANK_TRANSFER: "Bank Transfer",
  CREDIT_CARD: "Credit Card",
  DEBIT_CARD: "Debit Card",
  QRIS: "QRIS",
  E_WALLET: "E-Wallet",
  OTA_COLLECT: "OTA Collect",
  OTHER: "Other",
};

export const paymentTransactionTypeLabels: Record<PaymentTransactionType, string> = {
  PAYMENT: "Payment",
  REFUND: "Refund",
  ADJUSTMENT: "Adjustment",
};

export const paymentTransactionTypeTone: Record<PaymentTransactionType, StatusTone> = {
  PAYMENT: "success",
  REFUND: "amber",
  ADJUSTMENT: "violet",
};

export const paymentTransactionStatusLabels: Record<PaymentTransactionStatus, string> = {
  POSTED: "Posted",
  VOIDED: "Voided",
};

export const paymentTransactionStatusTone: Record<PaymentTransactionStatus, StatusTone> = {
  POSTED: "success",
  VOIDED: "danger",
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

export const housekeepingStatusTone: Record<HousekeepingStatus, StatusTone> = {
  DIRTY: "orange",
  ASSIGNED: "blue",
  IN_PROGRESS: "cyan",
  INSPECTION: "violet",
  READY: "success",
  BLOCKED: "danger",
};

export const priorityLabels: Record<Priority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

export const priorityTone: Record<Priority, StatusTone> = {
  LOW: "slate",
  MEDIUM: "blue",
  HIGH: "amber",
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

export const requestStatusTone: Record<RequestStatus, StatusTone> = {
  OPEN: "orange",
  ASSIGNED: "blue",
  IN_PROGRESS: "cyan",
  WAITING_GUEST: "amber",
  COMPLETED: "success",
  CANCELLED: "slate",
};

export const orderStatusLabels: Record<OrderStatus, string> = {
  OPEN: "Open",
  CONFIRMED: "Confirmed",
  PREPARING: "Preparing",
  DELIVERED: "Delivered",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const orderStatusTone: Record<OrderStatus, StatusTone> = {
  OPEN: "orange",
  CONFIRMED: "blue",
  PREPARING: "amber",
  DELIVERED: "cyan",
  COMPLETED: "success",
  CANCELLED: "slate",
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
