import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, ReceiptText, UserRound } from "lucide-react";
import { OrderStatus, UserRole } from "@/generated/prisma/enums";
import { AppShell } from "@/components/layout/app-shell";
import { GlassCard } from "@/components/ui/glass-card";
import { PrintInvoiceButton } from "@/components/ui/print-invoice-button";
import { StatusBadge } from "@/components/ui/status-badge";
import { requirePagePermission } from "@/lib/action-guard";
import { redirectWithActionError } from "@/lib/action-feedback";
import { formatDateId, formatIdr } from "@/lib/formatters";
import {
  orderStatusLabels,
  orderStatusTone,
  paymentStatusLabels,
  paymentStatusTone,
  reservationStatusLabels,
  reservationStatusTone,
} from "@/lib/labels";
import {
  calculateBalanceDue,
  getInvoiceNumber,
  getOrderPaidAmount,
  getReservationPaidAmount,
} from "@/lib/payments";
import { canViewOperationalFinancialData, canViewStayFinancialData } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import { countNights } from "@/lib/reservations";

export const dynamic = "force-dynamic";

type ReservationInvoicePageProps = {
  params: Promise<{ id: string }>;
};

export default async function ReservationInvoicePage({ params }: ReservationInvoicePageProps) {
  const { id } = await params;
  const session = await requirePagePermission("reservation:read");
  const role = session.role as UserRole;

  if (!canViewStayFinancialData(role)) {
    redirectWithActionError("/dashboard", "Anda tidak memiliki akses ke invoice.");
  }

  const prisma = getPrisma();
  const [property, reservation] = await Promise.all([
    prisma.property.findUnique({ where: { id: session.propertyId } }),
    prisma.reservation.findFirst({
      where: { id, unit: { propertyId: session.propertyId } },
      include: {
        guest: true,
        unit: { include: { unitType: true } },
        orders: { include: { items: true }, orderBy: { createdAt: "asc" } },
      },
    }),
  ]);

  if (!reservation || !property) {
    notFound();
  }

  const canViewOrderFinancials = canViewOperationalFinancialData(role);
  const nights = countNights(reservation.checkInDate, reservation.checkOutDate);
  const roomRate = Number(reservation.roomRate);
  const roomGross = roomRate * nights;
  const discount = Number(reservation.discount);
  const reservationTotal = Number(reservation.totalAmount);
  const activeOrders = reservation.orders.filter((order) => order.status !== OrderStatus.CANCELLED);
  const orderTotal = activeOrders.reduce((sum, order) => sum + Number(order.total), 0);
  const paidOrderTotal = activeOrders.reduce((sum, order) => sum + getOrderPaidAmount(order), 0);
  const reservationPaid = getReservationPaidAmount({
    amountPaid: reservation.amountPaid,
    paymentStatus: reservation.paymentStatus,
    totalAmount: reservation.totalAmount,
  });
  const folioTotal = reservationTotal + orderTotal;
  const paidTotal = reservationPaid + paidOrderTotal;
  const balanceDue = calculateBalanceDue(folioTotal, paidTotal);
  const invoiceNumber = getInvoiceNumber(reservation);

  return (
    <AppShell>
      <div className="flex flex-col gap-4 print:hidden md:flex-row md:items-center md:justify-between">
        <Link href={`/reservations/${reservation.id}`} className="inline-flex items-center gap-2 text-sm font-bold text-[#b8fbff]">
          <ArrowLeft className="size-4" />
          Kembali ke Detail Reservasi
        </Link>
        <PrintInvoiceButton />
      </div>

      <GlassCard variant="strong" className="mt-5 p-6 print:mt-0 print:rounded-none print:border print:border-slate-200 print:bg-white print:p-8 print:text-slate-950">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-3 text-[#b8fbff] print:text-slate-800">
              <ReceiptText className="size-7" />
              <p className="text-sm font-black uppercase tracking-normal">Invoice</p>
            </div>
            <h1 className="mt-3 font-mono text-4xl font-black tracking-normal text-white print:text-slate-950">{invoiceNumber}</h1>
            <p className="mt-2 text-sm font-semibold text-white/58 print:text-slate-600">{reservation.bookingCode}</p>
          </div>
          <div className="text-left md:text-right">
            <p className="text-2xl font-black text-white print:text-slate-950">{property.name}</p>
            <p className="mt-2 max-w-sm text-sm font-semibold leading-6 text-white/58 print:text-slate-600">{property.address ?? "Alamat properti belum diisi."}</p>
            <p className="mt-1 text-sm font-semibold text-white/58 print:text-slate-600">{property.phone ?? property.email ?? "-"}</p>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-4">
          <InfoBlock icon={<UserRound className="size-4" />} label="Guest" value={reservation.guest.fullName} />
          <InfoBlock icon={<CalendarDays className="size-4" />} label="Check-in" value={formatDateId(reservation.checkInDate)} />
          <InfoBlock icon={<CalendarDays className="size-4" />} label="Check-out" value={formatDateId(reservation.checkOutDate)} />
          <InfoBlock label="Unit" value={reservation.unit ? `${reservation.unit.code} - ${reservation.unit.name}` : "Unassigned"} />
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <StatusBadge label={reservationStatusLabels[reservation.status]} tone={reservationStatusTone[reservation.status]} />
          <StatusBadge label={paymentStatusLabels[reservation.paymentStatus]} tone={paymentStatusTone[reservation.paymentStatus]} dot />
        </div>

        <section className="mt-8">
          <h2 className="text-xl font-black text-white print:text-slate-950">Charges</h2>
          <div className="mt-4 overflow-hidden rounded-[22px] border border-white/10 print:rounded-none print:border-slate-200">
            <InvoiceRow label={`${reservation.unit?.unitType.name ?? "Room"} - ${nights} malam`} detail={reservation.unit?.code ?? "Unit"} amount={roomGross} />
            {discount > 0 ? <InvoiceRow label="Discount" detail="Reservation discount" amount={-discount} /> : null}
            <InvoiceRow label="Reservation total" detail="Room charge after discount" amount={reservationTotal} strong />
            {activeOrders.map((order) => (
              <InvoiceRow
                key={order.id}
                label={`Order ${order.code}`}
                detail={order.items.map((item) => `${item.quantity}x ${item.name}`).join(", ") || orderStatusLabels[order.status]}
                amount={canViewOrderFinancials ? Number(order.total) : 0}
                status={<StatusBadge label={orderStatusLabels[order.status]} tone={orderStatusTone[order.status]} />}
              />
            ))}
          </div>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-[1fr_360px]">
          <div className="rounded-[22px] surface-inset p-5 print:rounded-none print:border print:border-slate-200 print:bg-white">
            <h3 className="text-lg font-black text-white print:text-slate-950">Payment Notes</h3>
            <p className="mt-3 text-sm font-semibold leading-6 text-white/58 print:text-slate-600">
              {reservation.paymentNotes ?? "Tidak ada catatan pembayaran tambahan."}
            </p>
          </div>
          <div className="rounded-[22px] surface-inset p-5 print:rounded-none print:border print:border-slate-200 print:bg-white">
            <SummaryRow label="Folio total" value={folioTotal} />
            <SummaryRow label="Amount collected" value={paidTotal} />
            <SummaryRow label="Balance due" value={balanceDue} strong />
          </div>
        </section>
      </GlassCard>
    </AppShell>
  );
}

function InfoBlock({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-[22px] surface-inset p-4 print:rounded-none print:border print:border-slate-200 print:bg-white">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-normal text-white/42 print:text-slate-500">
        {icon}
        {label}
      </p>
      <p className="mt-2 font-black text-white print:text-slate-950">{value}</p>
    </div>
  );
}

function InvoiceRow({
  amount,
  detail,
  label,
  status,
  strong = false,
}: {
  amount: number;
  detail: string;
  label: string;
  status?: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="grid gap-3 border-b border-white/8 px-4 py-4 last:border-b-0 print:border-slate-200 md:grid-cols-[1fr_160px]">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className={strong ? "font-black text-white print:text-slate-950" : "font-bold text-white print:text-slate-900"}>{label}</p>
          {status}
        </div>
        <p className="mt-1 text-xs font-semibold text-white/48 print:text-slate-500">{detail}</p>
      </div>
      <p className={strong ? "text-right text-lg font-black text-[#b8fbff] print:text-slate-950" : "text-right text-sm font-black text-white print:text-slate-950"}>
        {formatIdr(amount)}
      </p>
    </div>
  );
}

function SummaryRow({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/8 py-3 last:border-b-0 print:border-slate-200">
      <span className="text-sm font-semibold text-white/58 print:text-slate-600">{label}</span>
      <span className={strong ? "text-xl font-black text-[#b8fbff] print:text-slate-950" : "text-sm font-black text-white print:text-slate-950"}>
        {formatIdr(value)}
      </span>
    </div>
  );
}
