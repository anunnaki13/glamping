import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import { PosCategory, UnitStatus } from "../../src/generated/prisma/enums";

async function main() {
  const [unitCode, itemName] = process.argv.slice(2);
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required to create lifecycle fixtures.");
  }

  if (!unitCode || !itemName) {
    throw new Error("Usage: tsx tests/e2e/create-lifecycle-fixtures.ts <unitCode> <itemName>");
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  const property = await prisma.property.findFirstOrThrow({ orderBy: { createdAt: "asc" } });
  const unitType =
    (await prisma.unitType.findFirst({
      where: { propertyId: property.id },
      orderBy: { createdAt: "asc" },
    })) ??
    (await prisma.unitType.create({
      data: {
        propertyId: property.id,
        name: "QA Glamping Suite",
        description: "Temporary lifecycle QA unit type.",
        capacity: 2,
        baseRate: "1500000",
      },
    }));

  await prisma.unit.upsert({
    where: { code: unitCode },
    create: {
      propertyId: property.id,
      unitTypeId: unitType.id,
      code: unitCode,
      name: `Lifecycle ${unitCode}`,
      status: UnitStatus.READY,
      description: "Temporary E2E lifecycle unit.",
      amenities: ["QA"],
      photoUrl: "/uploads/demo/units-jungle-dome.jpg",
    },
    update: {
      propertyId: property.id,
      unitTypeId: unitType.id,
      name: `Lifecycle ${unitCode}`,
      status: UnitStatus.READY,
      description: "Temporary E2E lifecycle unit.",
      amenities: ["QA"],
      photoUrl: "/uploads/demo/units-jungle-dome.jpg",
    },
  });

  const existingItem = await prisma.posItem.findFirst({ where: { name: itemName } });
  const itemData = {
    category: PosCategory.ACTIVITY,
    price: "250000",
    description: "Temporary E2E activity item.",
    photoUrl: "/uploads/demo/catalog-guided-trek.jpg",
    isActive: true,
    isAvailable: true,
    leadTimeMinutes: 20,
    dailyCapacity: null,
    slotLabel: "Sunrise",
  };

  if (existingItem) {
    await prisma.posItem.update({
      where: { id: existingItem.id },
      data: itemData,
    });
  } else {
    await prisma.posItem.create({
      data: {
      name: itemName,
        ...itemData,
      },
    });
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
