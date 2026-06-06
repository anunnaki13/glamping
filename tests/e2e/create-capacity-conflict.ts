import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  OrderStatus,
  PaymentStatus,
  PrismaClient,
  ReservationStatus,
} from "../../src/generated/prisma/client";

async function main() {
  const itemName = process.argv[2];
  const connectionString = process.env.DATABASE_URL;

  if (!itemName) {
    throw new Error("Item name argument is required.");
  }

  if (!connectionString) {
    throw new Error("DATABASE_URL is required.");
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  try {
    const [item, reservation] = await Promise.all([
      prisma.posItem.findFirstOrThrow({ where: { name: itemName } }),
      prisma.reservation.findFirstOrThrow({
        where: {
          status: { in: [ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN] },
        },
      }),
    ]);

    await prisma.order.create({
      data: {
        code: `E2E-CAP-${Date.now()}`,
        reservationId: reservation.id,
        guestId: reservation.guestId,
        status: OrderStatus.CONFIRMED,
        paymentStatus: PaymentStatus.UNPAID,
        subtotal: String(item.price),
        total: String(item.price),
        items: {
          create: {
            itemId: item.id,
            name: item.name,
            quantity: 1,
            price: String(item.price),
            total: String(item.price),
          },
        },
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
