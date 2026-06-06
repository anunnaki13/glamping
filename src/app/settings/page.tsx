import type { ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Database,
  KeyRound,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { RequestStatus, UserRole } from "@/generated/prisma/enums";
import {
  createUserAction,
  updatePropertySettingsAction,
  updateUserAction,
} from "@/app/settings/actions";
import { AppShell } from "@/components/layout/app-shell";
import { ActionFeedbackBanner } from "@/components/ui/action-feedback-banner";
import { GlassCard } from "@/components/ui/glass-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { getActionFeedback, type ActionFeedbackSearchParams } from "@/lib/action-feedback";
import { formatDateTimeId } from "@/lib/formatters";
import { getRolePermissions, hasPermission } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/action-guard";

export const dynamic = "force-dynamic";

const roleOrder = [
  UserRole.OWNER,
  UserRole.MANAGER,
  UserRole.FRONT_OFFICE,
  UserRole.HOUSEKEEPING,
  UserRole.FNB_ACTIVITY,
  UserRole.VIEWER,
];

const roleLabels: Record<UserRole, string> = {
  OWNER: "Owner",
  MANAGER: "Manager",
  FRONT_OFFICE: "Front Office",
  HOUSEKEEPING: "Housekeeping",
  FNB_ACTIVITY: "F&B / Activity",
  VIEWER: "Viewer",
};

const timezones = ["Asia/Makassar", "Asia/Jakarta", "Asia/Singapore", "UTC"];
const currencies = ["IDR", "USD", "SGD", "AUD"];

type SettingsPageProps = {
  searchParams: Promise<ActionFeedbackSearchParams>;
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const session = await requirePagePermission("settings:read");
  const feedback = getActionFeedback(await searchParams);
  const canManageSettings = hasPermission(session.role as UserRole, "settings:write");
  const canManageUsers = hasPermission(session.role as UserRole, "user:write");
  const prisma = getPrisma();
  const [property, users, counts, recentActivity] = await Promise.all([
    prisma.property.findUniqueOrThrow({
      where: { id: session.propertyId },
    }),
    prisma.user.findMany({
      where: { propertyId: session.propertyId },
      orderBy: [{ isActive: "desc" }, { role: "asc" }, { name: "asc" }],
    }),
    getOperationalCounts(session.propertyId),
    prisma.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  const authSecretConfigured = Boolean(process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 24);
  const databaseLocal = Boolean(process.env.DATABASE_URL?.includes("localhost") || process.env.DATABASE_URL?.includes("127.0.0.1"));
  const activeUsers = users.filter((user) => user.isActive).length;
  const ownerCount = users.filter((user) => user.role === UserRole.OWNER && user.isActive).length;
  const readiness = [
    {
      label: "Database connected",
      description: `${counts.units} units, ${counts.reservations} reservations, ${counts.orders} orders loaded.`,
      pass: true,
    },
    {
      label: "PostgreSQL local binding",
      description: databaseLocal ? "DATABASE_URL points to local database host." : "DATABASE_URL does not look local.",
      pass: databaseLocal,
    },
    {
      label: "Auth secret configured",
      description: authSecretConfigured ? "AUTH_SECRET is present for signed sessions." : "AUTH_SECRET is missing or too short.",
      pass: authSecretConfigured,
    },
    {
      label: "Active owner available",
      description: `${ownerCount} active owner account(s).`,
      pass: ownerCount > 0,
    },
  ];

  return (
    <AppShell>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-bold text-[#29f1ff]">Administration</p>
          <h2 className="mt-2 text-3xl font-black tracking-normal text-white">Settings</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/62">
            Kelola profil property, akses tim, role permission, dan kesiapan dasar sebelum sistem dipakai harian.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge label={`${activeUsers} active users`} tone="info" dot />
          <StatusBadge label={`${counts.units} units`} tone="muted" dot />
        </div>
      </div>

      <ActionFeedbackBanner feedback={feedback} />

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Users" value={`${activeUsers}/${users.length}`} icon={<Users className="size-5" />} />
        <MetricCard title="Reservations" value={String(counts.reservations)} icon={<Activity className="size-5" />} />
        <MetricCard title="Open Requests" value={String(counts.openRequests)} icon={<AlertTriangle className="size-5" />} />
        <MetricCard title="POS Orders" value={String(counts.orders)} icon={<Database className="size-5" />} />
      </section>

      <section className="mt-6 grid gap-5 2xl:grid-cols-[1fr_420px]">
        <div className="space-y-5">
          <GlassCard className="p-5">
            <div className="flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-[22px] bg-[#29f1ff]/14 text-[#b8fbff]">
                <Building2 className="size-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">Property Profile</h3>
                <p className="mt-1 text-xs font-semibold text-white/50">Update nama, kontak, timezone, dan mata uang properti.</p>
              </div>
            </div>

            <form action={updatePropertySettingsAction} className="mt-5 grid gap-4 xl:grid-cols-2">
              <TextField name="name" label="Property Name" defaultValue={property.name} disabled={!canManageSettings} required />
              <TextField name="slug" label="Slug" defaultValue={property.slug} disabled={!canManageSettings} required />
              <TextField name="phone" label="Phone" defaultValue={property.phone ?? ""} disabled={!canManageSettings} />
              <TextField name="email" label="Email" type="email" defaultValue={property.email ?? ""} disabled={!canManageSettings} />
              <SelectField name="timezone" label="Timezone" defaultValue={property.timezone} disabled={!canManageSettings}>
                {timezones.map((timezone) => (
                  <option key={timezone} value={timezone}>
                    {timezone}
                  </option>
                ))}
              </SelectField>
              <SelectField name="currency" label="Currency" defaultValue={property.currency} disabled={!canManageSettings}>
                {currencies.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </SelectField>
              <TextField name="logoUrl" label="Logo URL" defaultValue={property.logoUrl ?? ""} disabled={!canManageSettings} className="xl:col-span-2" />
              <TextareaField name="address" label="Address" defaultValue={property.address ?? ""} disabled={!canManageSettings} className="xl:col-span-2" />
              {canManageSettings ? (
                <div className="xl:col-span-2">
                  <button className="gold-gradient min-h-11 rounded-[22px] px-5 text-sm font-black text-[#041015]">
                    Save Property Settings
                  </button>
                </div>
              ) : null}
            </form>
          </GlassCard>

          {canManageUsers ? (
            <GlassCard className="p-5">
              <div className="flex items-center gap-3">
                <div className="grid size-11 place-items-center rounded-[22px] bg-[#29f1ff]/14 text-[#b8fbff]">
                  <UserPlus className="size-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Add Team Member</h3>
                  <p className="mt-1 text-xs font-semibold text-white/50">Akun baru langsung aktif dengan password awal.</p>
                </div>
              </div>

              <form action={createUserAction} className="mt-5 grid gap-4 xl:grid-cols-2">
                <TextField name="name" label="Name" required />
                <TextField name="email" label="Email" type="email" required />
                <TextField name="password" label="Initial Password" type="password" minLength={8} required />
                <SelectField name="role" label="Role" defaultValue={UserRole.VIEWER}>
                  {roleOrder.map((role) => (
                    <option key={role} value={role}>
                      {roleLabels[role]}
                    </option>
                  ))}
                </SelectField>
                <TextField name="avatarUrl" label="Avatar URL" className="xl:col-span-2" />
                <div className="xl:col-span-2">
                  <button className="min-h-11 rounded-[22px] border border-[#29f1ff]/24 bg-[#29f1ff]/10 px-5 text-sm font-black text-[#b8fbff]">
                    Create User
                  </button>
                </div>
              </form>
            </GlassCard>
          ) : null}

          <GlassCard className="overflow-hidden p-0">
            <div className="border-b border-white/10 p-5">
              <h3 className="text-lg font-black text-white">Team Access</h3>
              <p className="mt-1 text-sm font-semibold text-white/50">Edit role, status aktif, atau reset password user.</p>
            </div>
            <div className="grid gap-4 p-5 xl:grid-cols-2">
              {users.map((user) => {
                const updateAction = updateUserAction.bind(null, user.id);

                return (
                  <form key={user.id} action={updateAction} className="rounded-[22px] surface-inset p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-white">{user.name}</p>
                        <p className="mt-1 text-xs font-semibold text-white/50">{user.email}</p>
                      </div>
                      <StatusBadge label={user.isActive ? "Active" : "Inactive"} tone={user.isActive ? "success" : "muted"} dot />
                    </div>

                    <div className="mt-4 grid gap-3">
                      <TextField name="name" label="Name" defaultValue={user.name} disabled={!canManageUsers} required />
                      <TextField name="email" label="Email" type="email" defaultValue={user.email} disabled={!canManageUsers} required />
                      <SelectField name="role" label="Role" defaultValue={user.role} disabled={!canManageUsers}>
                        {roleOrder.map((role) => (
                          <option key={role} value={role}>
                            {roleLabels[role]}
                          </option>
                        ))}
                      </SelectField>
                      <TextField name="avatarUrl" label="Avatar URL" defaultValue={user.avatarUrl ?? ""} disabled={!canManageUsers} />
                      <TextField name="password" label="New Password" type="password" minLength={8} placeholder="Leave blank to keep current" disabled={!canManageUsers} />
                      <label className="flex items-center gap-2 text-sm font-bold text-white/64">
                        <input type="checkbox" name="isActive" defaultChecked={user.isActive} disabled={!canManageUsers} className="size-4 accent-[#29f1ff]" />
                        Active user
                      </label>
                    </div>

                    {canManageUsers ? (
                      <button className="mt-4 min-h-10 w-full rounded-[16px] surface-chip text-xs font-black text-white/76">
                        Save User
                      </button>
                    ) : null}
                  </form>
                );
              })}
            </div>
          </GlassCard>
        </div>

        <aside className="space-y-5">
          <GlassCard className="p-5">
            <div className="flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-[22px] bg-emerald-400/12 text-emerald-100">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">Readiness</h3>
                <p className="mt-1 text-xs font-semibold text-white/50">Basic production checklist</p>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {readiness.map((item) => (
                <ReadinessItem key={item.label} {...item} />
              ))}
            </div>
          </GlassCard>

          <GlassCard className="p-5">
            <div className="flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-[22px] bg-[#29f1ff]/14 text-[#b8fbff]">
                <KeyRound className="size-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">Role Matrix</h3>
                <p className="mt-1 text-xs font-semibold text-white/50">Permission summary per role</p>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {roleOrder.map((role) => {
                const permissions = getRolePermissions(role);
                const count = users.filter((user) => user.role === role).length;

                return (
                  <div key={role} className="rounded-[22px] surface-inset p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-black text-white">{roleLabels[role]}</p>
                      <StatusBadge label={`${count} user`} tone={count > 0 ? "info" : "muted"} />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {permissions.slice(0, 8).map((permission) => (
                        <span key={permission} className="rounded-full surface-chip px-2.5 py-1 text-[11px] font-bold text-white/58">
                          {permission}
                        </span>
                      ))}
                      {permissions.length > 8 ? (
                        <span className="rounded-full border border-[#29f1ff]/20 bg-[#29f1ff]/10 px-2.5 py-1 text-[11px] font-black text-[#b8fbff]">
                          +{permissions.length - 8}
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassCard>

          <GlassCard className="p-5">
            <h3 className="text-lg font-black text-white">Recent Activity</h3>
            <div className="mt-4 space-y-3">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="rounded-[22px] surface-inset p-3">
                  <p className="text-sm font-black text-white">{activity.action}</p>
                  <p className="mt-1 text-xs font-semibold text-white/50">{activity.description ?? activity.entityType}</p>
                  <p className="mt-2 text-[11px] font-semibold text-white/35">{formatDateTimeId(activity.createdAt)}</p>
                </div>
              ))}
            </div>
          </GlassCard>
        </aside>
      </section>
    </AppShell>
  );
}

async function getOperationalCounts(propertyId: string) {
  const prisma = getPrisma();
  const [units, reservations, openRequests, orders] = await Promise.all([
    prisma.unit.count({ where: { propertyId } }),
    prisma.reservation.count({ where: { unit: { propertyId } } }),
    prisma.serviceRequest.count({
      where: {
        status: { notIn: [RequestStatus.COMPLETED, RequestStatus.CANCELLED] },
        OR: [
          { reservation: { unit: { propertyId } } },
          { reservationId: null },
        ],
      },
    }),
    prisma.order.count({ where: { reservation: { unit: { propertyId } } } }),
  ]);

  return { units, reservations, openRequests, orders };
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

function ReadinessItem({ label, description, pass }: { label: string; description: string; pass: boolean }) {
  return (
    <div className="rounded-[22px] surface-inset p-4">
      <div className="flex items-start gap-3">
        {pass ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-200" /> : <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-200" />}
        <div>
          <p className="font-black text-white">{label}</p>
          <p className="mt-1 text-xs font-semibold leading-5 text-white/52">{description}</p>
        </div>
      </div>
    </div>
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
        rows={3}
        className="w-full rounded-[22px] surface-field px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-white/34 disabled:opacity-50"
      />
    </label>
  );
}
