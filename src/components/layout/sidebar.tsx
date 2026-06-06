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
  ConciergeBell,
  Home,
  MessageCircle,
  PackageOpen,
  ShoppingBag,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";
import { BrandLockup } from "@/components/brand/brand-lockup";
import type { UserRole } from "@/generated/prisma/enums";
import { hasPermission, type Permission } from "@/lib/permissions";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  permission: Permission;
  group: "Overview" | "Operations" | "Insights & System";
  matchPrefixes?: string[];
};

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: Home, permission: "dashboard:read", group: "Overview" },
  { label: "Reservasi", href: "/reservations", icon: ClipboardList, permission: "reservation:read", group: "Overview", matchPrefixes: ["/reservations", "/check-in", "/check-out"] },
  { label: "Calendar", href: "/calendar", icon: CalendarDays, permission: "reservation:read", group: "Overview" },
  { label: "Unit", href: "/units", icon: BedDouble, permission: "unit:read", group: "Overview" },
  { label: "Guests", href: "/guests", icon: Users, permission: "guest:read", group: "Operations" },
  { label: "Messages", href: "/messages", icon: MessageCircle, permission: "message:read", group: "Operations" },
  { label: "Housekeeping", href: "/housekeeping", icon: Sparkles, permission: "housekeeping:read", group: "Operations" },
  { label: "Services", href: "/service-requests", icon: ConciergeBell, permission: "request:read", group: "Operations" },
  { label: "Catalog", href: "/catalog", icon: PackageOpen, permission: "pos:read", group: "Insights & System" },
  { label: "Orders", href: "/orders", icon: ShoppingBag, permission: "pos:read", group: "Insights & System" },
  { label: "Reports", href: "/reports", icon: BarChart3, permission: "report:read", group: "Insights & System" },
  { label: "AI Prep", href: "/ai", icon: BrainCircuit, permission: "ai:read", group: "Insights & System" },
  { label: "Activity", href: "/activity", icon: Activity, permission: "activity:read", group: "Insights & System" },
  { label: "Settings", href: "/settings", icon: Settings, permission: "settings:read", group: "Insights & System" },
];

const navGroups: NavItem["group"][] = ["Overview", "Operations", "Insights & System"];

const roleLabels: Record<UserRole, string> = {
  OWNER: "Owner Access",
  MANAGER: "Manager Access",
  FRONT_OFFICE: "Front Office",
  HOUSEKEEPING: "Housekeeping",
  FNB_ACTIVITY: "F&B / Activity",
  VIEWER: "Viewer",
};

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U";
}

function isActive(pathname: string, item: NavItem) {
  const prefixes = item.matchPrefixes ?? [item.href];
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function Sidebar({ name, role }: { name: string; role: UserRole }) {
  const pathname = usePathname();
  const visibleItems = navItems.filter((item) => hasPermission(role, item.permission));

  return (
    <aside className="hidden w-[244px] shrink-0 border-r border-white/10 bg-[linear-gradient(180deg,rgba(11,17,27,0.88),rgba(6,10,17,0.72))] p-4 backdrop-blur-2xl lg:flex lg:flex-col">
      <BrandLockup className="mt-5 px-2" />

      <nav className="premium-scroll mt-9 flex flex-1 flex-col gap-7 overflow-y-auto pr-1">
        {navGroups.map((group) => {
          const groupItems = visibleItems.filter((item) => item.group === group);

          if (groupItems.length === 0) {
            return null;
          }

          return (
            <div key={group}>
              <p className="mb-3 px-4 text-[10px] font-black uppercase tracking-normal text-white/30">{group}</p>
              <div className="space-y-2">
                {groupItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(pathname, item);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "group relative flex min-h-[48px] items-center gap-3 overflow-hidden rounded-[19px] border px-3.5 text-sm font-semibold transition duration-200",
                        active
                          ? "border-[#29f1ff]/22 bg-[linear-gradient(90deg,rgba(41,241,255,0.18),rgba(255,255,255,0.055))] text-[#dffefa] shadow-[0_0_32px_rgba(41,241,255,0.14)] before:absolute before:left-0 before:top-1/2 before:h-7 before:w-1 before:-translate-y-1/2 before:rounded-full before:bg-[#29f1ff] before:shadow-[0_0_18px_rgba(41,241,255,0.8)]"
                          : "border-transparent text-white/58 hover:border-white/10 hover:bg-white/[0.055] hover:text-white",
                      )}
                    >
                      <Icon className={cn("size-[18px]", active ? "text-[#29f1ff]" : "text-white/48 group-hover:text-white/78")} />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="mt-5 rounded-[24px] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.09),rgba(255,255,255,0.025))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.10)]">
        <div className="flex items-center gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-[18px] border border-[#29f1ff]/18 bg-[#29f1ff]/10 text-[#b8fbff]">
            <span className="text-sm font-black">{initials(name)}</span>
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">{name}</p>
            <p className="mt-1 truncate text-[11px] font-semibold text-[#29f1ff]">{roleLabels[role]}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
