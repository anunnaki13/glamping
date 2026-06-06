import Link from "next/link";
import { Mail, MessageCircle, Plus, Search, Users } from "lucide-react";
import { UserRole } from "@/generated/prisma/enums";
import { AppShell } from "@/components/layout/app-shell";
import { ActionFeedbackBanner } from "@/components/ui/action-feedback-banner";
import { GlassCard } from "@/components/ui/glass-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { getActionFeedback, type ActionFeedbackSearchParams } from "@/lib/action-feedback";
import { requirePagePermission } from "@/lib/action-guard";
import { formatDateId, formatIdr } from "@/lib/formatters";
import { humanizeGuestType, maskContact, maskSensitive } from "@/lib/labels";
import {
  canViewGuestContactData,
  canViewStayFinancialData,
  hasPermission,
} from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type GuestsPageProps = {
  searchParams: Promise<{ q?: string } & ActionFeedbackSearchParams>;
};

export default async function GuestsPage({ searchParams }: GuestsPageProps) {
  const session = await requirePagePermission("guest:read");
  const params = await searchParams;
  const feedback = getActionFeedback(params);
  const role = session.role as UserRole;
  const canAccessSensitive = hasPermission(role, "guest:sensitive");
  const canViewGuestContact = canViewGuestContactData(role);
  const canViewFinancials = canViewStayFinancialData(role);
  const { q } = params;
  const query = q?.trim();
  const prisma = getPrisma();

  const guests = await prisma.guest.findMany({
    where: query
      ? {
          OR: [
            { fullName: { contains: query, mode: "insensitive" } },
            ...(canViewGuestContact
              ? [
                  { email: { contains: query, mode: "insensitive" as const } },
                  { phone: { contains: query, mode: "insensitive" as const } },
                ]
              : []),
            { country: { contains: query, mode: "insensitive" } },
          ],
        }
      : undefined,
    include: {
      reservations: {
        orderBy: { checkInDate: "desc" },
        take: 1,
        include: { unit: true },
      },
      orders: true,
      _count: {
        select: {
          reservations: true,
          serviceRequests: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  const totalLifetimeSpend = guests.reduce((sum, guest) => {
    const orderTotal = guest.orders.reduce((orderSum, order) => orderSum + Number(order.total), 0);
    return sum + orderTotal;
  }, 0);

  return (
    <AppShell>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-bold text-[#29f1ff]">Master Data</p>
          <h2 className="mt-2 text-3xl font-black tracking-normal text-white">Guest CRM</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/62">
            Simpan riwayat tamu, preferensi, kontak, dan nilai hubungan pelanggan untuk service yang lebih personal.
          </p>
        </div>
        {canAccessSensitive ? (
          <Link
            href="/guests/new"
            className="gold-gradient inline-flex min-h-11 items-center justify-center gap-2 rounded-[22px] px-4 text-sm font-black text-[#041015]"
          >
            <Plus className="size-5" />
            Tambah Guest
          </Link>
        ) : null}
      </div>

      <ActionFeedbackBanner feedback={feedback} />

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <GlassCard variant="compact" className="p-5">
          <p className="text-sm font-bold text-white/60">Guest Profiles</p>
          <p className="mt-3 text-3xl font-black text-white">{guests.length}</p>
          <p className="mt-2 text-sm font-medium text-white/56">Ditampilkan dari database CRM.</p>
        </GlassCard>
        <GlassCard variant="compact" className="p-5">
          <p className="text-sm font-bold text-white/60">Total Visits</p>
          <p className="mt-3 text-3xl font-black text-white">{guests.reduce((sum, guest) => sum + guest._count.reservations, 0)}</p>
          <p className="mt-2 text-sm font-medium text-white/56">Berdasarkan reservation history.</p>
        </GlassCard>
        <GlassCard variant="compact" className="p-5">
          <p className="text-sm font-bold text-white/60">{canViewFinancials ? "Order Spend" : "Service Requests"}</p>
          <p className="mt-3 text-3xl font-black text-white">
            {canViewFinancials ? formatIdr(totalLifetimeSpend) : guests.reduce((sum, guest) => sum + guest._count.serviceRequests, 0)}
          </p>
          <p className="mt-2 text-sm font-medium text-white/56">{canViewFinancials ? "Dari POS orders yang tercatat." : "Request history yang terkait guest."}</p>
        </GlassCard>
      </section>

      <GlassCard variant="strong" className="mt-6 p-5">
        <form className="flex flex-col gap-3 md:flex-row">
          <label className="surface-field flex min-h-12 flex-1 items-center gap-3 rounded-[22px] px-4">
            <Search className="size-5 text-[#29f1ff]" />
            <input
              name="q"
              defaultValue={query}
              placeholder={canViewGuestContact ? "Search by guest, phone, email, country..." : "Search by guest or country..."}
              className="w-full bg-transparent text-sm font-semibold text-white outline-none placeholder:text-white/36"
            />
          </label>
          <button className="min-h-12 rounded-[22px] border border-[#29f1ff]/24 bg-[#29f1ff]/10 px-5 text-sm font-black text-[#b8fbff]">
            Filter
          </button>
          {query ? (
            <Link className="inline-flex min-h-12 items-center justify-center rounded-[22px] border border-white/10 px-5 text-sm font-black text-white/70" href="/guests">
              Reset
            </Link>
          ) : null}
        </form>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[920px] border-separate border-spacing-y-2 text-left">
            <thead>
              <tr className="text-xs font-black uppercase tracking-normal text-white/42">
                <th className="px-4 py-2">Guest</th>
                <th className="px-4 py-2">Contact</th>
                <th className="px-4 py-2">Country</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Visits</th>
                <th className="px-4 py-2">Last Stay</th>
                <th className="px-4 py-2">ID</th>
                <th className="px-4 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {guests.map((guest) => {
                const lastStay = guest.reservations[0];
                return (
                  <tr key={guest.id} className="surface-row rounded-[22px] text-sm font-semibold text-white/76">
                    <td className="rounded-l-[20px] px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="grid size-11 place-items-center rounded-[22px] bg-[#29f1ff]/14 text-[#b8fbff]">
                          <Users className="size-5" />
                        </div>
                        <div>
                          <Link href={`/guests/${guest.id}`} className="font-black text-white hover:text-[#b8fbff]">
                            {guest.fullName}
                          </Link>
                          <p className="mt-1 text-xs text-white/48">Updated {formatDateId(guest.updatedAt)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <p className="flex items-center gap-2"><MessageCircle className="size-4 text-[#29f1ff]" /> {canViewGuestContact ? guest.phone ?? "-" : maskContact(guest.phone)}</p>
                      <p className="mt-1 flex items-center gap-2 text-xs text-white/50"><Mail className="size-3.5" /> {canViewGuestContact ? guest.email ?? "-" : maskContact(guest.email)}</p>
                    </td>
                    <td className="px-4 py-4">{guest.country ?? "-"}</td>
                    <td className="px-4 py-4">
                      <StatusBadge label={humanizeGuestType(guest.guestType)} tone={guest.guestType === "VIP" ? "warning" : "info"} />
                    </td>
                    <td className="px-4 py-4">{guest._count.reservations}</td>
                    <td className="px-4 py-4">{lastStay ? `${lastStay.unit?.code ?? "-"} · ${formatDateId(lastStay.checkInDate)}` : "-"}</td>
                    <td className="px-4 py-4">{maskSensitive(guest.idNumber)}</td>
                    <td className="rounded-r-[20px] px-4 py-4">
                      <Link className="font-black text-[#b8fbff]" href={`/guests/${guest.id}`}>
                        Detail
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {guests.length === 0 ? (
            <div className="surface-inset rounded-[22px] p-8 text-center text-sm font-semibold text-white/58">
              Tidak ada guest yang cocok dengan filter.
            </div>
          ) : null}
        </div>
      </GlassCard>
    </AppShell>
  );
}
