import type { LucideIcon } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { TrendBadge } from "@/components/ui/trend-badge";
import { cn } from "@/lib/utils";

type StatCardProps = {
  title: string;
  value: string;
  description?: string;
  trend?: { value: string; direction: "up" | "down" | "flat" };
  icon: LucideIcon;
  tone?: "forest" | "gold" | "sage" | "blue" | "violet" | "cyan" | "teal" | "amber" | "green";
  className?: string;
};

const toneConfig = {
  forest: {
    color: "#29f1ff",
    className: "border-[#29f1ff]/24 bg-[#29f1ff]/12 text-[#b8fbff]",
    glow: "from-[#29f1ff]/18 via-transparent to-transparent",
  },
  gold: {
    color: "#f6b94b",
    className: "border-[#f6b94b]/24 bg-[#f6b94b]/12 text-[#ffe0a3]",
    glow: "from-[#f6b94b]/18 via-transparent to-transparent",
  },
  sage: {
    color: "#68d391",
    className: "border-[#68d391]/24 bg-[#68d391]/12 text-[#b9f6ca]",
    glow: "from-[#68d391]/16 via-transparent to-transparent",
  },
  blue: {
    color: "#4fb8ff",
    className: "border-[#4fb8ff]/24 bg-[#4fb8ff]/12 text-[#bfe5ff]",
    glow: "from-[#4fb8ff]/18 via-transparent to-transparent",
  },
  violet: {
    color: "#a989ff",
    className: "border-[#a989ff]/24 bg-[#a989ff]/12 text-[#d8cbff]",
    glow: "from-[#a989ff]/18 via-transparent to-transparent",
  },
  cyan: {
    color: "#29f1ff",
    className: "border-[#29f1ff]/24 bg-[#29f1ff]/12 text-[#b8fbff]",
    glow: "from-[#29f1ff]/18 via-transparent to-transparent",
  },
  teal: {
    color: "#1fb7ff",
    className: "border-[#1fb7ff]/24 bg-[#1fb7ff]/12 text-[#b8fbff]",
    glow: "from-[#1fb7ff]/18 via-transparent to-transparent",
  },
  amber: {
    color: "#f6b94b",
    className: "border-[#f6b94b]/24 bg-[#f6b94b]/12 text-[#ffe0a3]",
    glow: "from-[#f6b94b]/18 via-transparent to-transparent",
  },
  green: {
    color: "#68d391",
    className: "border-[#68d391]/24 bg-[#68d391]/12 text-[#b9f6ca]",
    glow: "from-[#68d391]/16 via-transparent to-transparent",
  },
};

export function StatCard({
  title,
  value,
  description,
  trend,
  icon: Icon,
  tone = "forest",
  className,
}: StatCardProps) {
  const toneStyle = toneConfig[tone];

  return (
    <GlassCard
      variant="compact"
      className={cn("group relative min-h-[148px] overflow-hidden p-5 transition duration-200 hover:-translate-y-1", className)}
    >
      <div className={cn("absolute inset-0 bg-gradient-to-br opacity-100", toneStyle.glow)} />
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-white/58">{title}</p>
          <p className="mt-4 text-[clamp(1.8rem,2.2vw,2.34rem)] font-semibold leading-none tracking-normal text-white">
            {value}
          </p>
          {trend ? (
            <div className="mt-3">
              <TrendBadge value={trend.value} direction={trend.direction} />
            </div>
          ) : null}
          {description ? <p className="mt-3 text-xs font-semibold text-white/48">{description}</p> : null}
        </div>
        <div
          className={cn(
            "grid size-12 shrink-0 place-items-center rounded-full border shadow-[0_0_28px_rgba(0,0,0,0.28)]",
            toneStyle.className,
          )}
        >
          <Icon className="size-[22px]" strokeWidth={1.8} />
        </div>
      </div>
    </GlassCard>
  );
}
