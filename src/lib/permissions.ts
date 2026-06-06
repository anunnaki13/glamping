import type { UserRole } from "@/generated/prisma/enums";

export type Permission =
  | "dashboard:read"
  | "reservation:read"
  | "reservation:write"
  | "checkin:write"
  | "guest:read"
  | "guest:sensitive"
  | "unit:read"
  | "unit:write"
  | "housekeeping:read"
  | "housekeeping:write"
  | "request:read"
  | "request:write"
  | "message:read"
  | "message:write"
  | "ai:read"
  | "ai:write"
  | "pos:read"
  | "pos:write"
  | "payment:read"
  | "payment:write"
  | "report:read"
  | "activity:read"
  | "settings:read"
  | "settings:write"
  | "user:write";

const rolePermissions: Record<UserRole, Permission[]> = {
  OWNER: [
    "dashboard:read",
    "reservation:read",
    "reservation:write",
    "checkin:write",
    "guest:read",
    "guest:sensitive",
    "unit:read",
    "unit:write",
    "housekeeping:read",
    "housekeeping:write",
    "request:read",
    "request:write",
    "message:read",
    "message:write",
    "ai:read",
    "ai:write",
    "pos:read",
    "pos:write",
    "payment:read",
    "payment:write",
    "report:read",
    "activity:read",
    "settings:read",
    "settings:write",
    "user:write",
  ],
  MANAGER: [
    "dashboard:read",
    "reservation:read",
    "reservation:write",
    "checkin:write",
    "guest:read",
    "guest:sensitive",
    "unit:read",
    "unit:write",
    "housekeeping:read",
    "housekeeping:write",
    "request:read",
    "request:write",
    "message:read",
    "message:write",
    "ai:read",
    "ai:write",
    "pos:read",
    "pos:write",
    "payment:read",
    "payment:write",
    "report:read",
    "activity:read",
    "settings:read",
    "settings:write",
    "user:write",
  ],
  FRONT_OFFICE: [
    "dashboard:read",
    "reservation:read",
    "reservation:write",
    "checkin:write",
    "guest:read",
    "guest:sensitive",
    "unit:read",
    "housekeeping:read",
    "request:read",
    "request:write",
    "message:read",
    "message:write",
    "ai:read",
    "pos:read",
    "payment:read",
    "payment:write",
    "report:read",
  ],
  HOUSEKEEPING: [
    "dashboard:read",
    "reservation:read",
    "unit:read",
    "housekeeping:read",
    "housekeeping:write",
    "request:read",
    "request:write",
    "message:read",
    "ai:read",
  ],
  FNB_ACTIVITY: [
    "dashboard:read",
    "reservation:read",
    "guest:read",
    "unit:read",
    "request:read",
    "request:write",
    "message:read",
    "ai:read",
    "pos:read",
    "pos:write",
    "report:read",
  ],
  VIEWER: [
    "dashboard:read",
    "reservation:read",
    "guest:read",
    "unit:read",
    "housekeeping:read",
    "request:read",
    "message:read",
    "ai:read",
    "pos:read",
    "report:read",
  ],
};

export function hasPermission(role: UserRole, permission: Permission) {
  return rolePermissions[role].includes(permission);
}

export function getRolePermissions(role: UserRole) {
  return rolePermissions[role];
}

export function canViewStayFinancialData(role: UserRole) {
  return role === "OWNER" || role === "MANAGER" || role === "FRONT_OFFICE";
}

export function canViewOperationalFinancialData(role: UserRole) {
  return canViewStayFinancialData(role) || role === "FNB_ACTIVITY";
}

export function canViewGuestContactData(role: UserRole) {
  return role === "OWNER" || role === "MANAGER" || role === "FRONT_OFFICE";
}

export function canInitiateGuestMessages(role: UserRole) {
  return hasPermission(role, "message:write");
}
