import { AlertTriangle } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";

type ErrorStateProps = {
  title?: string;
  description?: string;
};

export function ErrorState({
  title = "Data belum dapat dimuat",
  description = "Coba muat ulang beberapa saat lagi.",
}: ErrorStateProps) {
  return (
    <GlassCard className="border-red-300/20 bg-red-950/20 p-5">
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-[22px] bg-red-400/15 text-red-100">
          <AlertTriangle className="size-5" />
        </div>
        <div>
          <h3 className="font-bold text-white">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-white/62">{description}</p>
        </div>
      </div>
    </GlassCard>
  );
}
