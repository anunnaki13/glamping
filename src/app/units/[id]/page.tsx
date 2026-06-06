/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BedDouble, Save } from "lucide-react";
import { UnitStatus, UserRole } from "@/generated/prisma/enums";
import { AppShell } from "@/components/layout/app-shell";
import { ActionFeedbackBanner } from "@/components/ui/action-feedback-banner";
import { GlassCard } from "@/components/ui/glass-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { updateUnitAction } from "@/app/units/actions";
import { requirePagePermission } from "@/lib/action-guard";
import { getActionFeedback, type ActionFeedbackSearchParams } from "@/lib/action-feedback";
import { formatDateId, formatIdr } from "@/lib/formatters";
import {
  housekeepingStatusLabels,
  housekeepingStatusTone,
  priorityLabels,
  reservationStatusLabels,
  reservationStatusTone,
  unitStatusLabels,
  unitStatusTone,
} from "@/lib/labels";
import { canViewStayFinancialData, hasPermission } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type UnitDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<ActionFeedbackSearchParams>;
};

export default async function UnitDetailPage({ params, searchParams }: UnitDetailPageProps) {
  const { id } = await params;
  const session = await requirePagePermission("unit:read");
  const feedback = getActionFeedback(await searchParams);
  const role = session.role as UserRole;
  const canWrite = hasPermission(role, "unit:write");
  const canViewFinancials = canViewStayFinancialData(role);
  const prisma = getPrisma();

  const [unit, unitTypes] = await Promise.all([
    prisma.unit.findFirst({
      where: { id, propertyId: session.propertyId },
      include: {
        unitType: true,
        reservations: {
          orderBy: { checkInDate: "desc" },
          take: 6,
          include: { guest: true },
        },
        housekeepingTasks: {
          orderBy: { createdAt: "desc" },
          take: 6,
        },
      },
    }),
    prisma.unitType.findMany({
      where: { propertyId: session.propertyId },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!unit) {
    notFound();
  }

  const updateAction = updateUnitAction.bind(null, unit.id);
  const amenities = Array.isArray(unit.amenities) ? unit.amenities.map(String).join(", ") : "";

  return (
    <AppShell>
      <Link href="/units" className="inline-flex items-center gap-2 text-sm font-bold text-[#b8fbff]">
        <ArrowLeft className="size-4" />
        Kembali ke Units
      </Link>

      <ActionFeedbackBanner feedback={feedback} />

      <section className="mt-5 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <GlassCard variant="strong" className="overflow-hidden p-0">
          <div className="relative min-h-72 overflow-hidden bg-[linear-gradient(135deg,rgba(41,241,255,0.18),transparent_44%),linear-gradient(145deg,rgba(16,29,39,0.95),rgba(7,16,23,0.86))] p-6">
            {unit.photoUrl ? (
              <img src={unit.photoUrl} alt={`${unit.name} photo`} className="absolute inset-0 h-full w-full object-cover" />
            ) : null}
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,8,12,0.18),rgba(2,8,12,0.86)),linear-gradient(135deg,rgba(41,241,255,0.16),transparent_48%)]" />
            <div className="relative z-10">
              <StatusBadge label={unitStatusLabels[unit.status]} tone={unitStatusTone[unit.status]} dot />
            </div>
            <div className="absolute bottom-6 left-6 right-6 z-10">
              <div className="grid size-16 place-items-center rounded-[24px] border border-white/12 bg-white/10 text-[#b8fbff]">
                <BedDouble className="size-8" />
              </div>
              <h2 className="mt-5 text-4xl font-black tracking-normal text-white">{unit.code}</h2>
              <p className="mt-2 text-lg font-bold text-white/72">{unit.name}</p>
            </div>
          </div>

          <div className="grid gap-3 p-5 sm:grid-cols-2">
            <InfoBlock label="Unit type" value={unit.unitType.name} />
            <InfoBlock label="Capacity" value={`${unit.unitType.capacity} guests`} />
            {canViewFinancials ? <InfoBlock label="Base rate" value={formatIdr(Number(unit.unitType.baseRate))} /> : null}
            <InfoBlock label="Last updated" value={formatDateId(unit.updatedAt)} />
          </div>
        </GlassCard>

        {canWrite ? (
          <GlassCard className="p-5">
            <h3 className="text-xl font-black text-white">Edit Unit</h3>
            <p className="mt-2 text-sm leading-6 text-white/58">Perubahan status dan detail unit akan dicatat di activity log.</p>

            <form action={updateAction} className="mt-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Kode unit" name="code" defaultValue={unit.code} required />
                <TextField label="Nama unit" name="name" defaultValue={unit.name} required />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField label="Unit type" name="unitTypeId" defaultValue={unit.unitTypeId} required>
                  {unitTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name} · {formatIdr(Number(type.baseRate))}
                    </option>
                  ))}
                </SelectField>
                <SelectField label="Status" name="status" defaultValue={unit.status} required>
                  {Object.values(UnitStatus).map((status) => (
                    <option key={status} value={status}>
                      {unitStatusLabels[status]}
                    </option>
                  ))}
                </SelectField>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FileField label="Replace foto" name="photo" />
                <TextField label="Photo URL / path" name="photoUrl" defaultValue={unit.photoUrl ?? ""} />
              </div>
              <TextArea label="Amenities" name="amenities" defaultValue={amenities} />
              <TextArea label="Deskripsi" name="description" defaultValue={unit.description ?? ""} />
              <TextArea label="Notes internal" name="notes" defaultValue={unit.notes ?? ""} />
              <button className="gold-gradient inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[22px] px-4 text-sm font-black text-[#041015]">
                <Save className="size-5" />
                Simpan Perubahan
              </button>
            </form>
          </GlassCard>
        ) : (
          <GlassCard className="p-5">
            <h3 className="text-xl font-black text-white">Unit Snapshot</h3>
            <p className="mt-2 text-sm leading-6 text-white/58">Role ini memiliki akses baca unit. Perubahan status hanya tersedia untuk manager/owner.</p>
            <div className="mt-5 grid gap-3">
              <InfoBlock label="Amenities" value={amenities || "-"} />
              <InfoBlock label="Deskripsi" value={unit.description ?? "-"} />
              <InfoBlock label="Notes internal" value={unit.notes ?? "-"} />
            </div>
          </GlassCard>
        )}
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-2">
        <GlassCard className="p-5">
          <h3 className="text-lg font-black text-white">Reservation History</h3>
          <div className="mt-4 space-y-3">
            {unit.reservations.map((reservation) => (
              <div key={reservation.id} className="rounded-[22px] surface-inset p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-white">{reservation.guest.fullName}</p>
                    <p className="mt-1 text-xs font-semibold text-white/52">
                      {formatDateId(reservation.checkInDate)} - {formatDateId(reservation.checkOutDate)}
                    </p>
                  </div>
                  <StatusBadge label={reservationStatusLabels[reservation.status]} tone={reservationStatusTone[reservation.status]} />
                </div>
              </div>
            ))}
            {unit.reservations.length === 0 ? <EmptyLine label="Belum ada riwayat reservasi untuk unit ini." /> : null}
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <h3 className="text-lg font-black text-white">Housekeeping History</h3>
          <div className="mt-4 space-y-3">
            {unit.housekeepingTasks.map((task) => (
              <div key={task.id} className="rounded-[22px] surface-inset p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-white">{task.taskType}</p>
                    <p className="mt-1 text-xs font-semibold text-white/52">
                      {task.assignedTo ?? "Unassigned"} · {priorityLabels[task.priority]}
                    </p>
                  </div>
                  <StatusBadge label={housekeepingStatusLabels[task.status]} tone={housekeepingStatusTone[task.status]} />
                </div>
              </div>
            ))}
            {unit.housekeepingTasks.length === 0 ? <EmptyLine label="Belum ada task housekeeping untuk unit ini." /> : null}
          </div>
        </GlassCard>
      </section>
    </AppShell>
  );
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

function FileField(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string }) {
  const { label, ...inputProps } = props;
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-normal text-white/52">{label}</span>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className={`${fieldClass()} pt-3 file:mr-3 file:rounded-[14px] file:border-0 file:bg-white/12 file:px-3 file:py-1.5 file:text-xs file:font-black file:text-white`}
        {...inputProps}
      />
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

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] surface-inset p-4">
      <p className="text-xs font-bold uppercase tracking-normal text-white/42">{label}</p>
      <p className="mt-2 font-bold text-white">{value}</p>
    </div>
  );
}

function EmptyLine({ label }: { label: string }) {
  return (
    <div className="rounded-[22px] border border-dashed border-white/10 bg-white/[0.025] p-5 text-center text-sm font-semibold text-white/42">
      {label}
    </div>
  );
}
