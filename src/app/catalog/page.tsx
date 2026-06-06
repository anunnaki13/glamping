/* eslint-disable @next/next/no-img-element */
import type { ReactNode } from "react";
import {
  Activity,
  Boxes,
  CircleDollarSign,
  ImageIcon,
  PackagePlus,
  ShoppingBag,
  Tags,
} from "lucide-react";
import { PosCategory, UserRole } from "@/generated/prisma/enums";
import {
  createCatalogItemAction,
  updateCatalogItemAction,
} from "@/app/catalog/actions";
import { AppShell } from "@/components/layout/app-shell";
import { ActionFeedbackBanner } from "@/components/ui/action-feedback-banner";
import { GlassCard } from "@/components/ui/glass-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { getActionFeedback, type ActionFeedbackSearchParams } from "@/lib/action-feedback";
import { requirePagePermission } from "@/lib/action-guard";
import { formatDateTimeId, formatIdr } from "@/lib/formatters";
import { posCategoryLabels } from "@/lib/labels";
import { canViewOperationalFinancialData, hasPermission } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const categoryOrder = [
  PosCategory.PACKAGE,
  PosCategory.FOOD,
  PosCategory.BEVERAGE,
  PosCategory.SPA,
  PosCategory.ACTIVITY,
  PosCategory.TRANSPORT,
  PosCategory.MERCHANDISE,
];

