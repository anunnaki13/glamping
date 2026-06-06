import type { ReactNode } from "react";
import {
  AlertTriangle,
  ClipboardCheck,
  Clock3,
  Plus,
  Sparkles,
} from "lucide-react";
import {
  HousekeepingStatus,
  Priority,
  ReservationStatus,
  UnitStatus,
  UserRole,
} from "@/generated/prisma/enums";
import {
  createHousekeepingTaskAction,
  transitionHousekeepingTaskAction,
  updateHousekeepingTaskAction,
} from "@/app/housekeeping/actions";
import { AppShell } from "@/components/layout/app-shell";
import { ActionFeedbackBanner } from "@/components/ui/action-feedback-banner";
import { GlassCard } from "@/components/ui/glass-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDateId, formatDateTimeId } from "@/lib/formatters";
import {
  housekeepingStatusLabels,
  housekeepingStatusTone,
  priorityLabels,
  priorityTone,
  unitStatusLabels,
  unitStatusTone,
} from "@/lib/labels";
import { getPrisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/action-guard";
import { getActionFeedback, type ActionFeedbackSearchParams } from "@/lib/action-feedback";
import { hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const statusOrder = [
  HousekeepingStatus.DIRTY,
  HousekeepingStatus.ASSIGNED,
  HousekeepingStatus.IN_PROGRESS,
  HousekeepingStatus.INSPECTION,
  HousekeepingStatus.READY,
  HousekeepingStatus.BLOCKED,
];

const priorityOrder = [
  Priority.LOW,
  Priority.MEDIUM,
  Priority.HIGH,
  Priority.URGENT,
];

const columnTheme: Record<HousekeepingStatus, string> = {
  DIRTY: "border-[#ff6b5f]/30 bg-[#ff6b5f]/[0.055]",
  ASSIGNED: "border-[#f6b94b]/30 bg-[#f6b94b]/[0.055]",
  IN_PROGRESS: "border-[#4fb8ff]/30 bg-[#4fb8ff]/[0.055]",
  INSPECTION: "border-[#a989ff]/30 bg-[#a989ff]/[0.055]",
  READY: "border-[#68d391]/30 bg-[#68d391]/[0.055]",
  BLOCKED: "border-white/14 bg-white/[0.04]",
};

type HousekeepingTaskForBoard = {
  id: string;
  taskType: string;
  status: HousekeepingStatus;
  priority: Priority;
  assignedTo: string | null;
  dueAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  notes: string | null;
  unit: {
    code: string;
    name: string;
    status: UnitStatus;
    unitType: {
      name: string;
      baseRate: unknown;
    };
    reservations: Array<{
      status: ReservationStatus;
      checkInDate: Date;
      checkOutDate: Date;
      guest: {
        fullName: string;
      };
    }>;
  };
};

type AssigneeOption = {
  name: string;
};

type HousekeepingPageProps = {
  searchParams: Promise<ActionFeedbackSearchParams>;
};

export default async function HousekeepingPage({ searchParams }: HousekeepingPageProps) {
  const session = await requirePagePermission("housekeeping:read");
  const feedback = getActionFeedback(await searchParams);
  const canWrite = hasPermission(session.role as UserRole, "housekeeping:write");
  const prisma = getPrisma();
  const [tasks, units, assignees] = await Promise.all([
    prisma.housekeepingTask.findMany({
      where: { unit: { propertyId: session.propertyId } },
      include: {
        unit: {
          include: {
            unitType: true,
            reservations: {
              where: {
                status: {
                  in: [ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN],
                },
              },
              include: { guest: true },
              orderBy: { checkOutDate: "asc" },
              take: 1,
            },
          },
        },
      },
      orderBy: [{ status: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
      take: 160,
    }),
    prisma.unit.findMany({
      where: { propertyId: session.propertyId },
      include: { unitType: true },
      orderBy: { code: "asc" },
    }),
    prisma.user.findMany({
      where: {
        propertyId: session.propertyId,
        isActive: true,
        role: { in: [UserRole.HOUSEKEEPING, UserRole.MANAGER, UserRole.OWNER] },
      },
      select: { name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const now = new Date();
  const dirtyCount = tasks.filter((task) => task.status === HousekeepingStatus.DIRTY).length;
  const activeCount = tasks.filter(
    (task) =>
      task.status === HousekeepingStatus.ASSIGNED ||
      task.status === HousekeepingStatus.IN_PROGRESS ||
      task.status === HousekeepingStatus.INSPECTION,
  ).length;
  const blockedCount = tasks.filter((task) => task.status === HousekeepingStatus.BLOCKED).length;
  const overdueCount = tasks.filter((task) => task.dueAt && task.dueAt < now && task.status !== HousekeepingStatus.READY).length;

  return (
    <AppShell>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-bold text-[#29f1ff]">Operations</p>
          <h2 className="mt-2 text-3xl font-black tracking-normal text-white">Housekeeping</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/62">
            Kanban unit cleaning, inspection, blocking, dan readiness yang langsung sinkron dengan check-out.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge label={`${units.length} units`} tone="muted" dot />
          <StatusBadge label={`${tasks.length} tasks`} tone="info" dot />
        </div>
      </div>

      <ActionFeedbackBanner feedback={feedback} />

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Dirty" value={String(dirtyCount)} icon={<Sparkles className="size-5" />} tone="warning" />
        <MetricCard title="Active Cleaning" value={String(activeCount)} icon={<Clock3 className="size-5" />} tone="info" />
        <MetricCard title="Overdue" value={String(overdueCount)} icon={<AlertTriangle className="size-5" />} tone="danger" />
        <MetricCard title="Blocked" value={String(blockedCount)} icon={<ClipboardCheck className="size-5" />} tone="danger" />
      </section>

      <section className="mt-6 grid gap-5 2xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 overflow-x-auto premium-scroll pb-2">
          <div className="grid min-w-[1500px] gap-4 xl:grid-cols-6">
            {statusOrder.map((status) => {
              const columnTasks = tasks.filter((task) => task.status === status);

              return (
                <section key={status} className={`rounded-[28px] border p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ${columnTheme[status]}`}>
                  <div className="flex items-center justify-between gap-3 rounded-[22px] border border-white/10 bg-black/12 px-3 py-3">
                    <StatusBadge
                      label={housekeepingStatusLabels[status]}
                      tone={housekeepingStatusTone[status]}
                      dot
                    />
                    <span className="rounded-full surface-chip px-2 py-1 text-xs font-black text-white/56">
                      {columnTasks.length}
                    </span>
                  </div>

                  <div className="mt-3 space-y-3">
                    {columnTasks.map((task) => (
                      <TaskCard key={task.id} task={task} assignees={assignees} canWrite={canWrite} />
                    ))}
                    {columnTasks.length === 0 ? (
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
                  <h3 className="text-lg font-black text-white">New Task</h3>
                  <p className="mt-1 text-xs font-semibold text-white/50">Create manual room task</p>
                </div>
              </div>

              <form action={createHousekeepingTaskAction} className="mt-5 space-y-3">
                <SelectField name="unitId" label="Unit" required>
                  {units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.code} - {unit.name}
                    </option>
                  ))}
                </SelectField>
                <TextField name="taskType" label="Task Type" placeholder="Deep cleaning, inspection, linen refresh" required />
                <SelectField name="priority" label="Priority" defaultValue={Priority.MEDIUM}>
                  {priorityOrder.map((priority) => (
                    <option key={priority} value={priority}>
                      {priorityLabels[priority]}
                    </option>
                  ))}
                </SelectField>
                <SelectField name="status" label="Status" defaultValue={HousekeepingStatus.DIRTY}>
                  {statusOrder.map((status) => (
                    <option key={status} value={status}>
                      {housekeepingStatusLabels[status]}
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
                <TextField name="dueAt" label="Due At" type="datetime-local" />
                <TextareaField name="notes" label="Notes" placeholder="Operational notes" />
                <button className="gold-gradient min-h-11 w-full rounded-[22px] text-sm font-black text-[#041015]">
                  Create Task
                </button>
              </form>
            </GlassCard>
          ) : null}

          <GlassCard className="p-5">
            <h3 className="text-lg font-black text-white">Unit Snapshot</h3>
            <div className="mt-4 space-y-3">
              {units.slice(0, 10).map((unit) => (
                <div key={unit.id} className="flex items-center justify-between gap-3 rounded-[22px] surface-inset p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-white">{unit.code}</p>
                    <p className="mt-1 truncate text-xs font-semibold text-white/45">{unit.unitType.name}</p>
                  </div>
                  <StatusBadge label={unitStatusLabels[unit.status]} tone={unitStatusTone[unit.status]} />
                </div>
              ))}
            </div>
          </GlassCard>
        </aside>
      </section>
    </AppShell>
  );
}

function TaskCard({
  task,
  assignees,
  canWrite,
}: {
  task: HousekeepingTaskForBoard;
  assignees: AssigneeOption[];
  canWrite: boolean;
}) {
  const updateAction = updateHousekeepingTaskAction.bind(null, task.id);
  const currentStay = task.unit.reservations[0];
  const overdue = task.dueAt && task.dueAt < new Date() && task.status !== HousekeepingStatus.READY;

  return (
    <article className="rounded-[22px] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.08),rgba(255,255,255,0.025))] p-4 shadow-[0_18px_42px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-black text-white">{task.unit.code}</p>
          <p className="mt-1 truncate text-xs font-semibold text-white/50">{task.unit.name}</p>
        </div>
        <StatusBadge label={priorityLabels[task.priority]} tone={priorityTone[task.priority]} />
      </div>

      <div className="mt-4 rounded-[22px] surface-inset p-3">
        <p className="text-sm font-black text-white">{task.taskType}</p>
        <p className="mt-1 text-xs font-semibold text-white/48">
          {task.assignedTo ?? "Unassigned"} · {task.unit.unitType.name}
        </p>
        {task.dueAt ? (
          <p className={overdue ? "mt-2 text-xs font-black text-red-100" : "mt-2 text-xs font-semibold text-white/52"}>
            Due {formatDateTimeId(task.dueAt)}
          </p>
        ) : null}
      </div>

      {currentStay ? (
        <div className="mt-3 rounded-[22px] border border-[#29f1ff]/16 bg-[#29f1ff]/8 p-3">
          <p className="truncate text-xs font-black text-[#b8fbff]">{currentStay.guest.fullName}</p>
          <p className="mt-1 text-[11px] font-semibold text-white/52">
            {currentStay.status === ReservationStatus.CHECKED_IN ? "In-house" : "Next stay"} · {formatDateId(currentStay.checkOutDate)}
          </p>
        </div>
      ) : null}

      {task.notes ? <p className="mt-3 text-xs leading-5 text-white/54">{task.notes}</p> : null}

      {canWrite ? (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            {nextTransitions(task.status).map((transition) => {
              const transitionAction = transitionHousekeepingTaskAction.bind(null, task.id);

              return (
                <form key={transition.status} action={transitionAction}>
                  <input type="hidden" name="status" value={transition.status} />
                  <button className={transition.className}>{transition.label}</button>
                </form>
              );
            })}
          </div>

          <form action={updateAction} className="mt-4 space-y-2 border-t border-white/10 pt-4">
            <SelectField name="status" label="Status" defaultValue={task.status}>
              {statusOrder.map((status) => (
                <option key={status} value={status}>
                  {housekeepingStatusLabels[status]}
                </option>
              ))}
            </SelectField>
            <SelectField name="priority" label="Priority" defaultValue={task.priority}>
              {priorityOrder.map((priority) => (
                <option key={priority} value={priority}>
                  {priorityLabels[priority]}
                </option>
              ))}
            </SelectField>
            <SelectField name="assignedTo" label="Assigned To" defaultValue={task.assignedTo ?? ""}>
              <option value="">Unassigned</option>
              {assignees.map((user) => (
                <option key={user.name} value={user.name}>
                  {user.name}
                </option>
              ))}
            </SelectField>
            <TextareaField name="notes" label="Notes" defaultValue={task.notes ?? ""} />
            <button className="min-h-10 w-full rounded-[16px] surface-chip text-xs font-black text-white/76">
              Update
            </button>
          </form>
        </>
      ) : null}
    </article>
  );
}

function nextTransitions(status: HousekeepingStatus) {
  const baseButton = "rounded-[16px] border px-3 py-2 text-xs font-black transition";

  if (status === HousekeepingStatus.DIRTY) {
    return [
      { label: "Assign", status: HousekeepingStatus.ASSIGNED, className: `${baseButton} border-sky-300/20 bg-sky-500/10 text-sky-100` },
      { label: "Start", status: HousekeepingStatus.IN_PROGRESS, className: `${baseButton} border-[#29f1ff]/24 bg-[#29f1ff]/10 text-[#b8fbff]` },
    ];
  }

  if (status === HousekeepingStatus.ASSIGNED) {
    return [
      { label: "Start", status: HousekeepingStatus.IN_PROGRESS, className: `${baseButton} border-[#29f1ff]/24 bg-[#29f1ff]/10 text-[#b8fbff]` },
      { label: "Block", status: HousekeepingStatus.BLOCKED, className: `${baseButton} border-red-300/20 bg-red-500/10 text-red-100` },
    ];
  }

  if (status === HousekeepingStatus.IN_PROGRESS) {
    return [
      { label: "Inspect", status: HousekeepingStatus.INSPECTION, className: `${baseButton} border-amber-300/20 bg-amber-500/10 text-amber-100` },
      { label: "Ready", status: HousekeepingStatus.READY, className: `${baseButton} border-emerald-300/20 bg-emerald-500/10 text-emerald-100` },
    ];
  }

  if (status === HousekeepingStatus.INSPECTION) {
    return [
      { label: "Ready", status: HousekeepingStatus.READY, className: `${baseButton} border-emerald-300/20 bg-emerald-500/10 text-emerald-100` },
      { label: "Rework", status: HousekeepingStatus.IN_PROGRESS, className: `${baseButton} border-sky-300/20 bg-sky-500/10 text-sky-100` },
    ];
  }

  if (status === HousekeepingStatus.BLOCKED) {
    return [
      { label: "Resume", status: HousekeepingStatus.IN_PROGRESS, className: `${baseButton} border-sky-300/20 bg-sky-500/10 text-sky-100` },
      { label: "Ready", status: HousekeepingStatus.READY, className: `${baseButton} border-emerald-300/20 bg-emerald-500/10 text-emerald-100` },
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
  tone: "warning" | "info" | "danger";
}) {
  const toneClass = {
    warning: "bg-amber-400/12 text-amber-100",
    info: "bg-sky-400/12 text-sky-100",
    danger: "bg-red-400/12 text-red-100",
  };

  return (
    <GlassCard className="p-5">
      <div className={`grid size-11 place-items-center rounded-[22px] ${toneClass[tone]}`}>{icon}</div>
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
        className="min-h-11 w-full rounded-[22px] surface-field px-4 text-sm font-bold text-white outline-none placeholder:text-white/34"
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
        className="min-h-11 w-full rounded-[22px] surface-field px-4 text-sm font-bold text-white outline-none"
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
        className="w-full rounded-[22px] surface-field px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-white/34"
      />
    </label>
  );
}
