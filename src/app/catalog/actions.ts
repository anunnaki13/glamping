"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PosCategory } from "@/generated/prisma/enums";
import { activityActor, requirePermission } from "@/lib/action-guard";
import { redirectWithActionError, redirectWithActionSuccess } from "@/lib/action-feedback";
import { getPrisma } from "@/lib/prisma";
import { optionalImageReferenceSchema, saveUploadedImage } from "@/lib/uploads";

const posCategoryValues = [
  PosCategory.FOOD,
  PosCategory.BEVERAGE,
  PosCategory.SPA,
  PosCategory.ACTIVITY,
  PosCategory.TRANSPORT,
  PosCategory.PACKAGE,
  PosCategory.MERCHANDISE,
] as const;

const catalogItemSchema = z.object({
  name: z.string().trim().min(2).max(100),
  category: z.enum(posCategoryValues),
  price: z.coerce.number().min(0).max(999_999_999),
  description: z.string().trim().max(600).optional(),
  photoUrl: optionalImageReferenceSchema,
  isActive: z.boolean(),
  isAvailable: z.boolean(),
  leadTimeMinutes: z.coerce.number().int().min(0).max(10_080).default(0),
  dailyCapacity: z.coerce.number().int().min(1).max(10_000).optional().or(z.literal("")),
  slotLabel: z.string().trim().max(80).optional(),
});

function formDataObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function revalidateCatalogSurfaces() {
  revalidatePath("/catalog");
  revalidatePath("/orders");
  revalidatePath("/reports");
  revalidatePath("/dashboard");
}

export async function createCatalogItemAction(formData: FormData) {
  const session = await requirePermission("pos:write");
  const parsedPayload = catalogItemSchema.safeParse({
    ...formDataObject(formData),
    isActive: formData.get("isActive") === "on",
    isAvailable: formData.get("isAvailable") === "on",
  });

  if (!parsedPayload.success) {
    redirectWithActionError("/catalog", parsedPayload.error);
  }

  const parsed = parsedPayload.data;
  const prisma = getPrisma();
  const existing = await prisma.posItem.findFirst({
    where: {
      name: {
        equals: parsed.name,
        mode: "insensitive",
      },
    },
  });

  if (existing) {
    redirectWithActionError("/catalog", "Item katalog dengan nama ini sudah ada.");
  }

  let photoUrl = parsed.photoUrl || null;

  try {
    photoUrl = (await saveUploadedImage(formData, { directory: "catalog", prefix: parsed.name })) ?? photoUrl;
  } catch (error) {
    redirectWithActionError("/catalog", error);
  }

  const item = await prisma.posItem.create({
    data: {
      name: parsed.name,
      category: parsed.category,
      price: String(parsed.price),
      description: parsed.description || null,
      photoUrl,
      isActive: parsed.isActive,
      isAvailable: parsed.isAvailable,
      leadTimeMinutes: parsed.leadTimeMinutes,
      dailyCapacity: parsed.dailyCapacity === "" ? null : parsed.dailyCapacity ?? null,
      slotLabel: parsed.slotLabel || null,
    },
  });

  await prisma.activityLog.create({
    data: {
      ...activityActor(session),
      action: "pos_item.created",
      entityType: "PosItem",
      entityId: item.id,
      description: `${session.name} created POS item ${item.name}.`,
    },
  });

  revalidateCatalogSurfaces();
  redirectWithActionSuccess("/catalog", `Item ${item.name} berhasil dibuat.`);
}

export async function updateCatalogItemAction(itemId: string, formData: FormData) {
  const session = await requirePermission("pos:write");
  const parsedPayload = catalogItemSchema.safeParse({
    ...formDataObject(formData),
    isActive: formData.get("isActive") === "on",
    isAvailable: formData.get("isAvailable") === "on",
  });

  if (!parsedPayload.success) {
    redirectWithActionError("/catalog", parsedPayload.error);
  }

  const parsed = parsedPayload.data;
  const prisma = getPrisma();
  const existing = await prisma.posItem.findUnique({ where: { id: itemId } });

  if (!existing) {
    redirectWithActionError("/catalog", "Item katalog tidak ditemukan.");
  }

  if (parsed.name !== existing.name) {
    const duplicate = await prisma.posItem.findFirst({
      where: {
        id: { not: itemId },
        name: {
          equals: parsed.name,
          mode: "insensitive",
        },
      },
    });

    if (duplicate) {
      redirectWithActionError("/catalog", "Item katalog dengan nama ini sudah ada.");
    }
  }

  let photoUrl = parsed.photoUrl || null;

  try {
    photoUrl = (await saveUploadedImage(formData, { directory: "catalog", prefix: parsed.name })) ?? photoUrl;
  } catch (error) {
    redirectWithActionError("/catalog", error);
  }

  const item = await prisma.posItem.update({
    where: { id: itemId },
    data: {
      name: parsed.name,
      category: parsed.category,
      price: String(parsed.price),
      description: parsed.description || null,
      photoUrl,
      isActive: parsed.isActive,
      isAvailable: parsed.isAvailable,
      leadTimeMinutes: parsed.leadTimeMinutes,
      dailyCapacity: parsed.dailyCapacity === "" ? null : parsed.dailyCapacity ?? null,
      slotLabel: parsed.slotLabel || null,
    },
  });

  await prisma.activityLog.create({
    data: {
      ...activityActor(session),
      action: "pos_item.updated",
      entityType: "PosItem",
      entityId: item.id,
      description: `${session.name} updated POS item ${item.name}.`,
    },
  });

  revalidateCatalogSurfaces();
  redirectWithActionSuccess("/catalog", `Item ${item.name} berhasil diperbarui.`);
}
