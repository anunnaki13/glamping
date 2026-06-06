import { redirect } from "next/navigation";
import { getCurrentSession, type AuthSession } from "@/lib/auth";
import { redirectWithActionError } from "@/lib/action-feedback";
import { hasPermission, type Permission } from "@/lib/permissions";
import type { UserRole } from "@/generated/prisma/enums";

export async function requireSession() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  return session;
}

export async function requirePermission(permission: Permission) {
  const session = await requireSession();

  if (!hasPermission(session.role as UserRole, permission)) {
    throw new Error("Anda tidak memiliki akses untuk melakukan aksi ini.");
  }

  return session;
}

export async function requirePagePermission(permission: Permission) {
  const session = await requireSession();

  if (!hasPermission(session.role as UserRole, permission)) {
    redirectWithActionError("/dashboard", "Anda tidak memiliki akses ke modul tersebut.");
  }

  return session;
}

export function activityActor(session: AuthSession) {
  return {
    actorId: session.userId,
  };
}
