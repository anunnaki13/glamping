"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  CommunicationChannel,
  CommunicationStatus,
  MessageTemplateCategory,
} from "@/generated/prisma/enums";
import { activityActor, requirePermission } from "@/lib/action-guard";
import { redirectWithActionError, redirectWithActionSuccess } from "@/lib/action-feedback";
import { formatDateId, formatIdr } from "@/lib/formatters";
import {
  buildWhatsappUrl,
  renderMessageTemplate,
} from "@/lib/message-templates";
import { getPrisma } from "@/lib/prisma";

const templateCategoryValues = [
  MessageTemplateCategory.BOOKING_CONFIRMATION,
  MessageTemplateCategory.PAYMENT_REMINDER,
  MessageTemplateCategory.CHECK_IN_REMINDER,
  MessageTemplateCategory.WELCOME_MESSAGE,
  MessageTemplateCategory.CHECKOUT_THANK_YOU,
  MessageTemplateCategory.REVIEW_REQUEST,
  MessageTemplateCategory.CUSTOM,
] as const;

const templateSchema = z.object({
  name: z.string().trim().min(2).max(100),
  category: z.enum(templateCategoryValues),
  body: z.string().trim().min(10).max(1200),
  isActive: z.boolean(),
});

const openWhatsappSchema = z.object({
  reservationId: z.string().min(1),
  templateId: z.string().min(1),
});

function formDataObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

export async function createMessageTemplateAction(formData: FormData) {
  const session = await requirePermission("message:write");
  const parsedPayload = templateSchema.safeParse({
    ...formDataObject(formData),
    isActive: formData.get("isActive") === "on",
  });

  if (!parsedPayload.success) {
    redirectWithActionError("/messages", parsedPayload.error);
  }

  const parsed = parsedPayload.data;
  const prisma = getPrisma();

  const template = await prisma.messageTemplate.create({
    data: {
      propertyId: session.propertyId,
      name: parsed.name,
      category: parsed.category,
      body: parsed.body,
      isActive: parsed.isActive,
      sortOrder: 99,
    },
  });

  await prisma.activityLog.create({
    data: {
      ...activityActor(session),
      action: "message_template.created",
      entityType: "MessageTemplate",
      entityId: template.id,
      description: `${session.name} created message template ${template.name}.`,
    },
  });

  revalidatePath("/messages");
  revalidatePath("/settings");
  redirectWithActionSuccess("/messages", `Template ${template.name} berhasil dibuat.`);
}

export async function updateMessageTemplateAction(templateId: string, formData: FormData) {
  const session = await requirePermission("message:write");
  const parsedPayload = templateSchema.safeParse({
    ...formDataObject(formData),
    isActive: formData.get("isActive") === "on",
  });

  if (!parsedPayload.success) {
    redirectWithActionError("/messages", parsedPayload.error);
  }

  const parsed = parsedPayload.data;
  const prisma = getPrisma();
  const existing = await prisma.messageTemplate.findFirst({
    where: { id: templateId, propertyId: session.propertyId },
  });

  if (!existing) {
    redirectWithActionError("/messages", "Template pesan tidak ditemukan.");
  }

  const template = await prisma.messageTemplate.update({
    where: { id: templateId },
    data: {
      name: parsed.name,
      category: parsed.category,
      body: parsed.body,
      isActive: parsed.isActive,
    },
  });

  await prisma.activityLog.create({
    data: {
      ...activityActor(session),
      action: "message_template.updated",
      entityType: "MessageTemplate",
      entityId: template.id,
      description: `${session.name} updated message template ${template.name}.`,
    },
  });

  revalidatePath("/messages");
  revalidatePath("/settings");
  redirectWithActionSuccess("/messages", `Template ${template.name} berhasil diperbarui.`);
}

export async function openWhatsappMessageAction(formData: FormData) {
  const session = await requirePermission("message:write");
  const parsedPayload = openWhatsappSchema.safeParse(formDataObject(formData));

  if (!parsedPayload.success) {
    redirectWithActionError("/messages", parsedPayload.error);
  }

  const parsed = parsedPayload.data;
  const prisma = getPrisma();
  const [property, template, reservation] = await Promise.all([
    prisma.property.findUniqueOrThrow({ where: { id: session.propertyId } }),
    prisma.messageTemplate.findFirst({
      where: {
        id: parsed.templateId,
        propertyId: session.propertyId,
        isActive: true,
      },
    }),
    prisma.reservation.findFirst({
      where: {
        id: parsed.reservationId,
        unit: { propertyId: session.propertyId },
      },
      include: {
        guest: true,
        unit: true,
      },
    }),
  ]);

  if (!template) {
    redirectWithActionError("/messages", "Template pesan aktif tidak ditemukan.");
  }

  if (!reservation) {
    redirectWithActionError("/messages", "Reservasi tidak ditemukan.");
  }

  if (!reservation.guest.phone) {
    redirectWithActionError("/messages", "Nomor WhatsApp tamu belum tersimpan.");
  }

  const message = renderMessageTemplate(template.body, {
    guest_name: reservation.guest.fullName,
    booking_code: reservation.bookingCode,
    property_name: property.name,
    property_phone: property.phone ?? "-",
    unit_name: reservation.unit?.name ?? reservation.unit?.code ?? "Unassigned",
    check_in: formatDateId(reservation.checkInDate),
    check_out: formatDateId(reservation.checkOutDate),
    payment_status: reservation.paymentStatus.replaceAll("_", " "),
    total_amount: formatIdr(Number(reservation.totalAmount)),
  });

  await prisma.communicationLog.create({
    data: {
      propertyId: session.propertyId,
      guestId: reservation.guestId,
      reservationId: reservation.id,
      templateId: template.id,
      channel: CommunicationChannel.WHATSAPP,
      status: CommunicationStatus.OPENED_LINK,
      recipient: reservation.guest.phone,
      message,
      createdBy: session.userId,
    },
  });

  await prisma.activityLog.create({
    data: {
      ...activityActor(session),
      action: "whatsapp_link.opened",
      entityType: "Reservation",
      entityId: reservation.id,
      description: `${session.name} prepared WhatsApp message for ${reservation.guest.fullName}.`,
    },
  });

  revalidatePath("/messages");
  redirect(buildWhatsappUrl(reservation.guest.phone, message));
}
