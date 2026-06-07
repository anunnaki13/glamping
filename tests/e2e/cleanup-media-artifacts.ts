import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { readdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { PrismaClient } from "../../src/generated/prisma/client";
import { ReservationStatus, UnitStatus } from "../../src/generated/prisma/enums";

async function main() {
  await cleanupDatabase();
  await cleanupUploadFiles();
}

async function cleanupDatabase() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    return;
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  const qaHousekeepingTasks = await prisma.housekeepingTask.findMany({
    where: {
      OR: [
        { taskType: { startsWith: "QA Linen Refresh" } },
        { notes: { contains: "QA Guest" } },
        { unit: { code: { startsWith: "QA-LF-" } } },
      ],
    },
    select: { id: true, unitId: true },
  });
  const qaUnitIds = [...new Set(qaHousekeepingTasks.map((task) => task.unitId))];
  const qaReservations = await prisma.reservation.findMany({
    where: { guest: { fullName: { startsWith: "QA Guest" } } },
    select: { id: true },
  });
  const qaReservationIds = qaReservations.map((reservation) => reservation.id);

  await prisma.serviceRequest.deleteMany({
    where: {
      OR: [
        { title: { startsWith: "QA Sunrise Picnic" } },
        { guest: { fullName: { startsWith: "QA Guest" } } },
        { reservationId: { in: qaReservationIds } },
      ],
    },
  });
  await prisma.paymentTransaction.deleteMany({ where: { reservationId: { in: qaReservationIds } } });
  await prisma.orderItem.deleteMany({
    where: {
      OR: [
        {
          order: {
            OR: [
              { reservationId: { in: qaReservationIds } },
              { guest: { fullName: { startsWith: "QA Guest" } } },
            ],
          },
        },
        { item: { name: { startsWith: "QA Adventure" } } },
      ],
    },
  });
  await prisma.order.deleteMany({
    where: {
      OR: [
        { reservationId: { in: qaReservationIds } },
        { guest: { fullName: { startsWith: "QA Guest" } } },
      ],
    },
  });
  await prisma.communicationLog.updateMany({
    where: {
      OR: [
        { reservationId: { in: qaReservationIds } },
        { guest: { fullName: { startsWith: "QA Guest" } } },
        { template: { name: { startsWith: "QA Welcome" } } },
      ],
    },
    data: {
      guestId: null,
      reservationId: null,
      templateId: null,
    },
  });
  await prisma.reservation.deleteMany({ where: { id: { in: qaReservationIds } } });
  await prisma.guest.deleteMany({ where: { fullName: { startsWith: "QA Guest" } } });
  await prisma.housekeepingTask.deleteMany({ where: { id: { in: qaHousekeepingTasks.map((task) => task.id) } } });
  await prisma.messageTemplate.deleteMany({ where: { name: { startsWith: "QA Welcome" } } });
  await prisma.activityLog.deleteMany({
    where: {
      OR: [
        { description: { contains: "QA Guest" } },
        { description: { contains: "QA Linen Refresh" } },
        { description: { contains: "QA Sunrise Picnic" } },
        { description: { contains: "QA Adventure" } },
        { description: { contains: "QA-LF-" } },
        { description: { contains: "QA Welcome" } },
      ],
    },
  });

  if (qaUnitIds.length > 0) {
    await prisma.unit.updateMany({
      where: {
        id: { in: qaUnitIds },
        status: UnitStatus.CLEANING,
        reservations: { none: { status: ReservationStatus.CHECKED_IN } },
      },
      data: { status: UnitStatus.READY },
    });
  }

  await prisma.order.deleteMany({ where: { code: { startsWith: "E2E-CAP-" } } });
  await prisma.posItem.deleteMany({
    where: {
      OR: [
        { name: { startsWith: "Media Test" } },
        { name: { startsWith: "Capacity Test" } },
        { name: { startsWith: "QA Adventure" } },
      ],
    },
  });
  await prisma.housekeepingTask.deleteMany({ where: { unit: { code: { startsWith: "QA-LF-" } } } });
  await prisma.unit.deleteMany({ where: { code: { startsWith: "QA-LF-" } } });
  await prisma.$disconnect();
}

async function cleanupUploadFiles() {
  try {
    const uploadDirectory = join(process.cwd(), "public", "uploads", "catalog");
    const files = await readdir(uploadDirectory);
    await Promise.all(
      files
        .filter((file) => file.startsWith("media-test-"))
        .map((file) => unlink(join(uploadDirectory, file))),
    );
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code !== "ENOENT") {
      throw error;
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
