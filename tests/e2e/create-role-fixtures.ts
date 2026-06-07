import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../../src/generated/prisma/client";
import { UserRole } from "../../src/generated/prisma/enums";

const viewerEmail = "qa-viewer@nusaescape.local";
const viewerPassword = "password123";

async function main() {
  const command = process.argv[2] ?? "create";
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required to create role fixtures.");
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  if (command === "cleanup") {
    const viewer = await prisma.user.findUnique({ where: { email: viewerEmail } });

    if (viewer) {
      await prisma.activityLog.deleteMany({
        where: {
          OR: [
            { actorId: viewer.id },
            { description: { contains: "QA Viewer" } },
          ],
        },
      });
    }

    await prisma.user.deleteMany({ where: { email: viewerEmail } });
    await prisma.$disconnect();
    return;
  }

  const property = await prisma.property.findFirstOrThrow({ orderBy: { createdAt: "asc" } });
  const passwordHash = await bcrypt.hash(viewerPassword, 12);

  await prisma.user.upsert({
    where: { email: viewerEmail },
    create: {
      propertyId: property.id,
      name: "QA Viewer",
      email: viewerEmail,
      passwordHash,
      role: UserRole.VIEWER,
      isActive: true,
    },
    update: {
      propertyId: property.id,
      name: "QA Viewer",
      passwordHash,
      role: UserRole.VIEWER,
      isActive: true,
    },
  });

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
