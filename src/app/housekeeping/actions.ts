"use server";

import { addHours } from "date-fns";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  HousekeepingStatus,
  Priority,
  ReservationStatus,
  UnitStatus,
} from "@/generated/prisma/enums";
import { activityActor, requirePermission } from "@/lib/action-guard";
import { redirectWithActionError, redirectWithActionSuccess } from "@/lib/action-feedback";
import { getPrisma } from "@/lib/prisma";

const housekeepingStatusValues = [
  HousekeepingStatus.DIRTY,
  HousekeepingStatus.ASSIGNED,
  HousekeepingStatus.IN_PROGRESS,
  HousekeepingStatus.INSPECTION,
  HousekeepingStatus.READY,
  HousekeepingStatus.BLOCKED,
] as const;

const priorityValues = [
  Priority.LOW,
  Priority.MEDIUM,
  Priority.HIGH,
  Priority.URGENT,
] as const;

const housekeepingTaskSchema = z.object({
  unitId: z.string().min(1),
  taskType: z.string().trim().min(2).max(80),
  status: z.enum(housekeepingStatusValues).default(HousekeepingStatus.DIRTY),
  priority: z.enum(priorityValues).default(Priority.MEDIUM),
  assignedTo: z.string().trim().optional(),
  dueAt: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

const housekeepingTaskUpdateSchema = z.object({
  status: z.enum(housekeepingStatusValues),
  priority: z.enum(priorityValues),
  assignedTo: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

function formDataObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function parseDueAt(value?: string) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function unitStatusForTaskStatus(status: HousekeepingStatus) {
  if (status === HousekeepingStatus.IN_PROGRESS || status === HousekeepingStatus.INSPECTION) {
    return UnitStatus.CLEANING;
  }

  if (status === HousekeepingStatus.READY) {
    return UnitStatus.READY;
  }

  if (status === HousekeepingStatus.BLOCKED) {
    return UnitStatus.MAINTENANCE;
  }

  return UnitStatus.DIRTY;
}

async function syncUnitStatusForTask(unitId: string, status: HousekeepingStatus) {
  const prisma = getPrisma();
  const checkedInCount = await prisma.reservation.count({
    where: {
      unitId,
      status: ReservationStatus.CHECKED_IN,
    },
  });

  await prisma.unit.update({
    where: { id: unitId },
    data: {
      status: checkedInCount > 0 ? UnitStatus.OCCUPIED : unitStatusForTaskStatus(status),
    },
  });
}

function timestampsForStatus(status: HousekeepingStatus, existing?: { startedAt: Date | null }) {
  const now = new Date();

  return {
    startedAt:
      (status === HousekeepingStatus.IN_PROGRESS || status === HousekeepingStatus.INSPECTION) && !existing?.startedAt
        ? now
        : undefined,
    completedAt: status === HousekeepingStatus.READY ? now : status === HousekeepingStatus.BLOCKED ? null : undefined,
  };
}

async function findScopedTask(taskId: string, propertyId: string) {
  return getPrisma().housekeepingTask.findFirst({
    where: {
      id: taskId,
      unit: { propertyId },
    },
    include: { unit: true },
  });
}

async function revalidateHousekeepingSurfaces(unitId?: string) {
  revalidatePath("/housekeeping");
  revalidatePath("/units");
  revalidatePath("/calendar");

  if (unitId) {
    revalidatePath(`/units/${unitId}`);
  }
}

export async function createHousekeepingTaskAction(formData: FormData) {
  const session = await requirePermission("housekeeping:write");
  const parsedPayload = housekeepingTaskSchema.safeParse(formDataObject(formData));

  if (!parsedPayload.success) {
    redirectWithActionError("/housekeeping", parsedPayload.error);
  }

  const parsed = parsedPayload.data;
  const prisma = getPrisma();

  const unit = await prisma.unit.findFirst({
    where: { id: parsed.unitId, propertyId: session.propertyId },
  });

  if (!unit) {
    redirectWithActionError("/housekeeping", "Unit tidak ditemukan.");
  }

  const task = await prisma.housekeepingTask.create({
    data: {
      unitId: parsed.unitId,
      taskType: parsed.taskType,
      status: parsed.status,
      priority: parsed.priority,
      assignedTo: parsed.assignedTo || null,
      dueAt: parseDueAt(parsed.dueAt),
      notes: parsed.notes || null,
      startedAt:
        parsed.status === HousekeepingStatus.IN_PROGRESS || parsed.status === HousekeepingStatus.INSPECTION
          ? new Date()
          : null,
      completedAt: parsed.status === HousekeepingStatus.READY ? new Date() : null,
    },
  });

  await syncUnitStatusForTask(unit.id, parsed.status);

  await prisma.activityLog.create({
    data: {
      ...activityActor(session),
      action: "housekeeping_task.created",
      entityType: "HousekeepingTask",
      entityId: task.id,
      description: `${session.name} created housekeeping task ${task.taskType} for ${unit.code}.`,
    },
  });

  await revalidateHousekeepingSurfaces(unit.id);
  redirectWithActionSuccess("/housekeeping", `Task ${task.taskType} untuk ${unit.code} berhasil dibuat.`);
}

export async function updateHousekeepingTaskAction(taskId: string, formData: FormData) {
  const session = await requirePermission("housekeeping:write");
  const parsedPayload = housekeepingTaskUpdateSchema.safeParse(formDataObject(formData));

  if (!parsedPayload.success) {
    redirectWithActionError("/housekeeping", parsedPayload.error);
  }

  const parsed = parsedPayload.data;
  const prisma = getPrisma();
  const existing = await findScopedTask(taskId, session.propertyId);

  if (!existing) {
    redirectWithActionError("/housekeeping", "Task housekeeping tidak ditemukan.");
  }

  const task = await prisma.housekeepingTask.update({
    where: { id: taskId },
    data: {
      status: parsed.status,
      priority: parsed.priority,
      assignedTo: parsed.assignedTo || null,
      notes: parsed.notes || null,
      ...timestampsForStatus(parsed.status, existing),
    },
  });

  await syncUnitStatusForTask(existing.unitId, parsed.status);

  await prisma.activityLog.create({
    data: {
      ...activityActor(session),
      action: "housekeeping_task.updated",
      entityType: "HousekeepingTask",
      entityId: task.id,
      description: `${session.name} updated housekeeping task ${task.taskType} for ${existing.unit.code}.`,
    },
  });

  await revalidateHousekeepingSurfaces(existing.unitId);
  redirectWithActionSuccess("/housekeeping", `Task ${task.taskType} untuk ${existing.unit.code} berhasil diperbarui.`);
}

export async function transitionHousekeepingTaskAction(taskId: string, formData: FormData) {
  const session = await requirePermission("housekeeping:write");
  const parsedStatus = z.enum(housekeepingStatusValues).safeParse(formData.get("status"));

  if (!parsedStatus.success) {
    redirectWithActionError("/housekeeping", parsedStatus.error);
  }

  const status = parsedStatus.data;
  const prisma = getPrisma();
  const existing = await findScopedTask(taskId, session.propertyId);

  if (!existing) {
    redirectWithActionError("/housekeeping", "Task housekeeping tidak ditemukan.");
  }

  const task = await prisma.housekeepingTask.update({
    where: { id: taskId },
    data: {
      status,
      dueAt: status === HousekeepingStatus.READY ? null : existing.dueAt ?? addHours(new Date(), 4),
      ...timestampsForStatus(status, existing),
    },
  });

  await syncUnitStatusForTask(existing.unitId, status);

  await prisma.activityLog.create({
    data: {
      ...activityActor(session),
      action: "housekeeping_task.transitioned",
      entityType: "HousekeepingTask",
      entityId: task.id,
      description: `${session.name} moved ${existing.unit.code} housekeeping task to ${status}.`,
    },
  });

  await revalidateHousekeepingSurfaces(existing.unitId);
  redirectWithActionSuccess("/housekeeping", `${existing.unit.code} dipindahkan ke ${status}.`);
}
