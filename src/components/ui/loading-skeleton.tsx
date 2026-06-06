import { cn } from "@/lib/utils";

type LoadingSkeletonProps = {
  className?: string;
};

export function LoadingSkeleton({ className }: LoadingSkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-[var(--radius-panel)] border border-white/8 bg-white/[0.07] shadow-inner shadow-white/5",
        className,
      )}
    />
  );
}
