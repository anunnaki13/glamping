"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ReservationStatus, UnitStatus } from "@/generated/prisma/enums";
import { activityActor, requirePermission } from "@/lib/action-guard";
import { redirectWithActionError, redirectWithActionSuccess } from "@/lib/action-feedback";
import { getPrisma } from "@/lib/prisma";
import { optionalImageReferenceSchema, saveUploadedImage } from "@/lib/uploads";

const unitStatusValues = [
  UnitStatus.AVAILABLE,
  UnitStatus.OCCUPIED,
  UnitStatus.DIRTY,
  UnitStatus.CLEANING,
  UnitStatus.READY,
  UnitStatus.MAINTENANCE,
  UnitStatus.OUT_OF_ORDER,
] as const;

const unitTypeSchema = z.object({
  name: z.string().trim().min(2),
  description: z.string().trim().optional(),
  capacity: z.coerce.number().int().min(1).max(12),
  baseRate: z.coerce.number().min(0),
});

const unitSchema = z.object({
  code: z.string().trim().min(2).transform((value) => value.toUpperCase()),
  name: z.string().trim().min(2),
  unitTypeId: z.string().min(1),
  status: z.enum(unitStatusValues),
  description: z.string().trim().optional(),
  amenities: z.string().trim().optional(),
  photoUrl: optionalImageReferenceSchema,
  notes: z.string().trim().optional(),
});

function formDataObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function parseAmenities(value: string | undefined) {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function assertUnitStatusAllowed(unitId: string, status: UnitStatus) {
  if (status === UnitStatus.OCCUPIED) {
    return;
  }

  const checkedInCount = await getPrisma().reservation.count({
    where: {
      unitId,
      status: ReservationStatus.CHECKED_IN,
    },
  });

  if (checkedInCount > 0) {
    throw new Error("Unit dengan tamu in-house harus tetap berstatus Occupied.");
  }
}

export async function createUnitTypeAction(formData: FormData) {
  const session = await requirePermission("unit:write");
  const parsedPayload = unitTypeSchema.safeParse(formDataObject(formData));

  if (!parsedPayload.success) {
    redirectWithActionError("/units/new", parsedPayload.error);
  }

  const parsed = parsedPayload.data;
  const prisma = getPrisma();

  const unitType = await prisma.unitType.create({
    data: {
      propertyId: session.propertyId,
      name: parsed.name,
      description: parsed.description || null,
      capacity: parsed.capacity,
      baseRate: String(parsed.baseRate),
    },
  });

  await prisma.activityLog.create({
    data: {
      ...activityActor(session),
      action: "unit_type.created",
      entityType: "UnitType",
      entityId: unitType.id,
      description: `${session.name} created unit type ${unitType.name}.`,
    },
  });

  revalidatePath("/units");
  redirectWithActionSuccess("/units/new", `Unit type ${unitType.name} berhasil dibuat.`);
}

export async function createUnitAction(formData: FormData) {
  const session = await requirePermission("unit:write");
  const parsedPayload = unitSchema.safeParse(formDataObject(formData));

  if (!parsedPayload.success) {
    redirectWithActionError("/units/new", parsedPayload.error);
  }

  const parsed = parsedPayload.data;
  const prisma = getPrisma();

  const unitType = await prisma.unitType.findFirst({
    where: { id: parsed.unitTypeId, propertyId: session.propertyId },
  });

  if (!unitType) {
    redirectWithActionError("/units/new", "Unit type tidak ditemukan.");
  }

  const duplicate = await prisma.unit.findFirst({
    where: { propertyId: session.propertyId, code: parsed.code },
  });

  if (duplicate) {
    redirectWithActionError("/units/new", "Kode unit sudah digunakan.");
  }

  let photoUrl = parsed.photoUrl || null;

  try {
    photoUrl = (await saveUploadedImage(formData, { directory: "units", prefix: parsed.code })) ?? photoUrl;
  } catch (error) {
    redirectWithActionError("/units/new", error);
  }

  const unit = await prisma.unit.create({
    data: {
      propertyId: session.propertyId,
      unitTypeId: parsed.unitTypeId,
      code: parsed.code,
      name: parsed.name,
      status: parsed.status,
      description: parsed.description || null,
      amenities: parseAmenities(parsed.amenities),
      photoUrl,
      notes: parsed.notes || null,
    },
  });

  await prisma.activityLog.create({
    data: {
      ...activityActor(session),
      action: "unit.created",
      entityType: "Unit",
      entityId: unit.id,
      description: `${session.name} created unit ${unit.code}.`,
    },
  });

  revalidatePath("/units");
  redirectWithActionSuccess(`/units/${unit.id}`, `Unit ${unit.code} berhasil dibuat.`);
}

export async function updateUnitAction(unitId: string, formData: FormData) {
  const session = await requirePermission("unit:write");
  const actionPath = `/units/${unitId}`;
  const parsedPayload = unitSchema.safeParse(formDataObject(formData));

  if (!parsedPayload.success) {
    redirectWithActionError(actionPath, parsedPayload.error);
  }

  const parsed = parsedPayload.data;
  const prisma = getPrisma();

  const existing = await prisma.unit.findFirst({
    where: { id: unitId, propertyId: session.propertyId },
  });

  if (!existing) {
    redirectWithActionError("/units", "Unit tidak ditemukan.");
  }

  try {
    await assertUnitStatusAllowed(unitId, parsed.status);
  } catch (error) {
    redirectWithActionError(actionPath, error);
  }

  if (parsed.code !== existing.code) {
    const duplicate = await prisma.unit.findFirst({
      where: {
        id: { not: unitId },
        propertyId: session.propertyId,
        code: parsed.code,
      },
    });

    if (duplicate) {
      redirectWithActionError(actionPath, "Kode unit sudah digunakan.");
    }
  }

  let photoUrl = parsed.photoUrl || null;

  try {
    photoUrl = (await saveUploadedImage(formData, { directory: "units", prefix: parsed.code })) ?? photoUrl;
  } catch (error) {
    redirectWithActionError(actionPath, error);
  }

  const unit = await prisma.unit.update({
    where: { id: unitId },
    data: {
      unitTypeId: parsed.unitTypeId,
      code: parsed.code,
      name: parsed.name,
      status: parsed.status,
      description: parsed.description || null,
      amenities: parseAmenities(parsed.amenities),
      photoUrl,
      notes: parsed.notes || null,
    },
  });

  await prisma.activityLog.create({
    data: {
      ...activityActor(session),
      action: "unit.updated",
      entityType: "Unit",
      entityId: unit.id,
      description: `${session.name} updated unit ${unit.code}.`,
    },
  });

  revalidatePath("/units");
  revalidatePath(`/units/${unit.id}`);
  redirectWithActionSuccess(`/units/${unit.id}`, `Unit ${unit.code} berhasil diperbarui.`);
}

export async function updateUnitStatusAction(unitId: string, formData: FormData) {
  const session = await requirePermission("unit:write");
  const parsedStatus = z.enum(unitStatusValues).safeParse(formData.get("status"));

  if (!parsedStatus.success) {
    redirectWithActionError("/units", parsedStatus.error);
  }

  const status = parsedStatus.data;
  const prisma = getPrisma();

  const existing = await prisma.unit.findFirst({
    where: { id: unitId, propertyId: session.propertyId },
  });

  if (!existing) {
    redirectWithActionError("/units", "Unit tidak ditemukan.");
  }

  try {
    await assertUnitStatusAllowed(unitId, status);
  } catch (error) {
    redirectWithActionError("/units", error);
  }

  const unit = await prisma.unit.update({
    where: { id: unitId },
    data: { status },
  });

  await prisma.activityLog.create({
    data: {
      ...activityActor(session),
      action: "unit.status_updated",
      entityType: "Unit",
      entityId: unit.id,
      description: `${session.name} changed ${unit.code} status to ${status}.`,
    },
  });

  revalidatePath("/units");
  revalidatePath(`/units/${unit.id}`);
  redirectWithActionSuccess("/units", `Status ${unit.code} berhasil diubah ke ${status}.`);
}
