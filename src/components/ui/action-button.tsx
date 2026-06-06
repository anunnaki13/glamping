import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

const variants = {
  primary:
    "gold-gradient text-[#041015] shadow-[0_16px_34px_rgba(41,241,255,0.18)] hover:brightness-110",
  secondary:
    "border border-white/12 bg-white/[0.07] text-white hover:border-[#29f1ff]/42 hover:bg-[#29f1ff]/10",
  ghost: "text-white/72 hover:bg-white/[0.07] hover:text-white",
};

export function ActionButton({ className, variant = "secondary", ...props }: ActionButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-button)] px-4 text-sm font-bold transition duration-200 disabled:pointer-events-none disabled:opacity-45",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
