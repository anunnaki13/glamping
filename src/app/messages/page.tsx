import type { ReactNode } from "react";
import {
  Clock,
  MessageCircle,
  MessageSquareText,
  PhoneOff,
  Plus,
  Send,
  Sparkles,
} from "lucide-react";
import {
  MessageTemplateCategory,
  ReservationStatus,
  UserRole,
} from "@/generated/prisma/enums";
import {
  createMessageTemplateAction,
  openWhatsappMessageAction,
  updateMessageTemplateAction,
} from "@/app/messages/actions";
import { AppShell } from "@/components/layout/app-shell";
import { CopyMessageButton } from "@/components/messages/copy-message-button";
import { ActionFeedbackBanner } from "@/components/ui/action-feedback-banner";
import { GlassCard } from "@/components/ui/glass-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { getActionFeedback, type ActionFeedbackSearchParams } from "@/lib/action-feedback";
import { requirePagePermission } from "@/lib/action-guard";
import { formatDateId, formatDateTimeId, formatIdr } from "@/lib/formatters";
import { maskContact, paymentStatusLabels, reservationStatusLabels, reservationStatusTone } from "@/lib/labels";
import {
  messageTemplateCategoryLabels,
  messageVariableLabels,
  renderMessageTemplate,
} from "@/lib/message-templates";
import { getPrisma } from "@/lib/prisma";
import {
  canInitiateGuestMessages,
  canViewGuestContactData,
  canViewStayFinancialData,
} from "@/lib/permissions";

export const dynamic = "force-dynamic";

const activeReservationStatuses = [
  ReservationStatus.PENDING,
  ReservationStatus.CONFIRMED,
  ReservationStatus.CHECKED_IN,
];

const categoryOrder = [
  MessageTemplateCategory.BOOKING_CONFIRMATION,
  MessageTemplateCategory.PAYMENT_REMINDER,
  MessageTemplateCategory.CHECK_IN_REMINDER,
  MessageTemplateCategory.WELCOME_MESSAGE,
  MessageTemplateCategory.CHECKOUT_THANK_YOU,
  MessageTemplateCategory.REVIEW_REQUEST,
  MessageTemplateCategory.CUSTOM,
];

type MessageReservation = {
  bookingCode: string;
  checkInDate: Date;
  checkOutDate: Date;
  paymentStatus: string;
  totalAmount: unknown;
  guest: {
    fullName: string;
    phone: string | null;
  };
  unit: {
    code: string;
    name: string;
  } | null;
};

type MessageProperty = {
  name: string;
  phone: string | null;
};

type MessagesPageProps = {
  searchParams: Promise<ActionFeedbackSearchParams>;
};

