import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { formatDateInput, getReportData, parseReportRange } from "@/lib/reports";
import { canViewStayFinancialData, hasPermission } from "@/lib/permissions";
import { redirectToLogin, redirectWithRouteFeedback } from "@/lib/route-feedback";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getCurrentSession();

  if (!session) {
    return redirectToLogin(request, "/reports");
  }

  if (!hasPermission(session.role, "report:read")) {
    return redirectWithRouteFeedback(request, "/dashboard", {
      status: "error",
      message: "Anda tidak memiliki akses ke laporan.",
    });
  }

  if (!canViewStayFinancialData(session.role)) {
    return redirectWithRouteFeedback(request, "/reports", {
      status: "error",
      message: "Export CSV laporan hanya tersedia untuk role yang boleh melihat revenue stay.",
    });
  }

  const range = parseReportRange({
    from: request.nextUrl.searchParams.get("from") ?? undefined,
    to: request.nextUrl.searchParams.get("to") ?? undefined,
  });
  const report = await getReportData(session.propertyId, range);
  const rows: Array<Array<string | number>> = [
    ["Smart Glamping OS Report"],
    ["Property", session.propertyName],
    ["Period", `${range.fromInput} to ${range.toInput}`],
    [],
    ["Summary"],
    ["Metric", "Value"],
    ["Total Units", report.summary.totalUnits],
    ["Period Days", report.summary.periodDays],
    ["Room Nights Available", report.summary.roomNightsAvailable],
    ["Occupied Room Nights", report.summary.occupiedRoomNights],
    ["Occupancy Rate", `${report.summary.occupancyRate}%`],
    ["Reservation Revenue", report.summary.reservationRevenue],
    ["Order Revenue", report.summary.orderRevenue],
    ["Total Revenue", report.summary.totalRevenue],
    ["ADR", report.summary.adr],
    ["RevPAR", report.summary.revPar],
    ["Total Reservations", report.summary.totalReservations],
    ["Open Requests", report.summary.openRequests],
    ["SLA Completion", `${report.summary.slaCompletionRate}%`],
    [],
    ["Daily Performance"],
    ["Date", "Occupied", "Occupancy %", "Reservation Revenue", "Order Revenue", "Total Revenue", "Requests Created"],
    ...report.dailyRows.map((row) => [
      formatDateInput(row.date),
      row.occupied,
      row.occupancy,
      row.reservationRevenue,
      row.orderRevenue,
      row.totalRevenue,
      row.requestsCreated,
    ]),
    [],
    ["Booking Sources"],
    ["Source", "Count"],
    ...report.bookingSources.map((source) => [source.label, source.count]),
    [],
    ["Service Request Status"],
    ["Status", "Count"],
    ...report.requestStatus.map((status) => [status.label, status.count]),
    [],
    ["Top POS Items"],
    ["Item", "Quantity", "Revenue"],
    ...report.topItems.map((item) => [item.name, item.quantity, item.revenue]),
    [],
    ["Recent Reservations"],
    ["Booking Code", "Guest", "Unit", "Check-in", "Check-out", "Status", "Revenue"],
    ...report.recentReservations.map((reservation) => [
      reservation.bookingCode,
      reservation.guest.fullName,
      reservation.unit?.code ?? "",
      formatDateInput(reservation.checkInDate),
      formatDateInput(reservation.checkOutDate),
      reservation.status,
      Number(reservation.totalAmount),
    ]),
  ];
  const csv = toCsv(rows);
  const filename = `smart-glamping-report-${range.fromInput}-${range.toInput}.csv`;

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
