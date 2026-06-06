import type { ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Plus,
  Wrench,
} from "lucide-react";
import {
  Priority,
  RequestStatus,
  RequestType,
  ReservationStatus,
  UserRole,
} from "@/generated/prisma/enums";
import {
  createServiceRequestAction,
  transitionServiceRequestAction,
  updateServiceRequestAction,
} from "@/app/service-requests/actions";
import { AppShell } from "@/components/layout/app-shell";
import { ActionFeedbackBanner } from "@/components/ui/action-feedback-banner";
import { GlassCard } from "@/components/ui/glass-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDateTimeId } from "@/lib/formatters";
import {
  priorityLabels,
  priorityTone,
  requestStatusLabels,
  requestStatusTone,
  requestTypeLabels,
} from "@/lib/labels";
import { getPrisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/action-guard";
import { getActionFeedback, type ActionFeedbackSearchParams } from "@/lib/action-feedback";
import { cn } from "@/lib/utils";
import { hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const statusOrder = [
  RequestStatus.OPEN,
  RequestStatus.ASSIGNED,
  RequestStatus.IN_PROGRESS,
  RequestStatus.WAITING_GUEST,
  RequestStatus.COMPLETED,
  RequestStatus.CANCELLED,
];

const typeOrder = [
  RequestType.HOUSEKEEPING,
  RequestType.ROOM_SERVICE,
  RequestType.FNB_ORDER,
  RequestType.TRANSPORT,
  RequestType.ACTIVITY,
  RequestType.MAINTENANCE,
  RequestType.SPECIAL_REQUEST,
  RequestType.COMPLAINT,
  RequestType.OTHER,
];

const priorityOrder = [
  Priority.LOW,
  Priority.MEDIUM,
  Priority.HIGH,
  Priority.URGENT,
];

const columnTheme: Record<RequestStatus, string> = {
  OPEN: "border-[#f6b94b]/30 bg-[#f6b94b]/[0.052]",
  ASSIGNED: "border-[#4fb8ff]/30 bg-[#4fb8ff]/[0.052]",
  IN_PROGRESS: "border-[#29f1ff]/30 bg-[#29f1ff]/[0.052]",
  WAITING_GUEST: "border-[#a989ff]/30 bg-[#a989ff]/[0.052]",
  COMPLETED: "border-[#68d391]/30 bg-[#68d391]/[0.052]",
  CANCELLED: "border-white/14 bg-white/[0.035]",
};

type ServiceRequestForBoard = {
  id: string;
  code: string;
  type: RequestType;
  title: string;
  description: string | null;
  status: RequestStatus;
  priority: Priority;
  assignedTo: string | null;
  internalNotes: string | null;
  createdAt: Date;
  completedAt: Date | null;
  guest: { fullName: string; phone: string | null } | null;
  reservation: {
    bookingCode: string;
    unit: { code: string; name: string } | null;
    guest: { fullName: string; phone: string | null };
  } | null;
};

type AssigneeOption = {
  name: string;
};

type ServiceRequestsPageProps = {
  searchParams: Promise<ActionFeedbackSearchParams>;
};

export default async function ServiceRequestsPage({ searchParams }: ServiceRequestsPageProps) {
  const session = await requirePagePermission("request:read");
  const feedback = getActionFeedback(await searchParams);
  const canWrite = hasPermission(session.role as UserRole, "request:write");
  const prisma = getPrisma();
  const [requests, reservations, guests, assignees] = await Promise.all([
    prisma.serviceRequest.findMany({
      where: {
        OR: [
          { reservation: { unit: { propertyId: session.propertyId } } },
          { reservationId: null },
        ],
      },
      include: {
        guest: true,
        reservation: {
          include: {
            guest: true,
            unit: true,
          },
        },
      },
      orderBy: [{ status: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
      take: 160,
    }),
    prisma.reservation.findMany({
      where: {
        unit: { propertyId: session.propertyId },
        status: {
          in: [
            ReservationStatus.PENDING,
            ReservationStatus.CONFIRMED,
            ReservationStatus.CHECKED_IN,
          ],
        },
      },
      include: { guest: true, unit: true },
      orderBy: { checkInDate: "desc" },
      take: 80,
    }),
    prisma.guest.findMany({
      orderBy: { fullName: "asc" },
      take: 120,
    }),
    prisma.user.findMany({
      where: {
        propertyId: session.propertyId,
        isActive: true,
        role: {
          in: [UserRole.FRONT_OFFICE, UserRole.FNB_ACTIVITY, UserRole.HOUSEKEEPING, UserRole.MANAGER, UserRole.OWNER],
        },
      },
      select: { name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const openCount = requests.filter((request) => request.status !== RequestStatus.COMPLETED && request.status !== RequestStatus.CANCELLED).length;
  const urgentCount = requests.filter((request) => request.priority === Priority.URGENT || request.priority === Priority.HIGH).length;
  const completedToday = requests.filter((request) => request.completedAt && isSameDay(request.completedAt, new Date())).length;
  const waitingGuestCount = requests.filter((request) => request.status === RequestStatus.WAITING_GUEST).length;

  return (
    <AppShell>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-bold text-[#29f1ff]">Guest Operations</p>
          <h2 className="mt-2 text-3xl font-black tracking-normal text-white">Service Requests</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/62">
            Queue request tamu, assignment tim, prioritas, dan completion flow untuk front office, housekeeping, dan F&B.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge label={`${requests.length} requests`} tone="info" dot />
          <StatusBadge label={`${urgentCount} urgent/high`} tone={urgentCount > 0 ? "danger" : "muted"} dot />
        </div>
      </div>

      <ActionFeedbackBanner feedback={feedback} />

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Open Queue" value={String(openCount)} icon={<Clock3 className="size-5" />} tone="warning" />
        <MetricCard title="Urgent / High" value={String(urgentCount)} icon={<AlertTriangle className="size-5" />} tone="danger" />
        <MetricCard title="Waiting Guest" value={String(waitingGuestCount)} icon={<Wrench className="size-5" />} tone="info" />
        <MetricCard title="Completed Today" value={String(completedToday)} icon={<CheckCircle2 className="size-5" />} tone="success" />
      </section>

      <section className="mt-6 grid gap-5 2xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 overflow-x-auto premium-scroll pb-2">
          <div className="grid min-w-[1500px] gap-4 xl:grid-cols-6">
            {statusOrder.map((status) => {
              const columnRequests = requests.filter((request) => request.status === status);

              return (
                <section
                  key={status}
                  className={cn(
                    "rounded-[28px] border p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
                    columnTheme[status],
                  )}
                >
                  <div className="surface-chip flex items-center justify-between gap-3 rounded-[22px] px-3 py-3">
                    <StatusBadge label={requestStatusLabels[status]} tone={requestStatusTone[status]} dot />
                    <span className="surface-chip rounded-full px-2 py-1 text-xs font-black text-white/56">
                      {columnRequests.length}
                    </span>
                  </div>
                  <div className="mt-3 space-y-3">
                    {columnRequests.map((request) => (
                      <RequestCard key={request.id} request={request} assignees={assignees} canWrite={canWrite} />
                    ))}
                    {columnRequests.length === 0 ? (
                      <div className="grid min-h-[120px] place-items-center rounded-[22px] border border-dashed border-white/10 bg-white/[0.025] text-xs font-bold text-white/30">
                        Empty
                      </div>
                    ) : null}
                  </div>
                </section>
              );
            })}
          </div>
        </div>

        <aside className="min-w-0 space-y-5">
          {canWrite ? (
            <GlassCard className="p-5">
              <div className="flex items-center gap-3">
                <div className="grid size-11 place-items-center rounded-[22px] bg-[#29f1ff]/14 text-[#b8fbff]">
                  <Plus className="size-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">New Request</h3>
                  <p className="mt-1 text-xs font-semibold text-white/50">Create guest or operational request</p>
                </div>
              </div>

              <form action={createServiceRequestAction} className="mt-5 space-y-3">
                <SelectField name="reservationId" label="Reservation">
                  <option value="">No reservation link</option>
                  {reservations.map((reservation) => (
                    <option key={reservation.id} value={reservation.id}>
                      {reservation.bookingCode} - {reservation.guest.fullName} - {reservation.unit?.code ?? "No unit"}
                    </option>
                  ))}
                </SelectField>
                <SelectField name="guestId" label="Guest">
                  <option value="">Use reservation guest</option>
                  {guests.map((guest) => (
                    <option key={guest.id} value={guest.id}>
                      {guest.fullName}
                    </option>
                  ))}
                </SelectField>
                <SelectField name="type" label="Type" defaultValue={RequestType.ROOM_SERVICE}>
                  {typeOrder.map((type) => (
                    <option key={type} value={type}>
                      {requestTypeLabels[type]}
                    </option>
                  ))}
                </SelectField>
                <TextField name="title" label="Title" placeholder="Extra towels, dinner setup, airport pickup" required />
                <SelectField name="priority" label="Priority" defaultValue={Priority.MEDIUM}>
                  {priorityOrder.map((priority) => (
                    <option key={priority} value={priority}>
                      {priorityLabels[priority]}
                    </option>
                  ))}
                </SelectField>
                <SelectField name="status" label="Status" defaultValue={RequestStatus.OPEN}>
                  {statusOrder.map((status) => (
                    <option key={status} value={status}>
                      {requestStatusLabels[status]}
                    </option>
                  ))}
                </SelectField>
                <SelectField name="assignedTo" label="Assigned To">
                  <option value="">Unassigned</option>
                  {assignees.map((user) => (
                    <option key={user.name} value={user.name}>
                      {user.name}
                    </option>
                  ))}
                </SelectField>
                <TextareaField name="description" label="Description" placeholder="Guest-facing details" />
                <TextareaField name="internalNotes" label="Internal Notes" placeholder="Team notes" />
                <button className="gold-gradient min-h-11 w-full rounded-[22px] text-sm font-black text-[#041015]">
                  Create Request
                </button>
              </form>
            </GlassCard>
          ) : null}
        </aside>
      </section>
    </AppShell>
  );
}

function RequestCard({
  request,
  assignees,
  canWrite,
}: {
  request: ServiceRequestForBoard;
  assignees: AssigneeOption[];
  canWrite: boolean;
}) {
  const updateAction = updateServiceRequestAction.bind(null, request.id);
  const guest = request.reservation?.guest ?? request.guest;
  const unit = request.reservation?.unit;

  return (
    <article className="surface-inset-strong rounded-[22px] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs font-black text-[#b8fbff]">{request.code}</p>
          <p className="mt-2 text-sm font-black leading-5 text-white">{request.title}</p>
        </div>
        <StatusBadge label={priorityLabels[request.priority]} tone={priorityTone[request.priority]} />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <StatusBadge label={requestTypeLabels[request.type]} tone="muted" />
        <StatusBadge label={requestStatusLabels[request.status]} tone={requestStatusTone[request.status]} />
      </div>

      <div className="surface-inset mt-4 rounded-[22px] p-3">
        <p className="truncate text-sm font-black text-white">{guest?.fullName ?? "Tanpa guest"}</p>
        <p className="mt-1 text-xs font-semibold text-white/48">
          {request.reservation?.bookingCode ?? "Standalone"} · {unit ? `${unit.code} ${unit.name}` : "No unit"}
        </p>
        <p className="mt-2 text-xs font-semibold text-white/42">Created {formatDateTimeId(request.createdAt)}</p>
      </div>

      {request.description ? <p className="mt-3 text-xs leading-5 text-white/54">{request.description}</p> : null}
      {request.internalNotes ? <p className="mt-2 text-xs leading-5 text-[#b8fbff]/72">{request.internalNotes}</p> : null}

      {canWrite ? (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            {nextTransitions(request.status).map((transition) => {
              const transitionAction = transitionServiceRequestAction.bind(null, request.id);

              return (
                <form key={transition.status} action={transitionAction}>
                  <input type="hidden" name="status" value={transition.status} />
                  <button className={transition.className}>{transition.label}</button>
                </form>
              );
            })}
          </div>

          <form action={updateAction} className="mt-4 space-y-2 border-t border-white/10 pt-4">
            <SelectField name="status" label="Status" defaultValue={request.status}>
              {statusOrder.map((status) => (
                <option key={status} value={status}>
                  {requestStatusLabels[status]}
                </option>
              ))}
            </SelectField>
            <SelectField name="priority" label="Priority" defaultValue={request.priority}>
              {priorityOrder.map((priority) => (
                <option key={priority} value={priority}>
                  {priorityLabels[priority]}
                </option>
              ))}
            </SelectField>
            <SelectField name="assignedTo" label="Assigned To" defaultValue={request.assignedTo ?? ""}>
              <option value="">Unassigned</option>
              {assignees.map((user) => (
                <option key={user.name} value={user.name}>
                  {user.name}
                </option>
              ))}
            </SelectField>
            <TextareaField name="internalNotes" label="Internal Notes" defaultValue={request.internalNotes ?? ""} />
            <button className="surface-chip min-h-10 w-full rounded-[16px] text-xs font-black text-white/76 transition hover:border-[#29f1ff]/30 hover:text-white">
              Update
            </button>
          </form>
        </>
      ) : null}
    </article>
  );
}

function nextTransitions(status: RequestStatus) {
  const baseButton = "rounded-[16px] border px-3 py-2 text-xs font-black transition";

  if (status === RequestStatus.OPEN) {
    return [
      { label: "Assign", status: RequestStatus.ASSIGNED, className: `${baseButton} border-sky-300/20 bg-sky-500/10 text-sky-100` },
      { label: "Start", status: RequestStatus.IN_PROGRESS, className: `${baseButton} border-[#29f1ff]/24 bg-[#29f1ff]/10 text-[#b8fbff]` },
    ];
  }

  if (status === RequestStatus.ASSIGNED) {
    return [
      { label: "Start", status: RequestStatus.IN_PROGRESS, className: `${baseButton} border-[#29f1ff]/24 bg-[#29f1ff]/10 text-[#b8fbff]` },
      { label: "Waiting", status: RequestStatus.WAITING_GUEST, className: `${baseButton} border-amber-300/20 bg-amber-500/10 text-amber-100` },
    ];
  }

  if (status === RequestStatus.IN_PROGRESS || status === RequestStatus.WAITING_GUEST) {
    return [
      { label: "Complete", status: RequestStatus.COMPLETED, className: `${baseButton} border-emerald-300/20 bg-emerald-500/10 text-emerald-100` },
      { label: "Cancel", status: RequestStatus.CANCELLED, className: `${baseButton} border-red-300/20 bg-red-500/10 text-red-100` },
    ];
  }

  return [];
}

function MetricCard({
  title,
  value,
  icon,
  tone,
}: {
  title: string;
  value: string;
  icon: ReactNode;
  tone: "warning" | "info" | "danger" | "success";
}) {
  const toneClass = {
    warning: "bg-amber-400/12 text-amber-100",
    info: "bg-sky-400/12 text-sky-100",
    danger: "bg-red-400/12 text-red-100",
    success: "bg-emerald-400/12 text-emerald-100",
  };

  return (
    <GlassCard variant="compact" className="p-5">
      <div className={`grid size-11 place-items-center rounded-[22px] ${toneClass[tone]}`}>{icon}</div>
      <p className="mt-4 text-sm font-bold text-white/58">{title}</p>
      <p className="mt-2 text-3xl font-black text-white">{value}</p>
    </GlassCard>
  );
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
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
        className="surface-field min-h-11 w-full rounded-[22px] px-4 text-sm font-bold text-white outline-none placeholder:text-white/34"
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
        className="surface-field min-h-11 w-full rounded-[22px] px-4 text-sm font-bold text-white outline-none"
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
        rows={3}
        className="surface-field w-full rounded-[22px] px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-white/34"
      />
    </label>
  );
}