export default async function MessagesPage({ searchParams }: MessagesPageProps) {
  const session = await requirePagePermission("message:read");
  const feedback = getActionFeedback(await searchParams);
  const role = session.role as UserRole;
  const canWrite = canInitiateGuestMessages(role);
  const canViewGuestContact = canViewGuestContactData(role);
  const canViewStayFinancials = canViewStayFinancialData(role);
  const prisma = getPrisma();
  const [property, templates, reservations, recentLogs] = await Promise.all([
    prisma.property.findUniqueOrThrow({ where: { id: session.propertyId } }),
    prisma.messageTemplate.findMany({
      where: { propertyId: session.propertyId },
      orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.reservation.findMany({
      where: {
        unit: { propertyId: session.propertyId },
        status: { in: activeReservationStatuses },
      },
      include: {
        guest: true,
        unit: true,
      },
      orderBy: [{ status: "asc" }, { checkInDate: "asc" }],
      take: 12,
    }),
    prisma.communicationLog.findMany({
      where: { propertyId: session.propertyId },
      include: {
        guest: true,
        reservation: true,
        template: true,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const visibleTemplates = canViewStayFinancials
    ? templates
    : templates.filter((template) => template.category !== MessageTemplateCategory.PAYMENT_REMINDER);
  const activeTemplates = visibleTemplates.filter((template) => template.isActive);
  const visibleVariables = canViewStayFinancials
    ? messageVariableLabels
    : messageVariableLabels.filter((variable) => variable !== "payment_status" && variable !== "total_amount");
  const visibleCategoryOrder = canViewStayFinancials
    ? categoryOrder
    : categoryOrder.filter((category) => category !== MessageTemplateCategory.PAYMENT_REMINDER);
  const contactableReservations = reservations.filter((reservation) => reservation.guest.phone).length;
  const missingPhones = reservations.length - contactableReservations;
  const preparedToday = recentLogs.filter((log) => isToday(log.createdAt)).length;

  return (
    <AppShell>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-bold text-[#29f1ff]">Guest Communication</p>
          <h2 className="mt-2 text-3xl font-black tracking-normal text-white">Messages</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/62">
            Siapkan template dan quick link WhatsApp untuk reservasi aktif tanpa pengiriman otomatis.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge label={`${activeTemplates.length} active templates`} tone="info" dot />
          <StatusBadge label={canWrite ? `${contactableReservations} contactable bookings` : `${recentLogs.length} recent logs`} tone="success" dot />
        </div>
      </div>

      <ActionFeedbackBanner feedback={feedback} />

      <section className="mt-6 grid gap-4 md:grid-cols-4">
        <MetricCard title="Templates" value={String(visibleTemplates.length)} icon={<MessageSquareText className="size-5" />} />
        <MetricCard title="Active Bookings" value={String(reservations.length)} icon={<Clock className="size-5" />} />
        <MetricCard title="Prepared Today" value={String(preparedToday)} icon={<Send className="size-5" />} />
        <MetricCard title={canWrite ? "Missing Phone" : "Read Scope"} value={canWrite ? String(missingPhones) : "Limited"} icon={<PhoneOff className="size-5" />} />
      </section>

      <section className="mt-6 grid gap-5 2xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0 space-y-5">
          {canWrite ? (
          <GlassCard className="p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-white">WhatsApp Quick Links</h3>
                <p className="mt-1 text-sm font-semibold text-white/50">
                  Pilih template, cek preview, lalu buka WhatsApp dengan pesan yang sudah terisi.
                </p>
              </div>
              <MessageCircle className="size-6 text-[#29f1ff]" />
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-2">
              {reservations.map((reservation) => {
                const previewTemplate = activeTemplates[0];
                const preview = previewTemplate
                  ? renderMessageTemplate(previewTemplate.body, buildMessageContext(reservation, property))
                  : "";

                return (
                  <div key={reservation.bookingCode} className="rounded-[22px] surface-inset p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-sm font-black text-[#b8fbff]">{reservation.bookingCode}</p>
                        <p className="mt-2 text-lg font-black text-white">{reservation.guest.fullName}</p>
                        <p className="mt-1 text-xs font-semibold text-white/48">
                          {reservation.unit?.code ?? "Unassigned"} · {formatDateId(reservation.checkInDate)}
                        </p>
                      </div>
                      <StatusBadge
                        label={reservationStatusLabels[reservation.status]}
                        tone={reservationStatusTone[reservation.status]}
                      />
                    </div>

                    <div className="mt-4 rounded-[22px] surface-inset p-3">
                      <p className="text-xs font-black uppercase tracking-normal text-white/38">Preview</p>
                      <p className="mt-2 min-h-[96px] text-sm font-semibold leading-6 text-white/68">
                        {preview || "Belum ada template aktif. Aktifkan atau buat template terlebih dahulu."}
                      </p>
                    </div>

                    <form action={openWhatsappMessageAction} className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto]">
                      <input type="hidden" name="reservationId" value={reservation.id} />
                      <select
                        name="templateId"
                        defaultValue={activeTemplates[0]?.id ?? ""}
                        disabled={activeTemplates.length === 0}
                        className="min-h-10 rounded-[16px] surface-field px-3 text-xs font-bold text-white outline-none disabled:opacity-45"
                      >
                        {activeTemplates.map((template) => (
                          <option key={template.id} value={template.id}>
                            {template.name}
                          </option>
                        ))}
                      </select>
                      <CopyMessageButton text={preview} />
                      <button
                        disabled={!reservation.guest.phone || activeTemplates.length === 0}
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[16px] border border-[#29f1ff]/24 bg-[#29f1ff]/10 px-3 text-xs font-black text-[#b8fbff] disabled:pointer-events-none disabled:opacity-45"
                      >
                        <Send className="size-4" />
                        Open
                      </button>
                    </form>

                    <p className="mt-3 text-xs font-semibold text-white/42">
                      WhatsApp: {canViewGuestContact ? reservation.guest.phone ?? "Nomor belum tersedia" : maskContact(reservation.guest.phone)}
                    </p>
                  </div>
                );
              })}
            </div>

            {reservations.length === 0 ? (
              <div className="mt-5 rounded-[22px] surface-inset p-8 text-center text-sm font-semibold text-white/58">
                Tidak ada reservasi aktif atau upcoming untuk dikirim pesan.
              </div>
            ) : null}
          </GlassCard>
          ) : (
            <GlassCard className="p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-black text-white">WhatsApp Quick Links</h3>
                  <p className="mt-1 text-sm font-semibold text-white/50">
                    Role ini dapat membaca template, tetapi tidak membuka pesan tamu atau melihat kontak penuh.
                  </p>
                </div>
                <MessageCircle className="size-6 text-[#29f1ff]" />
              </div>
            </GlassCard>
          )}

          <GlassCard className="p-5">
            <div className="flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-[22px] bg-[#29f1ff]/14 text-[#b8fbff]">
                <Sparkles className="size-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">Message Templates</h3>
                <p className="mt-1 text-xs font-semibold text-white/50">Template bisa memakai variable reference di panel kanan.</p>
              </div>
            </div>

            {canWrite ? (
              <form action={createMessageTemplateAction} className="mt-5 grid gap-4 xl:grid-cols-[1fr_220px_auto]">
                <TextField name="name" label="Template Name" placeholder="Late checkout offer" required />
                <SelectField name="category" label="Category" defaultValue={MessageTemplateCategory.CUSTOM}>
                  {visibleCategoryOrder.map((category) => (
                    <option key={category} value={category}>
                      {messageTemplateCategoryLabels[category]}
                    </option>
                  ))}
                </SelectField>
                <label className="flex items-end gap-2 pb-3 text-sm font-bold text-white/64">
                  <input type="checkbox" name="isActive" defaultChecked className="size-4 accent-[#29f1ff]" />
                  Active
                </label>
                <TextareaField
                  name="body"
                  label="Message Body"
                  placeholder="Halo {{guest_name}}, ..."
                  className="xl:col-span-3"
                  required
                />
                <div className="xl:col-span-3">
                  <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[22px] border border-[#29f1ff]/24 bg-[#29f1ff]/10 px-5 text-sm font-black text-[#b8fbff]">
                    <Plus className="size-4" />
                    Create Template
                  </button>
                </div>
              </form>
            ) : null}

            <div className="mt-5 grid gap-4">
              {visibleTemplates.map((template) => {
                const updateAction = updateMessageTemplateAction.bind(null, template.id);

                return (
                  <form key={template.id} action={updateAction} className="rounded-[22px] surface-inset p-4">
                    <div className="grid gap-4 xl:grid-cols-[1fr_220px_auto]">
                      <TextField name="name" label="Template Name" defaultValue={template.name} disabled={!canWrite} required />
                      <SelectField name="category" label="Category" defaultValue={template.category} disabled={!canWrite}>
                        {visibleCategoryOrder.map((category) => (
                          <option key={category} value={category}>
                            {messageTemplateCategoryLabels[category]}
                          </option>
                        ))}
                      </SelectField>
                      <label className="flex items-end gap-2 pb-3 text-sm font-bold text-white/64">
                        <input
                          type="checkbox"
                          name="isActive"
                          defaultChecked={template.isActive}
                          disabled={!canWrite}
                          className="size-4 accent-[#29f1ff]"
                        />
                        Active
                      </label>
                      <TextareaField
                        name="body"
                        label="Message Body"
                        defaultValue={template.body}
                        disabled={!canWrite}
                        className="xl:col-span-3"
                        required
                      />
                    </div>
                    {canWrite ? (
                      <button className="mt-4 min-h-10 rounded-[16px] surface-chip px-4 text-xs font-black text-white/76">
                        Save Template
                      </button>
                    ) : null}
                  </form>
                );
              })}
            </div>
          </GlassCard>
        </div>

        <aside className="min-w-0 space-y-5">
          <GlassCard className="p-5">
            <h3 className="text-lg font-black text-white">Variables</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-white/52">
              Pakai variable ini di body template. Nilainya akan diganti otomatis dari reservasi dan property.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {visibleVariables.map((variable) => (
                <span key={variable} className="rounded-full surface-chip px-3 py-1.5 font-mono text-[11px] font-black text-[#b8fbff]">
                  {"{{"}{variable}{"}}"}
                </span>
              ))}
            </div>
          </GlassCard>

          <GlassCard className="p-5">
            <h3 className="text-lg font-black text-white">Recent Communication</h3>
            <div className="mt-4 space-y-3">
              {recentLogs.map((log) => {
                const canShowTemplateName = canViewStayFinancials || log.template?.category !== MessageTemplateCategory.PAYMENT_REMINDER;

                return (
                  <div key={log.id} className="rounded-[22px] surface-inset p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-black text-white">{log.guest?.fullName ?? (canViewGuestContact ? log.recipient : maskContact(log.recipient))}</p>
                      <StatusBadge label={log.status.replaceAll("_", " ")} tone="info" />
                    </div>
                    <p className="mt-1 text-xs font-semibold text-white/50">
                      {(canShowTemplateName ? log.template?.name : "Restricted template") ?? "Manual message"} · {log.reservation?.bookingCode ?? "No booking"}
                    </p>
                    <p className="mt-2 line-clamp-2 text-xs font-semibold leading-5 text-white/42">
                      {canWrite ? log.message : "Message content restricted for this role."}
                    </p>
                    <p className="mt-2 text-[11px] font-semibold text-white/35">{formatDateTimeId(log.createdAt)}</p>
                  </div>
                );
              })}
              {recentLogs.length === 0 ? (
                <div className="rounded-[22px] surface-inset p-5 text-sm font-semibold text-white/54">
                  Belum ada log komunikasi.
                </div>
              ) : null}
            </div>
          </GlassCard>
        </aside>
      </section>
    </AppShell>
  );
}

function buildMessageContext(reservation: MessageReservation, property: MessageProperty) {
  return {
    guest_name: reservation.guest.fullName,
    booking_code: reservation.bookingCode,
    property_name: property.name,
    property_phone: property.phone ?? "-",
    unit_name: reservation.unit?.name ?? reservation.unit?.code ?? "Unassigned",
    check_in: formatDateId(reservation.checkInDate),
    check_out: formatDateId(reservation.checkOutDate),
    payment_status: paymentStatusLabels[reservation.paymentStatus as keyof typeof paymentStatusLabels] ?? reservation.paymentStatus,
    total_amount: formatIdr(Number(reservation.totalAmount)),
  };
}

function isToday(value: Date) {
  const now = new Date();
  return value.getFullYear() === now.getFullYear() && value.getMonth() === now.getMonth() && value.getDate() === now.getDate();
}

function MetricCard({ title, value, icon }: { title: string; value: string; icon: ReactNode }) {
  return (
    <GlassCard className="p-5">
      <div className="grid size-11 place-items-center rounded-[22px] bg-[#29f1ff]/14 text-[#b8fbff]">{icon}</div>
      <p className="mt-4 text-sm font-bold text-white/58">{title}</p>
      <p className="mt-2 text-3xl font-black text-white">{value}</p>
    </GlassCard>
  );
}

function TextField({
  label,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className={className}>
      <span className="mb-2 block text-xs font-black uppercase tracking-normal text-white/42">{label}</span>
      <input
        {...props}
        className="min-h-11 w-full rounded-[22px] surface-field px-4 text-sm font-bold text-white outline-none placeholder:text-white/34 disabled:opacity-50"
      />
    </label>
  );
}

function SelectField({
  label,
  children,
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; children: ReactNode }) {
  return (
    <label className={className}>
      <span className="mb-2 block text-xs font-black uppercase tracking-normal text-white/42">{label}</span>
      <select
        {...props}
        className="min-h-11 w-full rounded-[22px] surface-field px-4 text-sm font-bold text-white outline-none disabled:opacity-50"
      >
        {children}
      </select>
    </label>
  );
}

function TextareaField({
  label,
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return (
    <label className={className}>
      <span className="mb-2 block text-xs font-black uppercase tracking-normal text-white/42">{label}</span>
      <textarea
        {...props}
        rows={4}
        className="w-full rounded-[22px] surface-field px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-white/34 disabled:opacity-50"
      />
    </label>
  );
}
