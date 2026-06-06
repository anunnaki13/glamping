import Link from "next/link";
import { addDays } from "date-fns";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CalendarSearch, Save } from "lucide-react";
import {
  BookingSource,
  PaymentStatus,
  ReservationStatus,
} from "@/generated/prisma/enums";
import { updateReservationAction } from "@/app/reservations/actions";
import { AppShell } from "@/components/layout/app-shell";
import { ActionFeedbackBanner } from "@/components/ui/action-feedback-banner";
import { CurrencyInput } from "@/components/ui/currency-input";
import { GlassCard } from "@/components/ui/glass-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { requirePagePermission } from "@/lib/action-guard";
import { getActionFeedback, type ActionFeedbackSearchParams } from "@/lib/action-feedback";
import { formatIdr } from "@/lib/formatters";
import {
  bookingSourceLabels,
  paymentStatusLabels,
  reservationStatusLabels,
  unitStatusLabels,
  unitStatusTone,
} from "@/lib/labels";
import { getPrisma } from "@/lib/prisma";
import { formatDateInput, getAvailableUnitIds, parseStayDate } from "@/lib/reservations";

export const dynamic = "force-dynamic";

const preArrivalReservationStatuses = [
  ReservationStatus.PENDING,
  ReservationStatus.CONFIRMED,
] as const;

const terminalPreArrivalReservationStatuses = [
  ReservationStatus.CANCELLED,
  ReservationStatus.NO_SHOW,
] as const;

type EditReservationPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ checkIn?: string; checkOut?: string } & ActionFeedbackSearchParams>;
};

