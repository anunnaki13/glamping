import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { readdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { PrismaClient } from "../../src/generated/prisma/client";

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
  await prisma.posItem.deleteMany({ where: { name: { startsWith: "Media Test" } } });
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
