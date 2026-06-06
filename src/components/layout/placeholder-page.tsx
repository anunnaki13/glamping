import type { LucideIcon } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/ui/empty-state";

type PlaceholderPageProps = {
  title: string;
  description: string;
  icon: LucideIcon;
};

export function PlaceholderPage({ title, description, icon }: PlaceholderPageProps) {
  return (
    <AppShell>
      <EmptyState title={title} description={description} icon={icon} />
    </AppShell>
  );
}
