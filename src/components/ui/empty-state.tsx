import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";

type EmptyStateProps = {
  title: string;
  description: string;
  icon?: LucideIcon;
};

export function EmptyState({ title, description, icon: Icon = Inbox }: EmptyStateProps) {
  return (
    <GlassCard className="grid min-h-48 place-items-center p-8 text-center">
      <div>
        <div className="mx-auto grid size-12 place-items-center rounded-[var(--radius-input)] border border-[#29f1ff]/20 bg-[#29f1ff]/10 text-[#b8fbff]">
          <Icon className="size-6" />
        </div>
        <h3 className="mt-4 text-base font-bold text-white">{title}</h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/62">{description}</p>
      </div>
    </GlassCard>
  );
}
