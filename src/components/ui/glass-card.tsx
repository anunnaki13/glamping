import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type GlassCardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "strong" | "compact" | "hero" | "soft" | "muted" | "shell";
};

const variants = {
  default: "glass-surface rounded-[var(--radius-panel)]",
  strong: "glass-surface-strong rounded-[var(--radius-panel)] panel-ring",
  compact: "glass-surface-soft rounded-[var(--radius-metric)]",
  hero: "glass-surface-strong rounded-[var(--radius-shell)] panel-ring",
  soft: "glass-surface-soft rounded-[var(--radius-panel)]",
  muted: "glass-surface-muted rounded-[var(--radius-panel)]",
  shell: "glass-surface-strong rounded-[var(--radius-shell)]",
};

export function GlassCard({ className, variant = "default", ...props }: GlassCardProps) {
  return <div className={cn(variants[variant], className)} {...props} />;
}
