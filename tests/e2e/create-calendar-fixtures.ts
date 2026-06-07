import "dotenv/config";
import { addDays, setHours, startOfDay } from "date-fns";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import {
  BookingSource,
  PaymentStatus,
  ReservationStatus,
  UnitStatus,
} from "../../src/generated/prisma/enums";

const qaUnitCodes = ["QA-CAL-01", "QA-CAL-02"] as const;
const qaBookingCode = "QA-CAL-1001";
const qaGuestName = "QA Calendar Guest";

async function main() {
  const command = process.argv[2] ?? "create";
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required to create calendar fixtures.");
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  if (command === "cleanup") {
    await cleanupCalendarFixtures(prisma);
    await prisma.$disconnect();
    return;
  }

  await cleanupCalendarFixtures(prisma);

  const property = await prisma.property.findFirstOrThrow({ orderBy: { createdAt: "asc" } });
  const unitType =
    (await prisma.unitType.findFirst({
      where: { propertyId: property.id, name: "QA Calendar Suite" },
    })) ??
    (await prisma.unitType.create({
      data: {
        propertyId: property.id,
        name: "QA Calendar Suite",
        description: "Temporary E2E calendar unit type.",
        capacity: 2,
        baseRate: "1550000",
      },
    }));

  const units = await Promise.all(
    qaUnitCodes.map((code) =>
      prisma.unit.upsert({
        where: { code },
        create: {
          propertyId: property.id,
          unitTypeId: unitType.id,
          code,
          name: `Calendar ${code}`,
          status: UnitStatus.READY,
          description: "Temporary calendar E2E unit.",
          amenities: ["QA"],
          photoUrl: "/uploads/demo/unit-geodesic-dome-forest.jpg",
        },
        update: {
          propertyId: property.id,
          unitTypeId: unitType.id,
          name: `Calendar ${code}`,
          status: UnitStatus.READY,
          description: "Temporary calendar E2E unit.",
          amenities: ["QA"],
          photoUrl: "/uploads/demo/unit-geodesic-dome-forest.jpg",
        },
      }),
    ),
  );

  const guest = await prisma.guest.create({
    data: {
      fullName: qaGuestName,
      email: "qa.calendar@example.com",
      phone: "+6281300009900",
      country: "Indonesia",
      guestType: "QA",
      notes: "Temporary calendar E2E guest.",
    },
  });

  const today = startOfDay(new Date());
  const checkInDate = setHours(addDays(today, 5), 14);
  const checkOutDate = setHours(addDays(today, 6), 11);

  await prisma.reservation.create({
    data: {
      bookingCode: qaBookingCode,
      invoiceNumber: `INV-${qaBookingCode}`,
      guestId: guest.id,
      unitId: units[0].id,
      checkInDate,
      checkOutDate,
      adults: 2,
      children: 0,
      status: ReservationStatus.CONFIRMED,
      source: BookingSource.WHATSAPP,
      paymentStatus: PaymentStatus.UNPAID,
      roomRate: "1550000",
      totalAmount: "1550000",
      amountPaid: "0",
      notes: "Temporary calendar E2E reservation.",
    },
  });

  await prisma.$disconnect();
}

async function cleanupCalendarFixtures(prisma: PrismaClient) {
  const qaReservations = await prisma.reservation.findMany({
    where: {
      OR: [
        { bookingCode: { startsWith: "QA-CAL-" } },
        { guest: { fullName: { startsWith: "QA Calendar" } } },
      ],
    },
    select: { id: true },
  });
  const qaReservationIds = qaReservations.map((reservation) => reservation.id);

  await prisma.serviceRequest.deleteMany({ where: { reservationId: { in: qaReservationIds } } });
  await prisma.paymentTransaction.deleteMany({ where: { reservationId: { in: qaReservationIds } } });
  await prisma.orderItem.deleteMany({ where: { order: { reservationId: { in: qaReservationIds } } } });
  await prisma.order.deleteMany({ where: { reservationId: { in: qaReservationIds } } });
  await prisma.communicationLog.updateMany({
    where: {
      OR: [
        { reservationId: { in: qaReservationIds } },
        { guest: { fullName: { startsWith: "QA Calendar" } } },
      ],
    },
    data: {
      guestId: null,
      reservationId: null,
      templateId: null,
    },
  });
  await prisma.reservation.deleteMany({ where: { id: { in: qaReservationIds } } });
  await prisma.unitBlock.deleteMany({
    where: {
      OR: [
        { reason: { contains: "QA Calendar" } },
        { unit: { code: { startsWith: "QA-CAL-" } } },
      ],
    },
  });
  await prisma.housekeepingTask.deleteMany({
    where: {
      OR: [
        { notes: { contains: "QA Calendar" } },
        { unit: { code: { startsWith: "QA-CAL-" } } },
      ],
    },
  });
  await prisma.activityLog.deleteMany({
    where: {
      OR: [
        { description: { contains: "QA Calendar" } },
        { description: { contains: "QA-CAL-" } },
      ],
    },
  });
  await prisma.guest.deleteMany({ where: { fullName: { startsWith: "QA Calendar" } } });
  await prisma.unit.deleteMany({ where: { code: { startsWith: "QA-CAL-" } } });
  await prisma.unitType.deleteMany({
    where: {
      name: "QA Calendar Suite",
      units: { none: {} },
    },
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
