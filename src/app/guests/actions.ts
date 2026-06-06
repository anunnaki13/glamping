"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { activityActor, requirePermission } from "@/lib/action-guard";
import { redirectWithActionError, redirectWithActionSuccess } from "@/lib/action-feedback";
import { getPrisma } from "@/lib/prisma";

const guestSchema = z.object({
  fullName: z.string().trim().min(2),
  email: z.string().trim().email().optional().or(z.literal("")),
  phone: z.string().trim().optional(),
  country: z.string().trim().optional(),
  city: z.string().trim().optional(),
  idType: z.string().trim().optional(),
  idNumber: z.string().trim().optional(),
  guestType: z.string().trim().min(2).transform((value) => value.toUpperCase().replaceAll(" ", "_")),
  preferences: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

function formDataObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

export async function createGuestAction(formData: FormData) {
  const session = await requirePermission("guest:sensitive");
  const parsedPayload = guestSchema.safeParse(formDataObject(formData));

  if (!parsedPayload.success) {
    redirectWithActionError("/guests/new", parsedPayload.error);
  }

  const parsed = parsedPayload.data;
  const prisma = getPrisma();

  const guest = await prisma.guest.create({
    data: {
      fullName: parsed.fullName,
      email: parsed.email || null,
      phone: parsed.phone || null,
      country: parsed.country || null,
      city: parsed.city || null,
      idType: parsed.idType || null,
      idNumber: parsed.idNumber || null,
      guestType: parsed.guestType,
      preferences: parsed.preferences || null,
      notes: parsed.notes || null,
    },
  });

  await prisma.activityLog.create({
    data: {
      ...activityActor(session),
      action: "guest.created",
      entityType: "Guest",
      entityId: guest.id,
      description: `${session.name} created guest profile ${guest.fullName}.`,
    },
  });

  revalidatePath("/guests");
  redirectWithActionSuccess(`/guests/${guest.id}`, `Guest ${guest.fullName} berhasil dibuat.`);
}

export async function updateGuestAction(guestId: string, formData: FormData) {
  const session = await requirePermission("guest:sensitive");
  const actionPath = `/guests/${guestId}`;
  const parsedPayload = guestSchema.safeParse(formDataObject(formData));

  if (!parsedPayload.success) {
    redirectWithActionError(actionPath, parsedPayload.error);
  }

  const parsed = parsedPayload.data;
  const prisma = getPrisma();

  const existing = await prisma.guest.findUnique({ where: { id: guestId } });

  if (!existing) {
    redirectWithActionError("/guests", "Profil tamu tidak ditemukan.");
  }

  const guest = await prisma.guest.update({
    where: { id: guestId },
    data: {
      fullName: parsed.fullName,
      email: parsed.email || null,
      phone: parsed.phone || null,
      country: parsed.country || null,
      city: parsed.city || null,
      idType: parsed.idType || null,
      idNumber: parsed.idNumber || null,
      guestType: parsed.guestType,
      preferences: parsed.preferences || null,
      notes: parsed.notes || null,
    },
  });

  await prisma.activityLog.create({
    data: {
      ...activityActor(session),
      action: "guest.updated",
      entityType: "Guest",
      entityId: guest.id,
      description: `${session.name} updated guest profile ${guest.fullName}.`,
    },
  });

  revalidatePath("/guests");
  revalidatePath(`/guests/${guest.id}`);
  redirectWithActionSuccess(`/guests/${guest.id}`, `Guest ${guest.fullName} berhasil diperbarui.`);
}
