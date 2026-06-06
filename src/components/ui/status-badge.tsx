import { cn } from "@/lib/utils";

type StatusTone = "success" | "warning" | "danger" | "info" | "muted";

type StatusBadgeProps = {
  label: string;
  tone?: StatusTone;
  dot?: boolean;
  className?: string;
};

const toneClass: Record<StatusTone, string> = {
  success: "border-[#68d391]/28 bg-[#68d391]/12 text-[#b9f6ca]",
  warning: "border-[#f6b94b]/28 bg-[#f6b94b]/13 text-[#ffe0a3]",
  danger: "border-[#ff6b5f]/28 bg-[#ff6b5f]/13 text-[#ffb6ae]",
  info: "border-[#29f1ff]/28 bg-[#29f1ff]/12 text-[#b8fbff]",
  muted: "border-white/12 bg-white/[0.07] text-white/68",
};

const dotClass: Record<StatusTone, string> = {
  success: "bg-[#68d391]",
  warning: "bg-[#f6b94b]",
  danger: "bg-[#ff6b5f]",
  info: "bg-[#29f1ff]",
  muted: "bg-white/50",
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
