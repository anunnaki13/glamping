import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

type TrendBadgeProps = {
  value: string;
  direction?: "up" | "down" | "flat";
  label?: string;
};

export function TrendBadge({ value, direction = "flat", label = "vs kemarin" }: TrendBadgeProps) {
  const Icon = direction === "up" ? ArrowUp : direction === "down" ? ArrowDown : ArrowRight;

  return (
    <div
      className={cn(
        "flex items-center gap-1 text-sm font-semibold",
        direction === "down" ? "text-[#ff8f86]" : direction === "up" ? "text-[#68d391]" : "text-white/58",
      )}
    >
      <Icon className="size-4" />
      <span>{value}</span>
      <span className="font-medium text-white/58">{label}</span>
    </div>
  );
}
