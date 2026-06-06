import { BrandMark } from "@/components/brand/brand-mark";
import { cn } from "@/lib/utils";

type BrandLockupProps = {
  compact?: boolean;
  className?: string;
};

export function BrandLockup({ compact = false, className }: BrandLockupProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <BrandMark className={compact ? "size-11 rounded-[22px]" : undefined} />
      {!compact ? (
        <div className="leading-none">
          <p className="text-[17px] font-semibold tracking-[0.18em] text-[#f5f7fa]">NUSA ESCAPE</p>
          <p className="mt-2 text-[10px] font-bold tracking-[0.22em] text-[#29f1ff]">
            SMART GLAMPING OS
          </p>
        </div>
      ) : null}
    </div>
  );
}
