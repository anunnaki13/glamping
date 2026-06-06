import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, MessageCircle, Save, UserRound } from "lucide-react";
import { UserRole } from "@/generated/prisma/enums";
import { AppShell } from "@/components/layout/app-shell";
import { ActionFeedbackBanner } from "@/components/ui/action-feedback-banner";
import { GlassCard } from "@/components/ui/glass-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { updateGuestAction } from "@/app/guests/actions";
import { requirePagePermission } from "@/lib/action-guard";
import { getActionFeedback, type ActionFeedbackSearchParams } from "@/lib/action-feedback";
import { formatDateId, formatIdr } from "@/lib/formatters";
import {
  humanizeGuestType,
  maskContact,
  maskSensitive,
  priorityLabels,
  priorityTone,
  requestStatusLabels,
  requestStatusTone,
  requestTypeLabels,
  reservationStatusLabels,
  reservationStatusTone,
} from "@/lib/labels";
import {
  canViewGuestContactData,
  canViewStayFinancialData,
  hasPermission,
} from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type GuestDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<ActionFeedbackSearchParams>;
};

export default async function GuestDetailPage({ params, searchParams }: GuestDetailPageProps) {
  const { id } = await params;
  const session = await requirePagePermission("guest:read");
  const feedback = getActionFeedback(await searchParams);
  const role = session.role as UserRole;
  const canAccessSensitive = hasPermission(role, "guest:sensitive");
  const canViewGuestContact = canViewGuestContactData(role);
  const canViewFinancials = canViewStayFinancialData(role);
  const guest = await getPrisma().guest.findUnique({
    where: { id },
    include: {
      reservations: {
        orderBy: { checkInDate: "desc" },
        include: { unit: true, orders: true, serviceRequests: true },
      },
      orders: {
        orderBy: { createdAt: "desc" },
        include: { items: true },
      },
      serviceRequests: {
        orderBy: { createdAt: "desc" },
        take: 8,
      },
    },
  });

  if (!guest) {
    notFound();
  }

  const updateAction = updateGuestAction.bind(null, guest.id);
  const roomSpend = guest.reservations.reduce((sum, reservation) => sum + Number(reservation.totalAmount), 0);
  const orderSpend = guest.orders.reduce((sum, order) => sum + Number(order.total), 0);
  const lifetimeSpend = roomSpend + orderSpend;
  const lastStay = guest.reservations[0];

  return (
    <AppShell>
      <Link href="/guests" className="inline-flex items-center gap-2 text-sm font-bold text-[#b8fbff]">
        <ArrowLeft className="size-4" />
        Kembali ke Guest CRM
      </Link>

      <ActionFeedbackBanner feedback={feedback} />

      <section className="mt-5 grid gap-5 xl:grid-cols-[0.82fr_1.18fr]">
        <GlassCard variant="strong" className="p-6">
          <div className="flex items-start gap-5">
            <div className="grid size-20 place-items-center rounded-[28px] border border-[#29f1ff]/26 bg-[#29f1ff]/12 text-[#b8fbff]">
              <UserRound className="size-10" />
            </div>
            <div className="min-w-0">
              <StatusBadge label={humanizeGuestType(guest.guestType)} tone={guest.guestType === "VIP" ? "warning" : "info"} />
              <h2 className="mt-4 text-4xl font-black tracking-normal text-white">{guest.fullName}</h2>
              <p className="mt-2 text-sm font-semibold text-white/56">{guest.country ?? "Country unknown"} · Guest ID {guest.id.slice(-8).toUpperCase()}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <ContactBlock icon={<MessageCircle className="size-4" />} label="WhatsApp" value={canViewGuestContact ? guest.phone ?? "-" : maskContact(guest.phone)} />
            <ContactBlock icon={<Mail className="size-4" />} label="Email" value={canViewGuestContact ? guest.email ?? "-" : maskContact(guest.email)} />
            <ContactBlock label="Visits" value={`${guest.reservations.length} stays`} />
            <ContactBlock label={canViewFinancials ? "Lifetime spend" : "Service requests"} value={canViewFinancials ? formatIdr(lifetimeSpend) : String(guest.serviceRequests.length)} />
            <ContactBlock label="ID number" value={canAccessSensitive ? guest.idNumber ?? "-" : maskSensitive(guest.idNumber)} />
            <ContactBlock label="Last stay" value={lastStay ? `${lastStay.unit?.code ?? "-"} · ${formatDateId(lastStay.checkInDate)}` : "-"} />
          </div>

          <div className="mt-5 rounded-[22px] surface-inset p-4">
            <p className="text-xs font-bold uppercase tracking-normal text-white/42">Preferences</p>
            <p className="mt-2 text-sm leading-6 text-white/72">{guest.preferences ?? "Belum ada preference tersimpan."}</p>
          </div>
        </GlassCard>

        {canAccessSensitive ? (
          <GlassCard className="p-5">
            <h3 className="text-xl font-black text-white">Edit Guest Profile</h3>
            <p className="mt-2 text-sm leading-6 text-white/58">Sensitive ID hanya ditampilkan penuh di detail page untuk role yang berwenang.</p>
            <form action={updateAction} className="mt-5 grid gap-4 sm:grid-cols-2">
              <TextField label="Nama lengkap" name="fullName" defaultValue={guest.fullName} required />
              <TextField label="Guest type" name="guestType" defaultValue={guest.guestType} required />
              <TextField label="Phone / WhatsApp" name="phone" defaultValue={guest.phone ?? ""} />
              <TextField label="Email" name="email" type="email" defaultValue={guest.email ?? ""} />
              <TextField label="Country" name="country" defaultValue={guest.country ?? ""} />
              <TextField label="City" name="city" defaultValue={guest.city ?? ""} />
              <TextField label="ID type" name="idType" defaultValue={guest.idType ?? ""} />
              <TextField label="ID number" name="idNumber" defaultValue={guest.idNumber ?? ""} />
              <TextArea label="Preferences" name="preferences" defaultValue={guest.preferences ?? ""} />
              <TextArea label="Internal notes" name="notes" defaultValue={guest.notes ?? ""} />
              <div className="sm:col-span-2">
                <button className="gold-gradient inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[22px] px-4 text-sm font-black text-[#041015]">
                  <Save className="size-5" />
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </GlassCard>
        ) : (
          <GlassCard className="p-5">
            <h3 className="text-xl font-black text-white">Guest Snapshot</h3>
            <p className="mt-2 text-sm leading-6 text-white/58">Role ini memiliki akses baca CRM. Data identitas sensitif tetap dimasking.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <ContactBlock label="Guest type" value={humanizeGuestType(guest.guestType)} />
              <ContactBlock label="Country" value={guest.country ?? "-"} />
              <ContactBlock label="City" value={guest.city ?? "-"} />
              <ContactBlock label="ID type" value={guest.idType ?? "-"} />
            </div>
          </GlassCard>
        )}
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-3">
        <GlassCard className="p-5 xl:col-span-2">
          <h3 className="text-lg font-black text-white">Stay History</h3>
          <div className="mt-4 space-y-3">
            {guest.reservations.map((reservation) => (
              <div key={reservation.id} className="rounded-[22px] surface-inset p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-white">{reservation.bookingCode}</p>
                    <p className="mt-1 text-sm font-semibold text-white/58">
                      {reservation.unit?.name ?? "Unassigned unit"} · {formatDateId(reservation.checkInDate)} - {formatDateId(reservation.checkOutDate)}
                    </p>
                  </div>
                  <div className="text-right">
                    <StatusBadge label={reservationStatusLabels[reservation.status]} tone={reservationStatusTone[reservation.status]} />
                    {canViewFinancials ? <p className="mt-2 text-sm font-black text-[#b8fbff]">{formatIdr(Number(reservation.totalAmount))}</p> : null}
                  </div>
                </div>
              </div>
            ))}
            {guest.reservations.length === 0 ? <EmptyLine label="Belum ada stay history untuk guest ini." /> : null}
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <h3 className="text-lg font-black text-white">Recent Requests</h3>
          <div className="mt-4 space-y-3">
            {guest.serviceRequests.map((request) => (
              <div key={request.id} className="rounded-[22px] surface-inset p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-white">{request.title}</p>
                    <p className="mt-1 text-xs font-semibold text-white/52">
                      {requestTypeLabels[request.type]} · {formatDateId(request.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <StatusBadge label={requestStatusLabels[request.status]} tone={requestStatusTone[request.status]} />
                    <StatusBadge label={priorityLabels[request.priority]} tone={priorityTone[request.priority]} />
                  </div>
                </div>
              </div>
            ))}
            {guest.serviceRequests.length === 0 ? <EmptyLine label="Belum ada request untuk guest ini." /> : null}
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

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; name: string }) {
  const { label, ...textareaProps } = props;
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-normal text-white/52">{label}</span>
      <textarea className={`${fieldClass()} min-h-28 py-3`} {...textareaProps} />
    </label>
  );
}

function ContactBlock({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-[22px] surface-inset p-4">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-normal text-white/42">
        {icon}
        {label}
      </p>
      <p className="mt-2 truncate font-bold text-white">{value}</p>
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
