import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

const maxImageUploadBytes = 5 * 1024 * 1024;
const uploadRoot = join(process.cwd(), "public", "uploads");
const allowedImageTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export const optionalImageReferenceSchema = z
  .string()
  .trim()
  .max(2048)
  .optional()
  .or(z.literal(""))
  .refine((value) => !value || isAllowedImageReference(value), {
    message: "Gunakan URL gambar http(s) atau path /uploads/.",
  });

export function normalizeImageReference(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function isAllowedImageReference(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return true;
  }

  if (trimmed.startsWith("/uploads/") || trimmed.startsWith("/images/")) {
    return !trimmed.includes("..") && !trimmed.includes("\\") && !trimmed.includes("//");
  }

  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export async function saveUploadedImage(
  formData: FormData,
  options: {
    directory: string;
    prefix: string;
    fieldName?: string;
  },
) {
  const file = formData.get(options.fieldName ?? "photo");

  if (!(file instanceof File) || file.size === 0) {
    return null;
  }

  const extension = allowedImageTypes.get(file.type);

  if (!extension) {
    throw new Error("Format gambar harus JPG, PNG, atau WebP.");
  }

  if (file.size > maxImageUploadBytes) {
    throw new Error("Ukuran gambar maksimal 5MB.");
  }

  const directory = sanitizeSegment(options.directory);
  const prefix = sanitizeSegment(options.prefix) || "image";
  const fileName = `${prefix}-${Date.now()}-${randomUUID().slice(0, 8)}.${extension}`;
  const targetDirectory = join(uploadRoot, directory);
  const bytes = Buffer.from(await file.arrayBuffer());

  await mkdir(targetDirectory, { recursive: true });
  await writeFile(join(targetDirectory, fileName), bytes);

  return `/uploads/${directory}/${fileName}`;
}

function sanitizeSegment(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
