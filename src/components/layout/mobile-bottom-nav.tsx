"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  BedDouble,
  BrainCircuit,
  CalendarDays,
  ClipboardList,
  CreditCard,
  Home,
  MessageCircle,
  PackageOpen,
  Settings,
  ShoppingBag,
  Sparkles,
  Users,
  Wrench,
} from "lucide-react";
import type { UserRole } from "@/generated/prisma/enums";
import { hasPermission, type Permission } from "@/lib/permissions";
import { cn } from "@/lib/utils";

type MobileNavItem = {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  permission: Permission;
  matchPrefixes?: string[];
};

const items: MobileNavItem[] = [
  { label: "Home", href: "/dashboard", icon: Home, permission: "dashboard:read" },
  { label: "Reservasi", href: "/reservations", icon: ClipboardList, permission: "reservation:read", matchPrefixes: ["/reservations", "/check-in", "/check-out"] },
  { label: "Calendar", href: "/calendar", icon: CalendarDays, permission: "reservation:read" },
  { label: "Units", href: "/units", icon: BedDouble, permission: "unit:read" },
  { label: "Guests", href: "/guests", icon: Users, permission: "guest:read" },
  { label: "Messages", href: "/messages", icon: MessageCircle, permission: "message:read" },
  { label: "HK", href: "/housekeeping", icon: Sparkles, permission: "housekeeping:read" },
  { label: "Requests", href: "/service-requests", icon: Wrench, permission: "request:read" },
  { label: "Catalog", href: "/catalog", icon: PackageOpen, permission: "pos:read" },
  { label: "Orders", href: "/orders", icon: ShoppingBag, permission: "pos:read" },
  { label: "Payments", href: "/payments", icon: CreditCard, permission: "payment:read" },
  { label: "Reports", href: "/reports", icon: BarChart3, permission: "report:read" },
  { label: "AI", href: "/ai", icon: BrainCircuit, permission: "ai:read" },
  { label: "Activity", href: "/activity", icon: Activity, permission: "activity:read" },
  { label: "Settings", href: "/settings", icon: Settings, permission: "settings:read" },
];

function isActive(pathname: string, item: MobileNavItem) {
  const prefixes = item.matchPrefixes ?? [item.href];
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function MobileBottomNav({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const visibleItems = items.filter((item) => hasPermission(role, item.permission));
  const activeIndex = visibleItems.findIndex((item) => isActive(pathname, item));
  const orderedItems = activeIndex > 4
    ? [visibleItems[activeIndex], ...visibleItems.filter((_, index) => index !== activeIndex)]
    : visibleItems;

  return (
    <nav
      aria-label="Mobile primary navigation"
      className="fixed inset-x-3 bottom-3 z-40 rounded-[var(--radius-shell)] border border-white/12 bg-[rgba(8,18,27,0.92)] p-2 shadow-[0_18px_50px_rgba(0,0,0,0.35)] backdrop-blur-2xl lg:hidden"
    >
      <div className="premium-scroll flex gap-1 overflow-x-auto">
        {orderedItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-w-[72px] flex-col items-center justify-center gap-1 rounded-[var(--radius-input)] px-2 py-2 text-[11px] font-bold transition",
                active ? "bg-[#29f1ff]/14 text-[#b8fbff]" : "text-white/58 hover:bg-white/[0.055] hover:text-white",
              )}
            >
              <Icon className="size-5" />
              <span className="whitespace-nowrap">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
