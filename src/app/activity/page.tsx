import type { ReactNode } from "react";
import Link from "next/link";
import {
  Activity,
  Clock,
  Database,
  Download,
  RotateCcw,
  Search,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { ActionFeedbackBanner } from "@/components/ui/action-feedback-banner";
import { GlassCard } from "@/components/ui/glass-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { getActionFeedback, type ActionFeedbackSearchParams } from "@/lib/action-feedback";
import { requirePagePermission } from "@/lib/action-guard";
import { formatDateTimeId } from "@/lib/formatters";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type ActivityPageProps = {
  searchParams: Promise<{
    q?: string;
    action?: string;
    entity?: string;
    actor?: string;
  } & ActionFeedbackSearchParams>;
};

export default async function ActivityPage({ searchParams }: ActivityPageProps) {
  const session = await requirePagePermission("activity:read");
  const params = await searchParams;
  const feedback = getActionFeedback(params);
  const query = params.q?.trim() || undefined;
  const action = params.action?.trim() || undefined;
  const entity = params.entity?.trim() || undefined;
  const prisma = getPrisma();
  const users = await prisma.user.findMany({
    where: { propertyId: session.propertyId },
    select: { id: true, name: true, email: true, role: true },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });
  const propertyUserIds = users.map((user) => user.id);
  const actor = params.actor && propertyUserIds.includes(params.actor) ? params.actor : undefined;
  const scopedActorIds = actor ? [actor] : propertyUserIds;
  const filteredWhere = {
    actorId: { in: scopedActorIds },
    action,
    entityType: entity,
    OR: query
      ? [
          { action: { contains: query, mode: "insensitive" as const } },
          { entityType: { contains: query, mode: "insensitive" as const } },
          { entityId: { contains: query, mode: "insensitive" as const } },
          { description: { contains: query, mode: "insensitive" as const } },
        ]
      : undefined,
  };
  const [activities, filteredCount, recentUniverse, todayCount] = await Promise.all([
    prisma.activityLog.findMany({
      where: filteredWhere,
      orderBy: { createdAt: "desc" },
      take: 120,
    }),
    prisma.activityLog.count({ where: filteredWhere }),
    prisma.activityLog.findMany({
      where: { actorId: { in: propertyUserIds } },
      select: { action: true, entityType: true },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.activityLog.count({
      where: {
        actorId: { in: propertyUserIds },
        createdAt: {
          gte: startOfToday(),
        },
      },
    }),
  ]);
  const userMap = new Map(users.map((user) => [user.id, user]));
  const actionOptions = Array.from(new Set(recentUniverse.map((item) => item.action))).sort();
  const entityOptions = Array.from(new Set(recentUniverse.map((item) => item.entityType))).sort();
  const exportUrl = buildExportUrl({ q: query, action, entity, actor });
  const sensitiveEvents = activities.filter((item) => isSensitiveAction(item.action)).length;
  const checkoutEvents = activities.filter((item) => item.action.includes("checked_")).length;

  return (
    <AppShell>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-bold text-[#29f1ff]">Administration</p>
          <h2 className="mt-2 text-3xl font-black tracking-normal text-white">Activity Log</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/62">
            Audit trail operasional untuk check-in/out, reservasi, pesan, POS, housekeeping, AI setup, dan perubahan admin.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge label={`${filteredCount} matched`} tone="info" dot />
          <StatusBadge label={`${todayCount} today`} tone="success" dot />
        </div>
      </div>

      <ActionFeedbackBanner feedback={feedback} />

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Matched Events" value={String(filteredCount)} icon={<Activity className="size-5" />} tone="info" />
        <MetricCard title="Today" value={String(todayCount)} icon={<Clock className="size-5" />} tone="success" />
        <MetricCard title="Check Flow Events" value={String(checkoutEvents)} icon={<ShieldCheck className="size-5" />} tone="warning" />
        <MetricCard title="Sensitive/Admin" value={String(sensitiveEvents)} icon={<Database className="size-5" />} tone="danger" />
      </section>

      <GlassCard className="mt-6 p-5">
        <form className="grid gap-3 xl:grid-cols-[1fr_220px_180px_220px_auto_auto_auto]">
          <label className="flex min-h-12 items-center gap-3 rounded-[22px] surface-field px-4">
            <Search className="size-5 text-[#29f1ff]" />
            <input
              name="q"
              defaultValue={query}
              placeholder="Search action, entity, description..."
              className="w-full bg-transparent text-sm font-semibold text-white outline-none placeholder:text-white/36"
            />
          </label>
          <SelectFilter name="action" value={action} emptyLabel="All Actions" options={actionOptions} />
          <SelectFilter name="entity" value={entity} emptyLabel="All Entities" options={entityOptions} />
          <select
            name="actor"
            defaultValue={actor ?? ""}
            className="min-h-12 rounded-[22px] surface-field px-4 text-sm font-bold text-white outline-none"
          >
            <option value="">All Actors</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
          <button className="min-h-12 rounded-[22px] border border-[#29f1ff]/24 bg-[#29f1ff]/10 px-5 text-sm font-black text-[#b8fbff]">
            Filter
          </button>
          <Link className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[22px] border border-white/10 px-5 text-sm font-black text-white/70" href="/activity">
            <RotateCcw className="size-4" />
            Reset
          </Link>
          <Link className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[22px] border border-emerald-300/20 bg-emerald-400/10 px-5 text-sm font-black text-emerald-100" href={exportUrl}>
            <Download className="size-4" />
            CSV
          </Link>
        </form>
      </GlassCard>

      <section className="mt-6 grid gap-5 2xl:grid-cols-[1fr_360px]">
        <GlassCard className="overflow-hidden p-0">
          <div className="border-b border-white/10 p-5">
            <h3 className="text-lg font-black text-white">Audit Timeline</h3>
            <p className="mt-1 text-sm font-semibold text-white/50">Menampilkan maksimal 120 event terbaru dari filter aktif.</p>
          </div>
          <div className="space-y-3 p-5">
            {activities.map((activity) => {
              const actorUser = activity.actorId ? userMap.get(activity.actorId) : null;
              const href = getEntityHref(activity.entityType, activity.entityId);

              return (
                <div key={activity.id} className="rounded-[22px] surface-inset p-4">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge label={activity.entityType} tone={entityTone(activity.entityType)} dot />
                        <p className="font-mono text-sm font-black text-[#b8fbff]">{activity.action}</p>
                      </div>
                      <p className="mt-3 text-sm font-semibold leading-6 text-white/72">
                        {activity.description ?? "No description."}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-white/46">
                        <span>{formatDateTimeId(activity.createdAt)}</span>
                        <span>{actorUser ? actorUser.name : "Unknown actor"}</span>
                        {activity.entityId ? <span>{activity.entityId}</span> : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 xl:justify-end">
                      {href ? (
                        <Link href={href} className="rounded-[16px] border border-white/10 px-3 py-2 text-xs font-black text-white/74">
                          Open entity
                        </Link>
                      ) : null}
                    </div>
                  </div>
                  {activity.metadata ? (
                    <pre className="mt-3 max-h-24 overflow-auto rounded-[22px] surface-inset p-3 text-xs font-semibold leading-5 text-white/54">
                      {JSON.stringify(activity.metadata, null, 2)}
                    </pre>
                  ) : null}
                </div>
              );
            })}
            {activities.length === 0 ? (
              <div className="rounded-[22px] surface-inset p-8 text-center text-sm font-semibold text-white/58">
                Tidak ada activity log yang cocok dengan filter.
              </div>
            ) : null}
          </div>
        </GlassCard>

        <aside className="space-y-5">
          <GlassCard className="p-5">
            <h3 className="text-lg font-black text-white">Actors</h3>
            <div className="mt-4 space-y-3">
              {users.map((user) => {
                const count = activities.filter((activity) => activity.actorId === user.id).length;
                return (
                  <div key={user.id} className="flex items-center justify-between gap-3 rounded-[22px] surface-inset p-3">
                    <div className="flex items-center gap-3">
                      <div className="grid size-10 place-items-center rounded-[22px] bg-[#29f1ff]/14 text-[#b8fbff]">
                        <UserRound className="size-5" />
                      </div>
                      <div>
                        <p className="font-black text-white">{user.name}</p>
                        <p className="mt-1 text-xs font-semibold text-white/46">{user.role.replaceAll("_", " ")}</p>
                      </div>
                    </div>
                    <StatusBadge label={String(count)} tone={count > 0 ? "info" : "muted"} />
                  </div>
                );
              })}
            </div>
          </GlassCard>

          <GlassCard className="p-5">
            <h3 className="text-lg font-black text-white">Audit Notes</h3>
            <div className="mt-4 space-y-3 text-sm font-semibold leading-6 text-white/62">
              <p>Event difilter ke user properti aktif agar audit V1 tidak bercampur antar property.</p>
              <p>Metadata ditampilkan untuk event penting seperti override, perubahan status, dan konfigurasi.</p>
              <p>CSV export mengikuti filter yang sedang aktif.</p>
            </div>
          </GlassCard>
        </aside>
      </section>
    </AppShell>
  );
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function buildExportUrl(filters: { q?: string; action?: string; entity?: string; actor?: string }) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });
  const queryString = params.toString();
  return queryString ? `/activity/export?${queryString}` : "/activity/export";
}

function isSensitiveAction(action: string) {
  return action.includes("login") || action.includes("settings") || action.includes("user") || action.includes("ai") || action.includes("override");
}

function getEntityHref(entityType: string, entityId: string | null) {
  if (!entityId) {
    return null;
  }

  const hrefs: Record<string, string> = {
    Reservation: `/reservations/${entityId}`,
    Unit: `/units/${entityId}`,
    Guest: `/guests/${entityId}`,
    HousekeepingTask: "/housekeeping",
    ServiceRequest: "/service-requests",
    Order: "/orders",
    PosItem: "/catalog",
    MessageTemplate: "/messages",
    AiConfiguration: "/ai",
    AiPromptTemplate: "/ai",
    Property: "/settings",
    User: "/settings",
  };

  return hrefs[entityType] ?? null;
}

function entityTone(entityType: string): "success" | "warning" | "danger" | "info" | "muted" {
  if (entityType === "Reservation" || entityType === "Guest") {
    return "info";
  }

  if (entityType === "HousekeepingTask" || entityType === "ServiceRequest") {
    return "warning";
  }

  if (entityType === "User" || entityType === "Property" || entityType.startsWith("Ai")) {
    return "danger";
  }

  return "muted";
}

function MetricCard({ title, value, icon, tone }: { title: string; value: string; icon: ReactNode; tone: "success" | "warning" | "danger" | "info" }) {
  const toneClass = {
    success: "bg-emerald-400/14 text-emerald-100",
    warning: "bg-amber-400/14 text-amber-100",
    danger: "bg-red-400/14 text-red-100",
    info: "bg-sky-400/14 text-sky-100",
  }[tone];

  return (
    <GlassCard className="p-5">
      <div className={`grid size-11 place-items-center rounded-[22px] ${toneClass}`}>{icon}</div>
      <p className="mt-4 text-sm font-bold text-white/60">{title}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </GlassCard>
  );
}

function SelectFilter({ name, value, emptyLabel, options }: { name: string; value?: string; emptyLabel: string; options: string[] }) {
  return (
    <select
      name={name}
      defaultValue={value ?? ""}
      className="min-h-12 rounded-[22px] surface-field px-4 text-sm font-bold text-white outline-none"
    >
      <option value="">{emptyLabel}</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}
