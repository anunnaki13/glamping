"use server";

import { format } from "date-fns";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  Priority,
  RequestStatus,
  RequestType,
} from "@/generated/prisma/enums";
import { activityActor, requirePermission } from "@/lib/action-guard";
import { redirectWithActionError, redirectWithActionSuccess } from "@/lib/action-feedback";
import { getPrisma } from "@/lib/prisma";

const requestTypeValues = [
  RequestType.HOUSEKEEPING,
  RequestType.ROOM_SERVICE,
  RequestType.FNB_ORDER,
  RequestType.TRANSPORT,
  RequestType.ACTIVITY,
  RequestType.MAINTENANCE,
  RequestType.SPECIAL_REQUEST,
  RequestType.COMPLAINT,
  RequestType.OTHER,
] as const;

const requestStatusValues = [
  RequestStatus.OPEN,
  RequestStatus.ASSIGNED,
  RequestStatus.IN_PROGRESS,
  RequestStatus.WAITING_GUEST,
  RequestStatus.COMPLETED,
  RequestStatus.CANCELLED,
] as const;

const priorityValues = [
  Priority.LOW,
  Priority.MEDIUM,
  Priority.HIGH,
  Priority.URGENT,
] as const;

const serviceRequestSchema = z.object({
  reservationId: z.string().trim().optional(),
  guestId: z.string().trim().optional(),
  type: z.enum(requestTypeValues),
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().optional(),
  status: z.enum(requestStatusValues).default(RequestStatus.OPEN),
  priority: z.enum(priorityValues).default(Priority.MEDIUM),
  assignedTo: z.string().trim().optional(),
  internalNotes: z.string().trim().optional(),
});

const serviceRequestUpdateSchema = z.object({
  status: z.enum(requestStatusValues),
  priority: z.enum(priorityValues),
  assignedTo: z.string().trim().optional(),
  internalNotes: z.string().trim().optional(),
});

function formDataObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

async function createServiceRequestCode() {
  const prisma = getPrisma();
  const prefix = `SR-${format(new Date(), "yyMMdd")}`;
  const count = await prisma.serviceRequest.count({
    where: {
      code: { startsWith: prefix },
    },
  });

  return `${prefix}-${String(count + 1).padStart(4, "0")}`;
}

function completedAtForStatus(status: RequestStatus) {
  return status === RequestStatus.COMPLETED ? new Date() : null;
}

function revalidateServiceSurfaces(requestId?: string) {
  revalidatePath("/service-requests");
  revalidatePath("/dashboard");
  revalidatePath("/reservations");

  if (requestId) {
    revalidatePath(`/service-requests/${requestId}`);
  }
}

export async function createServiceRequestAction(formData: FormData) {
  const session = await requirePermission("request:write");
  const parsedPayload = serviceRequestSchema.safeParse(formDataObject(formData));

  if (!parsedPayload.success) {
    redirectWithActionError("/service-requests", parsedPayload.error);
  }

  const parsed = parsedPayload.data;
  const prisma = getPrisma();
  const reservationId = parsed.reservationId || null;
  let guestId = parsed.guestId || null;

  if (reservationId) {
    const reservation = await prisma.reservation.findFirst({
      where: {
        id: reservationId,
        unit: { propertyId: session.propertyId },
      },
      select: { guestId: true, bookingCode: true },
    });

    if (!reservation) {
      redirectWithActionError("/service-requests", "Reservasi tidak ditemukan.");
    }

    guestId = reservation.guestId;
  }

  if (!reservationId && guestId) {
    const guest = await prisma.guest.findUnique({ where: { id: guestId } });

    if (!guest) {
      redirectWithActionError("/service-requests", "Guest tidak ditemukan.");
    }
  }

  const request = await prisma.serviceRequest.create({
    data: {
      code: await createServiceRequestCode(),
      reservationId,
      guestId,
      type: parsed.type,
      title: parsed.title,
      description: parsed.description || null,
      status: parsed.status,
      priority: parsed.priority,
      assignedTo: parsed.assignedTo || null,
      internalNotes: parsed.internalNotes || null,
      completedAt: completedAtForStatus(parsed.status),
    },
  });

  await prisma.activityLog.create({
    data: {
      ...activityActor(session),
      action: "service_request.created",
      entityType: "ServiceRequest",
      entityId: request.id,
      description: `${session.name} created request ${request.code}: ${request.title}.`,
    },
  });

  revalidateServiceSurfaces(request.id);
  redirectWithActionSuccess("/service-requests", `Request ${request.code} berhasil dibuat.`);
}

export async function updateServiceRequestAction(requestId: string, formData: FormData) {
  const session = await requirePermission("request:write");
  const parsedPayload = serviceRequestUpdateSchema.safeParse(formDataObject(formData));

  if (!parsedPayload.success) {
    redirectWithActionError("/service-requests", parsedPayload.error);
  }

  const parsed = parsedPayload.data;
  const prisma = getPrisma();
  const existing = await prisma.serviceRequest.findFirst({
    where: {
      id: requestId,
      OR: [
        { reservation: { unit: { propertyId: session.propertyId } } },
        { reservationId: null },
      ],
    },
  });

  if (!existing) {
    redirectWithActionError("/service-requests", "Service request tidak ditemukan.");
  }

  const request = await prisma.serviceRequest.update({
    where: { id: requestId },
    data: {
      status: parsed.status,
      priority: parsed.priority,
      assignedTo: parsed.assignedTo || null,
      internalNotes: parsed.internalNotes || null,
      completedAt: completedAtForStatus(parsed.status),
    },
  });

  await prisma.activityLog.create({
    data: {
      ...activityActor(session),
      action: "service_request.updated",
      entityType: "ServiceRequest",
      entityId: request.id,
      description: `${session.name} updated request ${request.code}.`,
    },
  });

  revalidateServiceSurfaces(request.id);
  redirectWithActionSuccess("/service-requests", `Request ${request.code} berhasil diperbarui.`);
}

export async function transitionServiceRequestAction(requestId: string, formData: FormData) {
  const session = await requirePermission("request:write");
  const parsedStatus = z.enum(requestStatusValues).safeParse(formData.get("status"));

  if (!parsedStatus.success) {
    redirectWithActionError("/service-requests", parsedStatus.error);
  }

  const status = parsedStatus.data;
  const prisma = getPrisma();
  const existing = await prisma.serviceRequest.findFirst({
    where: {
      id: requestId,
      OR: [
        { reservation: { unit: { propertyId: session.propertyId } } },
        { reservationId: null },
      ],
    },
  });

  if (!existing) {
    redirectWithActionError("/service-requests", "Service request tidak ditemukan.");
  }

  const request = await prisma.serviceRequest.update({
    where: { id: requestId },
    data: {
      status,
      completedAt: completedAtForStatus(status),
    },
  });

  await prisma.activityLog.create({
    data: {
      ...activityActor(session),
      action: "service_request.transitioned",
      entityType: "ServiceRequest",
      entityId: request.id,
      description: `${session.name} moved request ${request.code} to ${status}.`,
    },
  });

  revalidateServiceSurfaces(request.id);
  redirectWithActionSuccess("/service-requests", `Request ${request.code} dipindahkan ke ${status}.`);
}
