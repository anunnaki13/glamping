/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type { ReactNode } from "react";
import { BedDouble, CircleAlert, Plus, Users } from "lucide-react";
import { UnitStatus, UserRole } from "@/generated/prisma/enums";
import { AppShell } from "@/components/layout/app-shell";
import { ActionFeedbackBanner } from "@/components/ui/action-feedback-banner";
import { GlassCard } from "@/components/ui/glass-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { updateUnitStatusAction } from "@/app/units/actions";
import { getActionFeedback, type ActionFeedbackSearchParams } from "@/lib/action-feedback";
import { formatIdr } from "@/lib/formatters";
import {
  housekeepingStatusLabels,
  reservationStatusLabels,
  unitStatusDescriptions,
  unitStatusLabels,
  unitStatusTone,
} from "@/lib/labels";
import { getPrisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/action-guard";
import { canViewStayFinancialData, hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const statusOrder = [
  UnitStatus.AVAILABLE,
  UnitStatus.OCCUPIED,
  UnitStatus.DIRTY,
  UnitStatus.CLEANING,
  UnitStatus.READY,
  UnitStatus.MAINTENANCE,
  UnitStatus.OUT_OF_ORDER,
];

type UnitsPageProps = {
  searchParams: Promise<ActionFeedbackSearchParams>;
};

export default async function UnitsPage({ searchParams }: UnitsPageProps) {
  const session = await requirePagePermission("unit:read");
  const feedback = getActionFeedback(await searchParams);
  const role = session.role as UserRole;
  const canWrite = hasPermission(role, "unit:write");
  const canViewFinancials = canViewStayFinancialData(role);
  const prisma = getPrisma();
  const [units, unitTypes] = await Promise.all([
    prisma.unit.findMany({
      where: { propertyId: session.propertyId },
      include: {
        unitType: true,
        reservations: {
          where: {
            status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN"] },
          },
          orderBy: { checkInDate: "asc" },
          take: 1,
          include: { guest: true },
        },
        housekeepingTasks: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { code: "asc" },
    }),
    prisma.unitType.findMany({
      where: { propertyId: session.propertyId },
      include: { _count: { select: { units: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  const statusCounts = statusOrder.map((status) => ({
    status,
    count: units.filter((unit) => unit.status === status).length,
  }));

  return (
    <AppShell>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-bold text-[#29f1ff]">Master Data</p>
          <h2 className="mt-2 text-3xl font-black tracking-normal text-white">Unit & Room Status</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/62">
            Pantau kesiapan seluruh unit secara real-time dan kelola tipe unit dasar untuk operasional reservasi.
          </p>
        </div>
        {canWrite ? (
          <Link
            href="/units/new"
            className="gold-gradient inline-flex min-h-11 items-center justify-center gap-2 rounded-[22px] px-4 text-sm font-black text-[#041015] shadow-[0_16px_28px_rgba(41,241,255,0.18)]"
          >
            <Plus className="size-5" />
            Tambah Unit
          </Link>
        ) : null}
      </div>

      <ActionFeedbackBanner feedback={feedback} />

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {statusCounts.map((item) => (
          <GlassCard key={item.status} className="p-4">
            <StatusBadge label={unitStatusLabels[item.status]} tone={unitStatusTone[item.status]} dot />
            <p className="mt-4 text-3xl font-black text-white">{item.count}</p>
            <p className="mt-1 text-xs font-semibold leading-5 text-white/56">{unitStatusDescriptions[item.status]}</p>
          </GlassCard>
        ))}
      </section>

      <section className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid min-w-0 gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {units.map((unit) => {
            const latestTask = unit.housekeepingTasks[0];
            const nextReservation = unit.reservations[0];
            const statusAction = updateUnitStatusAction.bind(null, unit.id);
            const canQuickToggleStatus = canWrite && unit.status !== UnitStatus.OCCUPIED;

            return (
              <GlassCard key={unit.id} variant="strong" className="overflow-hidden p-0 transition hover:-translate-y-0.5">
                <div className="relative aspect-[16/9] overflow-hidden border-b border-white/10 bg-[linear-gradient(135deg,rgba(41,241,255,0.16),transparent_42%),linear-gradient(215deg,rgba(169,137,255,0.10),transparent_46%),linear-gradient(145deg,rgba(17,26,38,0.94),rgba(5,8,14,0.82))]">
                  {unit.photoUrl ? (
                    <img src={unit.photoUrl} alt={`${unit.name} photo`} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
                  ) : null}
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,8,12,0.10),rgba(2,8,12,0.84)),linear-gradient(135deg,rgba(41,241,255,0.12),transparent_54%)]" />
                  <div className="absolute left-4 top-4">
                    <StatusBadge label={unitStatusLabels[unit.status]} tone={unitStatusTone[unit.status]} dot />
                  </div>
                  <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-4">
                    <div>
                      <p className="text-2xl font-black text-white">{unit.code}</p>
                      <p className="mt-1 text-sm font-semibold text-white/68">{unit.name}</p>
                    </div>
                    <div className="grid size-12 place-items-center rounded-[22px] border border-white/10 bg-white/10 text-[#b8fbff]">
                      <BedDouble className="size-6" />
                    </div>
                  </div>
                </div>

                <div className="space-y-4 p-4">
                  <div className="grid grid-cols-2 gap-3">
                    <InfoPill icon={<Users className="size-4" />} label="Capacity" value={`${unit.unitType.capacity} guests`} />
                    <InfoPill label={canViewFinancials ? "Rate" : "Type"} value={canViewFinancials ? formatIdr(Number(unit.unitType.baseRate)) : unit.unitType.name} />
                  </div>

                  <div className="surface-inset rounded-[22px] p-3">
                    <p className="text-xs font-bold uppercase tracking-normal text-white/42">Next activity</p>
                    <p className="mt-2 text-sm font-bold text-white">
                      {nextReservation ? `${nextReservation.guest.fullName} · ${reservationStatusLabels[nextReservation.status]}` : "Belum ada reservasi aktif"}
                    </p>
                    <p className="mt-1 text-xs font-medium text-white/54">
                      {latestTask ? `Housekeeping: ${housekeepingStatusLabels[latestTask.status]}` : "Tidak ada task housekeeping terbuka"}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/units/${unit.id}`}
                      className="surface-chip inline-flex min-h-10 flex-1 items-center justify-center rounded-[16px] px-3 text-sm font-bold text-white transition hover:border-[#29f1ff]/40"
                    >
                      View
                    </Link>
                    {canQuickToggleStatus ? (
                      <form action={statusAction} className="flex flex-1">
                        <input type="hidden" name="status" value={unit.status === UnitStatus.READY ? UnitStatus.MAINTENANCE : UnitStatus.READY} />
                        <button className="min-h-10 w-full rounded-[16px] border border-[#29f1ff]/22 bg-[#29f1ff]/10 px-3 text-sm font-bold text-[#b8fbff] transition hover:bg-[#29f1ff]/16">
                          {unit.status === UnitStatus.READY ? "Maintenance" : "Mark Ready"}
                        </button>
                      </form>
                    ) : !canWrite ? (
                      <span className="surface-chip inline-flex min-h-10 flex-1 items-center justify-center rounded-[16px] px-3 text-sm font-bold text-white/58">
                        Read-only
                      </span>
                    ) : (
                      <span className="surface-chip inline-flex min-h-10 flex-1 items-center justify-center rounded-[16px] px-3 text-sm font-bold text-white/58">
                        In-house
                      </span>
                    )}
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>

        <aside className="min-w-0 space-y-5">
          <GlassCard className="p-5">
            <h3 className="text-lg font-black text-white">Unit Types</h3>
            <p className="mt-2 text-sm leading-6 text-white/58">
              {canViewFinancials ? "Tipe unit dipakai untuk rate dasar, kapasitas, dan grouping board." : "Tipe unit dipakai untuk kapasitas dan grouping board operasional."}
            </p>
            <div className="mt-4 space-y-3">
              {unitTypes.map((type) => (
                <div key={type.id} className="surface-inset rounded-[22px] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-white">{type.name}</p>
                      <p className="mt-1 text-xs font-semibold text-white/52">{type.capacity} guests · {type._count.units} units</p>
                    </div>
                    <p className="text-sm font-black text-[#b8fbff]">{canViewFinancials ? formatIdr(Number(type.baseRate)) : `${type.capacity} pax`}</p>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>

          <GlassCard className="border-amber-300/20 bg-amber-500/8 p-5">
            <div className="flex items-start gap-3">
              <CircleAlert className="mt-0.5 size-5 shrink-0 text-[#b8fbff]" />
              <div>
                <h3 className="font-black text-white">Operational rule</h3>
                <p className="mt-2 text-sm leading-6 text-white/62">
                  Unit dengan status Maintenance atau Out of Order tidak boleh dipilih pada reservasi baru.
                </p>
              </div>
            </div>
          </GlassCard>
        </aside>
      </section>
    </AppShell>
  );
}

function InfoPill({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return (
    <div className="surface-inset rounded-[22px] p-3">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-normal text-white/42">
        {icon}
        {label}
      </p>
      <p className="mt-2 text-sm font-bold text-white">{value}</p>
    </div>
  );
}