export default async function EditReservationPage({ params, searchParams }: EditReservationPageProps) {
  const { id } = await params;
  const session = await requirePagePermission("reservation:write");
  const prisma = getPrisma();
  const reservation = await prisma.reservation.findFirst({
    where: { id, unit: { propertyId: session.propertyId } },
    include: { guest: true, unit: { include: { unitType: true } } },
  });

  if (!reservation) {
    notFound();
  }

  if (!preArrivalReservationStatuses.includes(reservation.status as (typeof preArrivalReservationStatuses)[number])) {
    redirect(`/reservations/${reservation.id}`);
  }

  const query = await searchParams;
  const feedback = getActionFeedback(query);
  const checkInValue = query.checkIn ?? formatDateInput(reservation.checkInDate);
  const checkOutValue = query.checkOut ?? formatDateInput(reservation.checkOutDate ?? addDays(reservation.checkInDate, 1));
  const checkInDate = parseStayDate(checkInValue, 14);
  const checkOutDate = parseStayDate(checkOutValue, 11);
  const [guests, units, availableUnitIds] = await Promise.all([
    prisma.guest.findMany({ orderBy: { fullName: "asc" }, take: 100 }),
    prisma.unit.findMany({
      where: { propertyId: session.propertyId },
      include: { unitType: true },
      orderBy: { code: "asc" },
    }),
    getAvailableUnitIds({
      propertyId: session.propertyId,
      checkInDate,
      checkOutDate,
      currentReservationId: reservation.id,
    }),
  ]);

  const updateAction = updateReservationAction.bind(null, reservation.id);
  const statusOptions = editableReservationStatuses(reservation.status);

  return (
    <AppShell>
      <Link href={`/reservations/${reservation.id}`} className="inline-flex items-center gap-2 text-sm font-bold text-[#b8fbff]">
        <ArrowLeft className="size-4" />
        Kembali ke Detail Reservasi
      </Link>

      <div className="mt-5">
        <h2 className="text-3xl font-black tracking-normal text-white">Edit Reservasi {reservation.bookingCode}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/62">
          Ubah guest, unit, tanggal, status, payment, deposit, atau catatan. Sistem tetap memblokir overlap aktif.
        </p>
      </div>

      <ActionFeedbackBanner feedback={feedback} />

      <GlassCard variant="strong" className="mt-6 p-5">
        <form className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
          <TextField label="Check-in" name="checkIn" type="date" defaultValue={checkInValue} required />
          <TextField label="Check-out" name="checkOut" type="date" defaultValue={checkOutValue} required />
          <button className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-[22px] border border-[#29f1ff]/24 bg-[#29f1ff]/10 px-5 text-sm font-black text-[#b8fbff]">
            <CalendarSearch className="size-5" />
            Refresh Availability
          </button>
        </form>
      </GlassCard>

      <section className="mt-5 grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <GlassCard variant="strong" className="p-5">
          <h3 className="text-xl font-black text-white">Reservation Form</h3>
          <form action={updateAction} className="mt-5 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <TextField label="Check-in" name="checkInDate" type="date" defaultValue={checkInValue} required />
              <TextField label="Check-out" name="checkOutDate" type="date" defaultValue={checkOutValue} required />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <SelectField label="Guest" name="guestId" defaultValue={reservation.guestId} required>
                {guests.map((guest) => (
                  <option key={guest.id} value={guest.id}>
                    {guest.fullName} · {guest.phone ?? guest.email ?? "no contact"}
                  </option>
                ))}
              </SelectField>
              <SelectField label="Unit" name="unitId" defaultValue={reservation.unitId ?? undefined} required>
                {units.map((unit) => {
                  const available = availableUnitIds.has(unit.id);
                  return (
                    <option key={unit.id} value={unit.id} disabled={!available}>
                      {unit.code} · {unit.unitType.name} · {available ? "Date available" : "Date blocked"} · {unitStatusLabels[unit.status]}
                    </option>
                  );
                })}
              </SelectField>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <TextField label="Adults" name="adults" type="number" min="1" defaultValue={reservation.adults} required />
              <TextField label="Children" name="children" type="number" min="0" defaultValue={reservation.children} required />
              <MoneyField label="Room rate" name="roomRate" defaultValue={Number(reservation.roomRate)} required />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <MoneyField label="Discount" name="discount" defaultValue={Number(reservation.discount)} />
              <SelectField label="Booking source" name="source" defaultValue={reservation.source} required>
                {Object.values(BookingSource).map((source) => (
                  <option key={source} value={source}>
                    {bookingSourceLabels[source]}
                  </option>
                ))}
              </SelectField>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <SelectField label="Reservation status" name="status" defaultValue={reservation.status} required>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {reservationStatusLabels[status]}
                  </option>
                ))}
              </SelectField>
              <SelectField label="Payment status" name="paymentStatus" defaultValue={reservation.paymentStatus} required>
                {Object.values(PaymentStatus).map((status) => (
                  <option key={status} value={status}>
                    {paymentStatusLabels[status]}
                  </option>
                ))}
              </SelectField>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <MoneyField label="Amount paid / deposit" name="amountPaid" defaultValue={Number(reservation.amountPaid)} />
              <TextArea label="Payment notes" name="paymentNotes" defaultValue={reservation.paymentNotes ?? ""} />
            </div>
            <TextArea label="Internal notes" name="notes" defaultValue={reservation.notes ?? ""} />
            <button className="gold-gradient inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[22px] px-4 text-sm font-black text-[#041015]">
              <Save className="size-5" />
              Simpan Perubahan
            </button>
          </form>
        </GlassCard>

        <GlassCard className="p-5">
          <h3 className="text-xl font-black text-white">Availability Preview</h3>
          <div className="mt-5 space-y-3">
            {units.map((unit) => {
              const available = availableUnitIds.has(unit.id);
              return (
                <div key={unit.id} className="rounded-[22px] surface-inset p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-white">{unit.code} · {unit.name}</p>
                      <p className="mt-1 text-xs font-semibold text-white/52">{unit.unitType.name} · {formatIdr(Number(unit.unitType.baseRate))}</p>
                    </div>
                    <StatusBadge label={available ? "Available" : "Blocked"} tone={available ? "success" : "danger"} dot />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <StatusBadge label={unitStatusLabels[unit.status]} tone={unitStatusTone[unit.status]} />
                    <StatusBadge label={`${unit.unitType.capacity} guests`} tone="muted" />
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>
      </section>
    </AppShell>
  );
}

function editableReservationStatuses(status: ReservationStatus): ReservationStatus[] {
  if (preArrivalReservationStatuses.includes(status as (typeof preArrivalReservationStatuses)[number])) {
    return [...preArrivalReservationStatuses, ...terminalPreArrivalReservationStatuses];
  }

  return [status];
}

function fieldClass() {
  return "mt-2 min-h-12 w-full rounded-[22px] surface-field px-4 text-sm font-semibold text-white outline-none transition placeholder:text-white/34 focus:border-[#29f1ff]/50";
}

function TextField(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string }) {
  const { label, ...inputProps } = props;
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-normal text-white/52">{label}</span>
      <input className={fieldClass()} {...inputProps} />
    </label>
  );
}

function MoneyField(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string }) {
  const { label, ...inputProps } = props;
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-normal text-white/52">{label}</span>
      <CurrencyInput className={fieldClass()} {...inputProps} />
    </label>
  );
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; name: string }) {
  const { label, ...textareaProps } = props;
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-normal text-white/52">{label}</span>
      <textarea className={`${fieldClass()} min-h-28 py-3`} {...textareaProps} />
    </label>
  );
}

function SelectField(props: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; name: string }) {
  const { label, children, ...selectProps } = props;
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-normal text-white/52">{label}</span>
      <select className={fieldClass()} {...selectProps}>
        {children}
      </select>
    </label>
  );
}
