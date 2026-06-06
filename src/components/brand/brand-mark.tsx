import { Leaf, TentTree } from "lucide-react";
import { cn } from "@/lib/utils";

type BrandMarkProps = {
  className?: string;
};

export function BrandMark({ className }: BrandMarkProps) {
  return (
    <div
      className={cn(
        "relative grid size-12 place-items-center rounded-[18px] border border-[#29f1ff]/30 bg-[#29f1ff]/10 text-[#b8fbff] shadow-[0_0_28px_rgba(41,241,255,0.14)]",
        className,
      )}
      aria-hidden="true"
    >
      <TentTree className="size-7" strokeWidth={1.65} />
      <Leaf className="absolute right-1.5 top-1.5 size-3.5 text-[#4fb8ff]" strokeWidth={1.8} />
    </div>
  );
}
