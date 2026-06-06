"use server";

import { endOfDay, format, startOfDay } from "date-fns";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  OrderStatus,
  PaymentStatus,
} from "@/generated/prisma/enums";
import { activityActor, requirePermission } from "@/lib/action-guard";
import { redirectWithActionError, redirectWithActionSuccess } from "@/lib/action-feedback";
import { getPrisma } from "@/lib/prisma";

const orderStatusValues = [
  OrderStatus.OPEN,
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.DELIVERED,
  OrderStatus.COMPLETED,
  OrderStatus.CANCELLED,
] as const;

const paymentStatusValues = [
  PaymentStatus.UNPAID,
  PaymentStatus.PARTIAL,
  PaymentStatus.PAID,
  PaymentStatus.REFUNDED,
] as const;

const createOrderSchema = z.object({
  reservationId: z.string().min(1),
  status: z.enum(orderStatusValues).default(OrderStatus.OPEN),
  paymentStatus: z.enum(paymentStatusValues).default(PaymentStatus.UNPAID),
  discount: z.coerce.number().min(0).default(0),
  tax: z.coerce.number().min(0).default(0),
  notes: z.string().trim().optional(),
});

const orderUpdateSchema = z.object({
  status: z.enum(orderStatusValues),
  paymentStatus: z.enum(paymentStatusValues),
});

function formDataObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

async function createOrderCode() {
  const prisma = getPrisma();
  const prefix = `ORD-${format(new Date(), "yyMMdd")}`;
  const count = await prisma.order.count({
    where: { code: { startsWith: prefix } },
  });

  return `${prefix}-${String(count + 1).padStart(4, "0")}`;
}

function revalidateOrderSurfaces(orderId?: string, reservationId?: string | null) {
  revalidatePath("/orders");
  revalidatePath("/dashboard");
  revalidatePath("/reservations");

  if (orderId) {
    revalidatePath(`/orders/${orderId}`);
  }

  if (reservationId) {
    revalidatePath(`/reservations/${reservationId}`);
  }
}

export async function createOrderAction(formData: FormData) {
  const session = await requirePermission("pos:write");
  const parsedPayload = createOrderSchema.safeParse(formDataObject(formData));

  if (!parsedPayload.success) {
    redirectWithActionError("/orders", parsedPayload.error);
  }

  const parsed = parsedPayload.data;
  const prisma = getPrisma();
  const reservation = await prisma.reservation.findFirst({
    where: {
      id: parsed.reservationId,
      unit: { propertyId: session.propertyId },
    },
    include: { guest: true },
  });

  if (!reservation) {
    redirectWithActionError("/orders", "Reservasi tidak ditemukan.");
  }

  const posItems = await prisma.posItem.findMany({
    where: { isActive: true, isAvailable: true },
    orderBy: { name: "asc" },
  });

  const selectedItems = posItems
    .map((item) => {
      const quantity = Number(formData.get(`quantity_${item.id}`) ?? 0);
      const safeQuantity = Number.isFinite(quantity) ? Math.max(0, Math.floor(quantity)) : 0;
      const price = Number(item.price);

      return {
        item,
        quantity: safeQuantity,
        price,
        total: price * safeQuantity,
      };
    })
    .filter((line) => line.quantity > 0);

  if (selectedItems.length === 0) {
    redirectWithActionError("/orders", "Pilih minimal satu item POS.");
  }

  const cappedItems = selectedItems.filter((line) => line.item.dailyCapacity !== null);

  if (cappedItems.length > 0) {
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());
    const itemIds = cappedItems.map((line) => line.item.id);
    const soldToday = await prisma.orderItem.groupBy({
      by: ["itemId"],
      where: {
        itemId: { in: itemIds },
        order: {
          createdAt: { gte: todayStart, lte: todayEnd },
          status: { not: OrderStatus.CANCELLED },
        },
      },
      _sum: { quantity: true },
    });
    const soldTodayByItemId = new Map(soldToday.map((row) => [row.itemId, row._sum.quantity ?? 0]));

    for (const line of cappedItems) {
      const capacity = line.item.dailyCapacity;

      if (capacity === null) {
        continue;
      }

      const remaining = Math.max(0, capacity - (soldTodayByItemId.get(line.item.id) ?? 0));

      if (line.quantity > remaining) {
        redirectWithActionError("/orders", `${line.item.name} melewati kuota hari ini. Sisa kuota: ${remaining}.`);
      }
    }
  }

  const subtotal = selectedItems.reduce((sum, line) => sum + line.total, 0);
  const total = Math.max(0, subtotal - parsed.discount + parsed.tax);

  const order = await prisma.order.create({
    data: {
      code: await createOrderCode(),
      reservationId: reservation.id,
      guestId: reservation.guestId,
      status: parsed.status,
      paymentStatus: parsed.paymentStatus,
      subtotal: String(subtotal),
      discount: String(parsed.discount),
      tax: String(parsed.tax),
      total: String(total),
      notes: parsed.notes || null,
      items: {
        create: selectedItems.map((line) => ({
          itemId: line.item.id,
          name: line.item.name,
          quantity: line.quantity,
          price: String(line.price),
          total: String(line.total),
        })),
      },
    },
  });

  await prisma.activityLog.create({
    data: {
      ...activityActor(session),
      action: "order.created",
      entityType: "Order",
      entityId: order.id,
      description: `${session.name} created order ${order.code} for ${reservation.guest.fullName}.`,
    },
  });

  revalidateOrderSurfaces(order.id, reservation.id);
  redirectWithActionSuccess("/orders", `Order ${order.code} berhasil dibuat.`);
}

export async function updateOrderStatusAction(orderId: string, formData: FormData) {
  const session = await requirePermission("pos:write");
  const parsedPayload = orderUpdateSchema.safeParse(formDataObject(formData));

  if (!parsedPayload.success) {
    redirectWithActionError("/orders", parsedPayload.error);
  }

  const parsed = parsedPayload.data;
  const prisma = getPrisma();
  const existing = await prisma.order.findFirst({
    where: {
      id: orderId,
      reservation: { unit: { propertyId: session.propertyId } },
    },
  });

  if (!existing) {
    redirectWithActionError("/orders", "Order tidak ditemukan.");
  }

  const order = await prisma.order.update({
    where: { id: orderId },
    data: {
      status: parsed.status,
      paymentStatus: parsed.paymentStatus,
    },
  });

  await prisma.activityLog.create({
    data: {
      ...activityActor(session),
      action: "order.updated",
      entityType: "Order",
      entityId: order.id,
      description: `${session.name} updated order ${order.code}.`,
    },
  });

  revalidateOrderSurfaces(order.id, order.reservationId);
  redirectWithActionSuccess("/orders", `Order ${order.code} berhasil diperbarui.`);
}
