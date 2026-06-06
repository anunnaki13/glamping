import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();

  try {
    await getPrisma().$queryRaw`SELECT 1`;

    return NextResponse.json({
      status: "ok",
      database: "ok",
      service: "smart-glamping-os",
      version: process.env.npm_package_version ?? "unknown",
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
    });
  } catch {
    return NextResponse.json(
      {
        status: "error",
        database: "error",
        service: "smart-glamping-os",
        checkedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
      },
      { status: 503 },
    );
  }
}
