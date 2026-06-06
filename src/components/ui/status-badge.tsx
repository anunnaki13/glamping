import { cn } from "@/lib/utils";

export type StatusTone =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "muted"
  | "cyan"
  | "blue"
  | "violet"
  | "amber"
  | "orange"
  | "slate";

type StatusBadgeProps = {
  label: string;
  tone?: StatusTone;
  dot?: boolean;
  className?: string;
};

const toneClass: Record<StatusTone, string> = {
  success: "border-emerald-300/34 bg-emerald-400/14 text-emerald-100 shadow-[0_0_18px_rgba(104,211,145,0.12)]",
  warning: "border-amber-300/34 bg-amber-400/15 text-amber-100 shadow-[0_0_18px_rgba(246,185,75,0.11)]",
  danger: "border-red-300/34 bg-red-500/15 text-red-100 shadow-[0_0_18px_rgba(255,107,95,0.12)]",
  info: "border-sky-300/34 bg-sky-400/14 text-sky-100 shadow-[0_0_18px_rgba(79,184,255,0.11)]",
  muted: "border-white/14 bg-white/[0.075] text-white/68",
  cyan: "border-[#29f1ff]/36 bg-[#29f1ff]/14 text-[#b8fbff] shadow-[0_0_18px_rgba(41,241,255,0.11)]",
  blue: "border-blue-300/34 bg-blue-500/14 text-blue-100 shadow-[0_0_18px_rgba(79,184,255,0.1)]",
  violet: "border-violet-300/34 bg-violet-500/15 text-violet-100 shadow-[0_0_18px_rgba(169,137,255,0.12)]",
  amber: "border-yellow-300/34 bg-yellow-400/15 text-yellow-100 shadow-[0_0_18px_rgba(246,185,75,0.11)]",
  orange: "border-orange-300/34 bg-orange-500/15 text-orange-100 shadow-[0_0_18px_rgba(245,139,60,0.12)]",
  slate: "border-slate-300/20 bg-slate-400/10 text-slate-200",
};

const dotClass: Record<StatusTone, string> = {
  success: "bg-[#68d391]",
  warning: "bg-[#f6b94b]",
  danger: "bg-[#ff6b5f]",
  info: "bg-[#4fb8ff]",
  muted: "bg-white/50",
  cyan: "bg-[#29f1ff]",
  blue: "bg-[#4fb8ff]",
  violet: "bg-[#a989ff]",
  amber: "bg-[#f6b94b]",
  orange: "bg-[#f58b3c]",
  slate: "bg-slate-300",
};

export function StatusBadge({ label, tone = "muted", dot = false, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold leading-none",
        toneClass[tone],
        className,
      )}
    >
      {dot ? <span className={cn("size-1.5 rounded-full", dotClass[tone])} /> : null}
      {label}
    </span>
  );
}
