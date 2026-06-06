"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { UserRole } from "@/generated/prisma/enums";
import { activityActor, requirePermission } from "@/lib/action-guard";
import { redirectWithActionError, redirectWithActionSuccess } from "@/lib/action-feedback";
import { getPrisma } from "@/lib/prisma";

const userRoleValues = [
  UserRole.OWNER,
  UserRole.MANAGER,
  UserRole.FRONT_OFFICE,
  UserRole.HOUSEKEEPING,
  UserRole.FNB_ACTIVITY,
  UserRole.VIEWER,
] as const;

const propertySettingsSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug hanya boleh huruf kecil, angka, dan tanda hubung."),
  address: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().email().optional().or(z.literal("")),
  logoUrl: z.string().trim().url().optional().or(z.literal("")),
  timezone: z.string().trim().min(3).max(80),
  currency: z.string().trim().min(3).max(3).transform((value) => value.toUpperCase()),
});

const createUserSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8),
  role: z.enum(userRoleValues),
  avatarUrl: z.string().trim().url().optional().or(z.literal("")),
});

const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(userRoleValues),
  avatarUrl: z.string().trim().url().optional().or(z.literal("")),
  isActive: z.boolean(),
  password: z
    .string()
    .optional()
    .refine((value) => !value || value.trim().length >= 8, "Password minimal 8 karakter."),
});

function formDataObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

export async function updatePropertySettingsAction(formData: FormData) {
  const session = await requirePermission("settings:write");
  const parsedPayload = propertySettingsSchema.safeParse(formDataObject(formData));

  if (!parsedPayload.success) {
    redirectWithActionError("/settings", parsedPayload.error);
  }

  const parsed = parsedPayload.data;
  const prisma = getPrisma();
  const slugConflict = await prisma.property.findFirst({
    where: {
      slug: parsed.slug,
      id: { not: session.propertyId },
    },
  });

  if (slugConflict) {
    redirectWithActionError("/settings", "Slug property sudah dipakai.");
  }

  const property = await prisma.property.update({
    where: { id: session.propertyId },
    data: {
      name: parsed.name,
      slug: parsed.slug,
      address: parsed.address || null,
      phone: parsed.phone || null,
      email: parsed.email || null,
      logoUrl: parsed.logoUrl || null,
      timezone: parsed.timezone,
      currency: parsed.currency,
    },
  });

  await prisma.activityLog.create({
    data: {
      ...activityActor(session),
      action: "property.updated",
      entityType: "Property",
      entityId: property.id,
      description: `${session.name} updated property settings.`,
    },
  });

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  redirectWithActionSuccess("/settings", "Property settings berhasil disimpan.");
}

export async function createUserAction(formData: FormData) {
  const session = await requirePermission("user:write");
  const parsedPayload = createUserSchema.safeParse(formDataObject(formData));

  if (!parsedPayload.success) {
    redirectWithActionError("/settings", parsedPayload.error);
  }

  const parsed = parsedPayload.data;
  const prisma = getPrisma();
  const existing = await prisma.user.findUnique({ where: { email: parsed.email } });

  if (existing) {
    redirectWithActionError("/settings", "Email user sudah terdaftar.");
  }

  const user = await prisma.user.create({
    data: {
      propertyId: session.propertyId,
      name: parsed.name,
      email: parsed.email,
      passwordHash: await bcrypt.hash(parsed.password, 12),
      role: parsed.role,
      avatarUrl: parsed.avatarUrl || null,
      isActive: true,
    },
  });

  await prisma.activityLog.create({
    data: {
      ...activityActor(session),
      action: "user.created",
      entityType: "User",
      entityId: user.id,
      description: `${session.name} created user ${user.email}.`,
    },
  });

  revalidatePath("/settings");
  redirectWithActionSuccess("/settings", `User ${user.email} berhasil dibuat.`);
}

export async function updateUserAction(userId: string, formData: FormData) {
  const session = await requirePermission("user:write");
  const parsedPayload = updateUserSchema.safeParse({
    ...formDataObject(formData),
    isActive: formData.get("isActive") === "on",
  });

  if (!parsedPayload.success) {
    redirectWithActionError("/settings", parsedPayload.error);
  }

  const parsed = parsedPayload.data;
  const prisma = getPrisma();
  const existing = await prisma.user.findFirst({
    where: { id: userId, propertyId: session.propertyId },
  });

  if (!existing) {
    redirectWithActionError("/settings", "User tidak ditemukan.");
  }

  if (!parsed.isActive && existing.id === session.userId) {
    redirectWithActionError("/settings", "Anda tidak bisa menonaktifkan akun yang sedang dipakai.");
  }

  if (existing.role === UserRole.OWNER && (parsed.role !== UserRole.OWNER || !parsed.isActive)) {
    const otherActiveOwners = await prisma.user.count({
      where: {
        propertyId: session.propertyId,
        id: { not: existing.id },
        role: UserRole.OWNER,
        isActive: true,
      },
    });

    if (otherActiveOwners === 0) {
      redirectWithActionError("/settings", "Minimal harus ada satu owner aktif.");
    }
  }

  if (parsed.email !== existing.email) {
    const emailConflict = await prisma.user.findUnique({ where: { email: parsed.email } });

    if (emailConflict) {
      redirectWithActionError("/settings", "Email user sudah terdaftar.");
    }
  }

  const password = parsed.password?.trim();
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      name: parsed.name,
      email: parsed.email,
      role: parsed.role,
      avatarUrl: parsed.avatarUrl || null,
      isActive: parsed.isActive,
      ...(password ? { passwordHash: await bcrypt.hash(password, 12) } : {}),
    },
  });

  await prisma.activityLog.create({
    data: {
      ...activityActor(session),
      action: "user.updated",
      entityType: "User",
      entityId: user.id,
      description: `${session.name} updated user ${user.email}.`,
    },
  });

  revalidatePath("/settings");
  redirectWithActionSuccess("/settings", `User ${user.email} berhasil diperbarui.`);
}
