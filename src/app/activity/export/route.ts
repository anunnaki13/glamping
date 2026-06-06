import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { formatDateTimeId } from "@/lib/formatters";
import { hasPermission } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import { redirectToLogin, redirectWithRouteFeedback } from "@/lib/route-feedback";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getCurrentSession();

  if (!session) {
    return redirectToLogin(request, "/activity");
  }

  if (!hasPermission(session.role, "activity:read")) {
    return redirectWithRouteFeedback(request, "/dashboard", {
      status: "error",
      message: "Anda tidak memiliki akses ke activity log.",
    });
  }

  const prisma = getPrisma();
  const users = await prisma.user.findMany({
    where: { propertyId: session.propertyId },
    select: { id: true, name: true, email: true, role: true },
  });
  const propertyUserIds = users.map((user) => user.id);
  const actor = request.nextUrl.searchParams.get("actor");
  const scopedActorIds = actor && propertyUserIds.includes(actor) ? [actor] : propertyUserIds;
  const query = request.nextUrl.searchParams.get("q")?.trim() || undefined;
  const action = request.nextUrl.searchParams.get("action")?.trim() || undefined;
  const entity = request.nextUrl.searchParams.get("entity")?.trim() || undefined;
  const userMap = new Map(users.map((user) => [user.id, user]));
  const activities = await prisma.activityLog.findMany({
    where: {
      actorId: { in: scopedActorIds },
      action,
      entityType: entity,
      OR: query
        ? [
            { action: { contains: query, mode: "insensitive" } },
            { entityType: { contains: query, mode: "insensitive" } },
            { entityId: { contains: query, mode: "insensitive" } },
            { description: { contains: query, mode: "insensitive" } },
          ]
        : undefined,
    },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });
  const rows: Array<Array<string | number>> = [
    ["Smart Glamping OS Activity Log"],
    ["Property", session.propertyName],
    ["Exported At", formatDateTimeId(new Date())],
    ["Filters", `q=${query ?? ""}; action=${action ?? ""}; entity=${entity ?? ""}; actor=${actor ?? ""}`],
    [],
    ["Created At", "Actor", "Actor Email", "Actor Role", "Action", "Entity Type", "Entity ID", "Description", "Metadata"],
    ...activities.map((activity) => {
      const actorUser = activity.actorId ? userMap.get(activity.actorId) : null;

      return [
        formatDateTimeId(activity.createdAt),
        actorUser?.name ?? "Unknown",
        actorUser?.email ?? "",
        actorUser?.role ?? "",
        activity.action,
        activity.entityType,
        activity.entityId ?? "",
        activity.description ?? "",
        activity.metadata ? JSON.stringify(activity.metadata) : "",
      ];
    }),
  ];
  const csv = toCsv(rows);
  const filename = `smart-glamping-activity-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(`\uFEFF${csv}`, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function toCsv(rows: Array<Array<string | number>>) {
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

function csvCell(value: string | number) {
  const text = String(value);

  if (/[",\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}
