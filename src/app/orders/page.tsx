/* eslint-disable @next/next/no-img-element */
import type { ReactNode } from "react";
import {
  CreditCard,
  PackagePlus,
  ReceiptText,
  ShoppingBag,
} from "lucide-react";
import { endOfDay, startOfDay } from "date-fns";
import {
  OrderStatus,
  PaymentStatus,
  PosCategory,
  ReservationStatus,
  UserRole,
} from "@/generated/prisma/enums";
import { createOrderAction, updateOrderStatusAction } from "@/app/orders/actions";
import { AppShell } from "@/components/layout/app-shell";
import { ActionFeedbackBanner } from "@/components/ui/action-feedback-banner";
import { CurrencyInput } from "@/components/ui/currency-input";
import { GlassCard } from "@/components/ui/glass-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDateTimeId, formatIdr } from "@/lib/formatters";
import {
  orderStatusLabels,
  orderStatusTone,
  paymentStatusLabels,
  paymentStatusTone,
  posCategoryLabels,
} from "@/lib/labels";
import { getPrisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/action-guard";
import { getActionFeedback, type ActionFeedbackSearchParams } from "@/lib/action-feedback";
import { canViewOperationalFinancialData, hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const orderStatusOrder = [
  OrderStatus.OPEN,
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.DELIVERED,
  OrderStatus.COMPLETED,
  OrderStatus.CANCELLED,
];

const paymentStatusOrder = [
  PaymentStatus.UNPAID,
  PaymentStatus.PARTIAL,
  PaymentStatus.PAID,
  PaymentStatus.REFUNDED,
];

const posCategoryOrder = [
  PosCategory.PACKAGE,
  PosCategory.FOOD,
  PosCategory.BEVERAGE,
  PosCategory.SPA,
  PosCategory.ACTIVITY,
  PosCategory.TRANSPORT,
  PosCategory.MERCHANDISE,
];

type OrdersPageProps = {
  searchParams: Promise<ActionFeedbackSearchParams>;
};

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const session = await requirePagePermission("pos:read");
  const feedback = getActionFeedback(await searchParams);
  const role = session.role as UserRole;
  const canWrite = hasPermission(role, "pos:write");
  const canViewFinancials = canViewOperationalFinancialData(role);
  const prisma = getPrisma();
  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());
  const [orders, reservations, posItems] = await Promise.all([
    prisma.order.findMany({
      where: {
        reservation: { unit: { propertyId: session.propertyId } },
      },
      include: {
        items: true,
        reservation: {
          include: {
            guest: true,
            unit: true,
          },
        },
        guest: true,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.reservation.findMany({
      where: {
        unit: { propertyId: session.propertyId },
        status: {
          in: [
            ReservationStatus.CONFIRMED,
            ReservationStatus.CHECKED_IN,
          ],
        },
      },
      include: { guest: true, unit: true },
      orderBy: { checkInDate: "desc" },
      take: 80,
    }),
    prisma.posItem.findMany({
      where: { isActive: true },
      include: {
        orderItems: {
          where: {
            order: {
              createdAt: { gte: todayStart, lte: todayEnd },
              status: { not: OrderStatus.CANCELLED },
            },
          },
          select: { quantity: true },
        },
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
  ]);

  const openOrders = orders.filter((order) => order.status !== OrderStatus.COMPLETED && order.status !== OrderStatus.CANCELLED).length;
  const unpaidOrders = orders.filter((order) => order.paymentStatus !== PaymentStatus.PAID && order.paymentStatus !== PaymentStatus.REFUNDED).length;
  const revenue = orders
    .filter((order) => order.status !== OrderStatus.CANCELLED)
    .reduce((sum, order) => sum + Number(order.total), 0);
  const itemCount = orders.reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);
  const posItemAvailability = new Map(
    posItems.map((item) => {
      const soldToday = item.orderItems.reduce((sum, orderItem) => sum + orderItem.quantity, 0);
      const remaining = item.dailyCapacity === null ? null : Math.max(0, item.dailyCapacity - soldToday);

      return [
        item.id,
        {
          soldToday,
          remaining,
          canOrder: item.isAvailable && (remaining === null || remaining > 0),
        },
      ];
    }),
  );
  const orderableItemCount = posItems.filter((item) => posItemAvailability.get(item.id)?.canOrder).length;
  const cappedOutItemCount = posItems.filter((item) => {
    const availability = posItemAvailability.get(item.id);
    return item.isAvailable && availability?.remaining === 0;
  }).length;

  return (
    <AppShell>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-bold text-[#29f1ff]">F&B And Activities</p>
          <h2 className="mt-2 text-3xl font-black tracking-normal text-white">Orders</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/62">
            POS ringan untuk add-on, activity, transport, package, dan charge tambahan yang terhubung ke reservasi.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge label={`${orders.length} orders`} tone="info" dot />
          <StatusBadge label={`${orderableItemCount}/${posItems.length} orderable`} tone="success" dot />
          <StatusBadge label={`${cappedOutItemCount} capped out`} tone={cappedOutItemCount > 0 ? "warning" : "muted"} dot />
        </div>
      </div>

      <ActionFeedbackBanner feedback={feedback} />

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title={canViewFinancials ? "Order Revenue" : "Total Orders"} value={canViewFinancials ? formatIdr(revenue) : String(orders.length)} icon={<CreditCard className="size-5" />} tone="success" />
        <MetricCard title="Open Orders" value={String(openOrders)} icon={<ReceiptText className="size-5" />} tone="warning" />
        <MetricCard title={canViewFinancials ? "Unpaid Orders" : "Orderable Items"} value={canViewFinancials ? String(unpaidOrders) : String(orderableItemCount)} icon={<CreditCard className="size-5" />} tone="danger" />
        <MetricCard title="Items Sold" value={String(itemCount)} icon={<ShoppingBag className="size-5" />} tone="info" />
      </section>

      <section className="mt-6 grid gap-5 2xl:grid-cols-[minmax(0,1fr)_430px]">
        <GlassCard className="min-w-0 overflow-hidden p-0">
          <div className="border-b border-white/10 p-5">
            <h3 className="text-lg font-black text-white">Order Queue</h3>
            <p className="mt-1 text-sm font-semibold text-white/50">
              {canViewFinancials ? "Update status dapur/activity dan payment dari satu board." : "Pantau status dapur/activity dari satu board."}
            </p>
          </div>
          <div className="overflow-x-auto premium-scroll">
            <table className={`w-full border-separate border-spacing-y-2 p-4 text-left ${canViewFinancials ? "min-w-[1120px]" : "min-w-[880px]"}`}>
              <thead>
                <tr className="text-xs font-black uppercase tracking-normal text-white/42">
                  <th className="px-4 py-2">Order</th>
                  <th className="px-4 py-2">Guest</th>
                  <th className="px-4 py-2">Items</th>
                  <th className="px-4 py-2">Status</th>
                  {canViewFinancials ? <th className="px-4 py-2">Payment</th> : null}
                  {canViewFinancials ? <th className="px-4 py-2">Total</th> : null}
                  <th className="px-4 py-2">{canWrite ? "Update" : "Access"}</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const updateAction = updateOrderStatusAction.bind(null, order.id);

                  return (
                    <tr key={order.id} className="surface-row text-sm font-semibold text-white/76">
                      <td className="rounded-l-[20px] px-4 py-4">
                        <p className="font-mono text-sm font-black text-[#b8fbff]">{order.code}</p>
                        <p className="mt-1 text-xs text-white/45">{formatDateTimeId(order.createdAt)}</p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-black text-white">{order.reservation?.guest.fullName ?? order.guest?.fullName ?? "Tanpa guest"}</p>
                        <p className="mt-1 text-xs text-white/50">
                          {order.reservation?.bookingCode ?? "-"} · {order.reservation?.unit?.code ?? "No unit"}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="max-w-[300px] truncate text-white">{order.items.map((item) => `${item.quantity}x ${item.name}`).join(", ")}</p>
                        <p className="mt-1 text-xs text-white/50">{order.items.length} line items</p>
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge label={orderStatusLabels[order.status]} tone={orderStatusTone[order.status]} />
                      </td>
                      {canViewFinancials ? (
                        <td className="px-4 py-4">
                          <StatusBadge label={paymentStatusLabels[order.paymentStatus]} tone={paymentStatusTone[order.paymentStatus]} />
                        </td>
                      ) : null}
                      {canViewFinancials ? <td className="px-4 py-4 font-black text-white">{formatIdr(Number(order.total))}</td> : null}
                      <td className="rounded-r-[20px] px-4 py-4">
                        {canWrite ? (
                          <form action={updateAction} className={`grid gap-2 ${canViewFinancials ? "xl:grid-cols-[150px_140px_auto]" : "xl:grid-cols-[150px_auto]"}`}>
                            <select
                              name="status"
                              defaultValue={order.status}
                              className="min-h-10 rounded-[16px] surface-field px-3 text-xs font-bold text-white outline-none"
                            >
                              {orderStatusOrder.map((status) => (
                                <option key={status} value={status}>
                                  {orderStatusLabels[status]}
                                </option>
                              ))}
                            </select>
                            {canViewFinancials ? (
                              <select
                                name="paymentStatus"
                                defaultValue={order.paymentStatus}
                                className="min-h-10 rounded-[16px] surface-field px-3 text-xs font-bold text-white outline-none"
                              >
                                {paymentStatusOrder.map((status) => (
                                  <option key={status} value={status}>
                                    {paymentStatusLabels[status]}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input type="hidden" name="paymentStatus" value={order.paymentStatus} />
                            )}
                            <button className="min-h-10 rounded-[16px] surface-chip px-3 text-xs font-black text-white/76">
                              Save
                            </button>
                          </form>
                        ) : (
                          <span className="surface-chip inline-flex min-h-10 items-center rounded-[16px] px-3 text-xs font-black text-white/58">
                            Read-only
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {orders.length === 0 ? (
              <div className="m-5 rounded-[22px] surface-inset p-8 text-center text-sm font-semibold text-white/58">
                Belum ada order.
              </div>
            ) : null}
          </div>
        </GlassCard>

        <aside className="min-w-0 space-y-5">
          {canWrite ? (
            <GlassCard className="p-5">
              <div className="flex items-center gap-3">
                <div className="grid size-11 place-items-center rounded-[22px] bg-[#29f1ff]/14 text-[#b8fbff]">
                  <PackagePlus className="size-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">New Order</h3>
                  <p className="mt-1 text-xs font-semibold text-white/50">Charge item ke reservasi aktif</p>
                </div>
              </div>

              <form action={createOrderAction} className="mt-5 space-y-4">
                <SelectField name="reservationId" label="Reservation" required>
                  {reservations.map((reservation) => (
                    <option key={reservation.id} value={reservation.id}>
                      {reservation.bookingCode} - {reservation.guest.fullName} - {reservation.unit?.code ?? "No unit"}
                    </option>
                  ))}
                </SelectField>

                <div className="space-y-4">
                  {posCategoryOrder.map((category) => {
                    const items = posItems.filter((item) => item.category === category);

                    if (items.length === 0) {
                      return null;
                    }

                    return (
                      <div key={category} className="rounded-[22px] surface-inset p-3">
                        <p className="text-xs font-black uppercase tracking-normal text-white/42">{posCategoryLabels[category]}</p>
                        <div className="mt-3 space-y-2">
                          {items.map((item) => {
                            const availability = posItemAvailability.get(item.id);
                            const remaining = availability?.remaining ?? null;
                            const canOrderItem = availability?.canOrder ?? false;
                            const leadTimeLabel = item.leadTimeMinutes > 0 ? `${item.leadTimeMinutes} min lead` : "No lead";
                            const capacityLabel = remaining === null ? "Unlimited today" : `${remaining}/${item.dailyCapacity} left today`;
                            const availabilityLabel = !item.isAvailable ? "Sold out" : remaining === 0 ? "Quota full" : capacityLabel;

                            return (
                              <label key={item.id} className={`grid grid-cols-[52px_1fr_72px] items-center gap-3 rounded-[16px] surface-inset p-3 ${canOrderItem ? "" : "opacity-60"}`}>
                                <span className="relative size-12 overflow-hidden rounded-[14px] border border-white/10 bg-white/[0.04]">
                                  {item.photoUrl ? (
                                    <img src={item.photoUrl} alt={`${item.name} photo`} className="h-full w-full object-cover" loading="lazy" />
                                  ) : (
                                    <span className="grid h-full w-full place-items-center text-white/34">
                                      <ShoppingBag className="size-5" />
                                    </span>
                                  )}
                                </span>
                                <span>
                                  <span className="block text-sm font-black text-white">{item.name}</span>
                                  <span className="mt-1 block text-xs font-semibold text-[#b8fbff]">{formatIdr(Number(item.price))}</span>
                                  <span className="mt-2 flex flex-wrap gap-1.5">
                                    <StatusBadge label={item.slotLabel ?? "Anytime"} tone="muted" />
                                    <StatusBadge label={leadTimeLabel} tone="info" />
                                    <StatusBadge label={availabilityLabel} tone={canOrderItem ? "success" : "warning"} />
                                  </span>
                                </span>
                                <input
                                  name={`quantity_${item.id}`}
                                  type="number"
                                  min="0"
                                  max={remaining ?? undefined}
                                  defaultValue="0"
                                  disabled={!canOrderItem}
                                  className="min-h-10 rounded-[16px] surface-field px-3 text-center text-sm font-black text-white outline-none disabled:cursor-not-allowed disabled:opacity-45"
                                />
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <MoneyField name="discount" label="Discount" defaultValue="0" />
                  <MoneyField name="tax" label="Tax" defaultValue="0" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <SelectField name="status" label="Status" defaultValue={OrderStatus.OPEN}>
                    {orderStatusOrder.map((status) => (
                      <option key={status} value={status}>
                        {orderStatusLabels[status]}
                      </option>
                    ))}
                  </SelectField>
                  <SelectField name="paymentStatus" label="Payment" defaultValue={PaymentStatus.UNPAID}>
                    {paymentStatusOrder.map((status) => (
                      <option key={status} value={status}>
                        {paymentStatusLabels[status]}
                      </option>
                    ))}
                  </SelectField>
                </div>
                <TextareaField name="notes" label="Notes" placeholder="Kitchen, activity, or delivery notes" />
                <button className="gold-gradient min-h-11 w-full rounded-[22px] text-sm font-black text-[#041015]">
                  Create Order
                </button>
              </form>
            </GlassCard>
          ) : null}
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
      <p className="mt-2 text-3xl font-black text-white">{value}</p>
    </GlassCard>
  );
}

function MoneyField({
  label,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string }) {
  return (
    <label className={className}>
      <span className="mb-2 block text-xs font-black uppercase tracking-normal text-white/42">{label}</span>
      <CurrencyInput
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