type CatalogPageProps = {
  searchParams: Promise<ActionFeedbackSearchParams>;
};

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const session = await requirePagePermission("pos:read");
  const feedback = getActionFeedback(await searchParams);
  const role = session.role as UserRole;
  const canWrite = hasPermission(role, "pos:write");
  const canViewFinancials = canViewOperationalFinancialData(role);
  const prisma = getPrisma();
  const [items, recentActivity] = await Promise.all([
    prisma.posItem.findMany({
      include: {
        orderItems: true,
      },
      orderBy: [{ isActive: "desc" }, { category: "asc" }, { name: "asc" }],
    }),
    prisma.activityLog.findMany({
      where: {
        action: { in: ["pos_item.created", "pos_item.updated"] },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  const activeItems = items.filter((item) => item.isActive);
  const inactiveItems = items.length - activeItems.length;
  const availableItems = activeItems.filter((item) => item.isAvailable);
  const unavailableActiveItems = activeItems.length - availableItems.length;
  const capacityControlledItems = activeItems.filter((item) => item.dailyCapacity !== null);
  const catalogValue = activeItems.reduce((sum, item) => sum + Number(item.price), 0);
  const totalSoldQuantity = items.reduce((sum, item) => sum + item.orderItems.reduce((itemSum, orderItem) => itemSum + orderItem.quantity, 0), 0);
  const itemPerformance = items
    .map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      quantity: item.orderItems.reduce((sum, orderItem) => sum + orderItem.quantity, 0),
      revenue: item.orderItems.reduce((sum, orderItem) => sum + Number(orderItem.total), 0),
    }))
    .sort((left, right) => canViewFinancials ? right.revenue - left.revenue : right.quantity - left.quantity)
    .slice(0, 8);

  return (
    <AppShell>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-bold text-[#29f1ff]">POS & Activities</p>
          <h2 className="mt-2 text-3xl font-black tracking-normal text-white">Catalog</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/62">
            Kelola item F&B, spa, activity, transport, package, dan merchandise yang bisa ditambahkan ke order tamu.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge label={`${activeItems.length} active items`} tone="success" dot />
          <StatusBadge label={`${unavailableActiveItems} sold out`} tone={unavailableActiveItems > 0 ? "warning" : "muted"} dot />
          <StatusBadge label={`${inactiveItems} inactive`} tone="muted" dot />
        </div>
      </div>

      <ActionFeedbackBanner feedback={feedback} />

      <section className="mt-6 grid gap-4 md:grid-cols-4">
        <MetricCard title="Catalog Items" value={String(items.length)} icon={<Boxes className="size-5" />} tone="info" />
        <MetricCard title="Available Items" value={`${availableItems.length}/${activeItems.length}`} icon={<ShoppingBag className="size-5" />} tone="success" />
        <MetricCard title="Items Sold" value={String(totalSoldQuantity)} icon={<Activity className="size-5" />} tone="warning" />
        <MetricCard title={canViewFinancials ? "Active Price Sum" : "Capacity Rules"} value={canViewFinancials ? formatIdr(catalogValue) : String(capacityControlledItems.length)} icon={<CircleDollarSign className="size-5" />} tone="danger" />
      </section>

      <section className="mt-6 grid gap-5 2xl:grid-cols-[1fr_420px]">
        <div className="space-y-5">
          {canWrite ? (
            <GlassCard className="p-5">
              <div className="flex items-center gap-3">
                <div className="grid size-11 place-items-center rounded-[22px] bg-[#29f1ff]/14 text-[#b8fbff]">
                  <PackagePlus className="size-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Add Catalog Item</h3>
                  <p className="mt-1 text-xs font-semibold text-white/50">Item aktif akan langsung muncul di form order.</p>
                </div>
              </div>

              <form action={createCatalogItemAction} className="mt-5 grid gap-4 xl:grid-cols-[1fr_220px_180px_220px]">
                <TextField name="name" label="Item Name" placeholder="Sunset Picnic Basket" required />
                <SelectField name="category" label="Category" defaultValue={PosCategory.PACKAGE}>
                  {categoryOrder.map((category) => (
                    <option key={category} value={category}>
                      {posCategoryLabels[category]}
                    </option>
                  ))}
                </SelectField>
                <TextField name="price" label="Price" type="number" min="0" defaultValue="0" required />
                <div className="flex flex-wrap items-end gap-4 pb-3">
                  <label className="flex items-center gap-2 text-sm font-bold text-white/64">
                    <input type="checkbox" name="isActive" defaultChecked className="size-4 accent-[#29f1ff]" />
                    Active
                  </label>
                  <label className="flex items-center gap-2 text-sm font-bold text-white/64">
                    <input type="checkbox" name="isAvailable" defaultChecked className="size-4 accent-[#29f1ff]" />
                    Available
                  </label>
                </div>
                <TextField name="slotLabel" label="Slot / Service Window" placeholder="07:00-10:00" />
                <TextField name="leadTimeMinutes" label="Lead Time Minutes" type="number" min="0" defaultValue="0" />
                <TextField name="dailyCapacity" label="Daily Capacity" type="number" min="1" placeholder="Unlimited" />
                <FileField name="photo" label="Upload Photo" className="xl:col-span-2" />
                <TextField name="photoUrl" label="Photo URL / path" placeholder="/uploads/demo/catalog-floating-breakfast.jpg" />
                <TextareaField name="description" label="Description" className="xl:col-span-2" />
                <div className="xl:col-span-4">
                  <button className="gold-gradient min-h-11 rounded-[22px] px-5 text-sm font-black text-[#041015]">
                    Create Item
                  </button>
                </div>
              </form>
            </GlassCard>
          ) : null}

          <GlassCard className="overflow-hidden p-0">
            <div className="border-b border-white/10 p-5">
              <h3 className="text-lg font-black text-white">Item Catalog</h3>
              <p className="mt-1 text-sm font-semibold text-white/50">Edit harga, kategori, status aktif, dan deskripsi item.</p>
            </div>
            <div className="grid gap-4 p-5 xl:grid-cols-2">
              {items.map((item) => {
                const updateAction = updateCatalogItemAction.bind(null, item.id);
                const quantitySold = item.orderItems.reduce((sum, orderItem) => sum + orderItem.quantity, 0);
                const revenue = item.orderItems.reduce((sum, orderItem) => sum + Number(orderItem.total), 0);
                const capacityLabel = item.dailyCapacity === null ? "Unlimited" : `${item.dailyCapacity}/day`;
                const leadTimeLabel = item.leadTimeMinutes > 0 ? `${item.leadTimeMinutes} min` : "No lead time";

                return (
                  <form key={item.id} action={updateAction} className="rounded-[22px] surface-inset p-4">
                    <div className="relative mb-4 aspect-[16/9] overflow-hidden rounded-[18px] border border-white/10 bg-[linear-gradient(135deg,rgba(41,241,255,0.12),transparent_45%),linear-gradient(145deg,rgba(12,22,32,0.95),rgba(5,10,14,0.86))]">
                      {item.photoUrl ? (
                        <img src={item.photoUrl} alt={`${item.name} photo`} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <div className="absolute inset-0 grid place-items-center text-white/34">
                          <ImageIcon className="size-9" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,8,12,0.08),rgba(2,8,12,0.62))]" />
                      <div className="absolute bottom-3 left-3 flex flex-wrap gap-2">
                        <StatusBadge label={posCategoryLabels[item.category]} tone="info" />
                        <StatusBadge label={item.isAvailable ? "Available" : "Sold out"} tone={item.isAvailable ? "success" : "warning"} dot />
                      </div>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-white">{item.name}</p>
                        {canViewFinancials ? <p className="mt-1 text-xs font-semibold text-[#b8fbff]">{formatIdr(Number(item.price))}</p> : null}
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        <StatusBadge label={item.isActive ? "Active" : "Inactive"} tone={item.isActive ? "success" : "muted"} dot />
                        <StatusBadge label={capacityLabel} tone={item.dailyCapacity === null ? "muted" : "info"} />
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 rounded-[22px] surface-inset p-3 sm:grid-cols-3">
                      <div>
                        <p className="text-xs font-bold text-white/42">Slot</p>
                        <p className="mt-1 text-sm font-black text-white">{item.slotLabel ?? "Anytime"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white/42">Lead</p>
                        <p className="mt-1 text-sm font-black text-white">{leadTimeLabel}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white/42">Capacity</p>
                        <p className="mt-1 text-sm font-black text-white">{capacityLabel}</p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3">
                      <TextField name="name" label="Item Name" defaultValue={item.name} disabled={!canWrite} required />
                      <SelectField name="category" label="Category" defaultValue={item.category} disabled={!canWrite}>
                        {categoryOrder.map((category) => (
                          <option key={category} value={category}>
                            {posCategoryLabels[category]}
                          </option>
                        ))}
                      </SelectField>
                      {canViewFinancials ? <TextField name="price" label="Price" type="number" min="0" defaultValue={String(Number(item.price))} disabled={!canWrite} required /> : null}
                      <div className="grid gap-3 sm:grid-cols-3">
                        <TextField name="slotLabel" label="Slot / Service Window" defaultValue={item.slotLabel ?? ""} disabled={!canWrite} />
                        <TextField name="leadTimeMinutes" label="Lead Minutes" type="number" min="0" defaultValue={String(item.leadTimeMinutes)} disabled={!canWrite} />
                        <TextField name="dailyCapacity" label="Daily Capacity" type="number" min="1" defaultValue={item.dailyCapacity === null ? "" : String(item.dailyCapacity)} placeholder="Unlimited" disabled={!canWrite} />
                      </div>
                      <FileField name="photo" label="Replace Photo" disabled={!canWrite} />
                      <TextField name="photoUrl" label="Photo URL / path" defaultValue={item.photoUrl ?? ""} disabled={!canWrite} />
                      <TextareaField name="description" label="Description" defaultValue={item.description ?? ""} disabled={!canWrite} />
                      <div className="flex flex-wrap gap-4">
                        <label className="flex items-center gap-2 text-sm font-bold text-white/64">
                          <input type="checkbox" name="isActive" defaultChecked={item.isActive} disabled={!canWrite} className="size-4 accent-[#29f1ff]" />
                          Active item
                        </label>
                        <label className="flex items-center gap-2 text-sm font-bold text-white/64">
                          <input type="checkbox" name="isAvailable" defaultChecked={item.isAvailable} disabled={!canWrite} className="size-4 accent-[#29f1ff]" />
                          Available today
                        </label>
                      </div>
                    </div>

                    <div className={`mt-4 grid gap-3 rounded-[22px] surface-inset p-3 ${canViewFinancials ? "grid-cols-2" : "grid-cols-1"}`}>
                      <div>
                        <p className="text-xs font-bold text-white/42">Sold</p>
                        <p className="mt-1 font-black text-white">{quantitySold}</p>
                      </div>
                      {canViewFinancials ? (
                        <div>
                          <p className="text-xs font-bold text-white/42">Revenue</p>
                          <p className="mt-1 font-black text-white">{formatIdr(revenue)}</p>
                        </div>
                      ) : null}
                    </div>

                    {canWrite ? (
                      <button className="mt-4 min-h-10 w-full rounded-[16px] surface-chip text-xs font-black text-white/76">
                        Save Item
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
              <div className="grid size-11 place-items-center rounded-[22px] bg-[#29f1ff]/14 text-[#b8fbff]">
                <Tags className="size-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">Category Mix</h3>
                <p className="mt-1 text-xs font-semibold text-white/50">
                  {canViewFinancials ? "Jumlah item dan harga aktif per kategori." : "Jumlah item aktif per kategori."}
                </p>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {categoryOrder.map((category) => {
                const categoryItems = items.filter((item) => item.category === category);
                const categoryActiveItems = categoryItems.filter((item) => item.isActive);
                const activeValue = categoryActiveItems.reduce((sum, item) => sum + Number(item.price), 0);

                return (
                  <div key={category} className="rounded-[22px] surface-inset p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-black text-white">{posCategoryLabels[category]}</p>
                      <StatusBadge label={`${categoryActiveItems.length}/${categoryItems.length}`} tone={categoryActiveItems.length > 0 ? "info" : "muted"} />
                    </div>
                    <p className="mt-2 text-sm font-semibold text-white/52">
                      {canViewFinancials ? `${formatIdr(activeValue)} active price sum` : `${categoryActiveItems.length} active items`}
                    </p>
                  </div>
                );
              })}
            </div>
          </GlassCard>

          <GlassCard className="p-5">
            <h3 className="text-lg font-black text-white">Top Item Activity</h3>
            <div className="mt-4 space-y-3">
              {itemPerformance.map((item) => (
                <div key={item.id} className="rounded-[22px] surface-inset p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-white">{item.name}</p>
                      <p className="mt-1 text-xs font-semibold text-white/45">{posCategoryLabels[item.category]}</p>
                    </div>
                    <StatusBadge label={`${item.quantity} sold`} tone={item.quantity > 0 ? "success" : "muted"} />
                  </div>
                  <p className="mt-2 text-sm font-black text-[#b8fbff]">{canViewFinancials ? formatIdr(item.revenue) : `${item.quantity} sold`}</p>
                </div>
              ))}
            </div>
          </GlassCard>

          <GlassCard className="p-5">
            <h3 className="text-lg font-black text-white">Recent Catalog Activity</h3>
            <div className="mt-4 space-y-3">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="rounded-[22px] surface-inset p-3">
                  <p className="text-sm font-black text-white">{activity.action}</p>
                  <p className="mt-1 text-xs font-semibold text-white/50">{activity.description ?? activity.entityType}</p>
                  <p className="mt-2 text-[11px] font-semibold text-white/35">{formatDateTimeId(activity.createdAt)}</p>
                </div>
              ))}
              {recentActivity.length === 0 ? (
                <div className="rounded-[22px] surface-inset p-5 text-sm font-semibold text-white/54">
                  Belum ada aktivitas katalog.
                </div>
              ) : null}
            </div>
          </GlassCard>
        </aside>
      </section>
    </AppShell>
  );
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
    <GlassCard className="p-5">
      <div className={`grid size-11 place-items-center rounded-[22px] ${toneClass[tone]}`}>{icon}</div>
      <p className="mt-4 text-sm font-bold text-white/58">{title}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
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

function FileField({
  label,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className={className}>
      <span className="mb-2 block text-xs font-black uppercase tracking-normal text-white/42">{label}</span>
      <input
        {...props}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="min-h-11 w-full rounded-[22px] surface-field px-4 pt-2.5 text-sm font-bold text-white outline-none disabled:opacity-50 file:mr-3 file:rounded-[14px] file:border-0 file:bg-white/12 file:px-3 file:py-1.5 file:text-xs file:font-black file:text-white"
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
