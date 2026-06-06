import type { ReactNode } from "react";
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  FileText,
  Gauge,
  KeyRound,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { AiPromptScope, UserRole } from "@/generated/prisma/enums";
import {
  updateAiConfigurationAction,
  updateAiPromptTemplateAction,
} from "@/app/ai/actions";
import { AppShell } from "@/components/layout/app-shell";
import { ActionFeedbackBanner } from "@/components/ui/action-feedback-banner";
import { GlassCard } from "@/components/ui/glass-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { getActionFeedback, type ActionFeedbackSearchParams } from "@/lib/action-feedback";
import { requirePagePermission } from "@/lib/action-guard";
import {
  aiPromptScopeLabels,
  defaultAiPrompts,
  getOpenRouterEnvDefaults,
  hasOpenRouterApiKey,
} from "@/lib/ai-config";
import { formatDateTimeId } from "@/lib/formatters";
import { buildOpenRouterChatPayload } from "@/lib/openrouter";
import { hasPermission } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const promptScopeOrder = [
  AiPromptScope.SYSTEM_GUARDRAILS,
  AiPromptScope.AI_CONCIERGE,
  AiPromptScope.MESSAGE_DRAFT,
  AiPromptScope.OPERATIONS_SUMMARY,
  AiPromptScope.REPORT_INSIGHTS,
];

type AiPageProps = {
  searchParams: Promise<ActionFeedbackSearchParams>;
};

export default async function AiPage({ searchParams }: AiPageProps) {
  const session = await requirePagePermission("ai:read");
  const feedback = getActionFeedback(await searchParams);
  const canWrite = hasPermission(session.role as UserRole, "ai:write");
  const prisma = getPrisma();
  const [property, savedConfig, savedPrompts, recentActivity] = await Promise.all([
    prisma.property.findUniqueOrThrow({ where: { id: session.propertyId } }),
    prisma.aiConfiguration.findUnique({ where: { propertyId: session.propertyId } }),
    prisma.aiPromptTemplate.findMany({
      where: { propertyId: session.propertyId },
      orderBy: { scope: "asc" },
    }),
    prisma.activityLog.findMany({
      where: {
        action: { in: ["ai_configuration.updated", "ai_prompt.updated"] },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  const envDefaults = getOpenRouterEnvDefaults();
  const apiKeyConfigured = hasOpenRouterApiKey();
  const config = {
    isEnabled: savedConfig?.isEnabled ?? envDefaults.enabled,
    primaryModel: savedConfig?.primaryModel ?? envDefaults.primaryModel,
    fallbackModel: savedConfig?.fallbackModel ?? envDefaults.fallbackModel,
    temperature: savedConfig?.temperature ?? 0.3,
    maxTokens: savedConfig?.maxTokens ?? 800,
    conciergeEnabled: savedConfig?.conciergeEnabled ?? false,
    messageDraftEnabled: savedConfig?.messageDraftEnabled ?? false,
    operationsInsightEnabled: savedConfig?.operationsInsightEnabled ?? false,
    reportInsightEnabled: savedConfig?.reportInsightEnabled ?? false,
    autonomousActions: false,
  };
  const promptByScope = new Map(savedPrompts.map((prompt) => [prompt.scope, prompt]));
  const prompts = promptScopeOrder.map((scope) => {
    const saved = promptByScope.get(scope);
    const fallback = defaultAiPrompts.find((prompt) => prompt.scope === scope)!;

    return {
      scope,
      title: saved?.title ?? fallback.title,
      body: saved?.body ?? fallback.body,
      isActive: saved?.isActive ?? true,
      updatedAt: saved?.updatedAt,
    };
  });
  const enabledFlags = [
    config.conciergeEnabled,
    config.messageDraftEnabled,
    config.operationsInsightEnabled,
    config.reportInsightEnabled,
  ].filter(Boolean).length;
  const readiness = [
    {
      label: "OpenRouter API key",
      description: apiKeyConfigured ? "Configured through environment." : "Missing OPENROUTER_API_KEY.",
      pass: apiKeyConfigured,
    },
    {
      label: "AI switch",
      description: config.isEnabled ? "AI preparation is enabled." : "AI preparation is disabled.",
      pass: config.isEnabled,
    },
    {
      label: "Human review",
      description: "Autonomous actions are locked off in V1.",
      pass: !config.autonomousActions,
    },
    {
      label: "Prompt set",
      description: `${prompts.filter((prompt) => prompt.isActive).length}/${prompts.length} prompts active.`,
      pass: prompts.some((prompt) => prompt.isActive),
    },
  ];
  const payloadPreview = buildOpenRouterChatPayload({
    primaryModel: config.primaryModel,
    fallbackModel: config.fallbackModel,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    messages: [
      { role: "system", content: prompts.find((prompt) => prompt.scope === AiPromptScope.SYSTEM_GUARDRAILS)?.body ?? "" },
      { role: "user", content: `Prepare a daily summary for ${property.name}.` },
    ],
  });

  return (
    <AppShell>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-bold text-[#29f1ff]">AI Preparation</p>
          <h2 className="mt-2 text-3xl font-black tracking-normal text-white">AI Control Room</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/62">
            Konfigurasi OpenRouter, feature flags, dan prompt dasar untuk penggunaan AI yang tetap human-reviewed.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge label={apiKeyConfigured ? "API key configured" : "API key missing"} tone={apiKeyConfigured ? "success" : "warning"} dot />
          <StatusBadge label={`${enabledFlags} feature flags`} tone="info" dot />
        </div>
      </div>

      <ActionFeedbackBanner feedback={feedback} />

      <section className="mt-6 grid gap-4 md:grid-cols-4">
        <MetricCard title="Provider" value="OpenRouter" icon={<BrainCircuit className="size-5" />} />
        <MetricCard title="Primary Model" value={config.primaryModel} icon={<Gauge className="size-5" />} compact />
        <MetricCard title="Fallback" value={config.fallbackModel || "None"} icon={<SlidersHorizontal className="size-5" />} compact />
        <MetricCard title="Prompts" value={String(prompts.length)} icon={<FileText className="size-5" />} />
      </section>

      <section className="mt-6 grid gap-5 2xl:grid-cols-[1fr_420px]">
        <div className="space-y-5">
          <GlassCard className="p-5">
            <div className="flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-[22px] bg-[#29f1ff]/14 text-[#b8fbff]">
                <KeyRound className="size-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">OpenRouter Configuration</h3>
                <p className="mt-1 text-xs font-semibold text-white/50">API key status only. Secret value stays in environment.</p>
              </div>
            </div>

            <form action={updateAiConfigurationAction} className="mt-5 grid gap-4 xl:grid-cols-2">
              <label className="flex min-h-11 items-center gap-2 rounded-[22px] surface-field px-4 text-sm font-bold text-white/70">
                <input type="checkbox" name="isEnabled" defaultChecked={config.isEnabled} disabled={!canWrite} className="size-4 accent-[#29f1ff]" />
                AI enabled
              </label>
              <label className="flex min-h-11 items-center gap-2 rounded-[22px] surface-field px-4 text-sm font-bold text-white/70">
                <input type="checkbox" checked={false} disabled className="size-4 accent-[#29f1ff]" readOnly />
                Autonomous actions locked off
              </label>
              <TextField name="primaryModel" label="Primary Model" defaultValue={config.primaryModel} disabled={!canWrite} required />
              <TextField name="fallbackModel" label="Fallback Model" defaultValue={config.fallbackModel ?? ""} disabled={!canWrite} />
              <TextField name="temperature" label="Temperature" type="number" min="0" max="2" step="0.1" defaultValue={String(config.temperature)} disabled={!canWrite} required />
              <TextField name="maxTokens" label="Max Tokens" type="number" min="128" max="8000" step="1" defaultValue={String(config.maxTokens)} disabled={!canWrite} required />
              <FeatureToggle name="conciergeEnabled" label="AI Concierge drafts" checked={config.conciergeEnabled} disabled={!canWrite} />
              <FeatureToggle name="messageDraftEnabled" label="Message drafting" checked={config.messageDraftEnabled} disabled={!canWrite} />
              <FeatureToggle name="operationsInsightEnabled" label="Operations insights" checked={config.operationsInsightEnabled} disabled={!canWrite} />
              <FeatureToggle name="reportInsightEnabled" label="Report insights" checked={config.reportInsightEnabled} disabled={!canWrite} />
              {canWrite ? (
                <div className="xl:col-span-2">
                  <button className="gold-gradient min-h-11 rounded-[22px] px-5 text-sm font-black text-[#041015]">
                    Save AI Configuration
                  </button>
                </div>
              ) : null}
            </form>
          </GlassCard>

          <GlassCard className="p-5">
            <div className="flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-[22px] bg-[#29f1ff]/14 text-[#b8fbff]">
                <FileText className="size-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">Prompt Placeholders</h3>
                <p className="mt-1 text-xs font-semibold text-white/50">Prompt dasar untuk draft dan insight yang direview manusia.</p>
              </div>
            </div>

            <div className="mt-5 grid gap-4">
              {prompts.map((prompt) => (
                <form key={prompt.scope} action={updateAiPromptTemplateAction} className="rounded-[22px] surface-inset p-4">
                  <input type="hidden" name="scope" value={prompt.scope} />
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-normal text-[#29f1ff]">{aiPromptScopeLabels[prompt.scope]}</p>
                      <p className="mt-2 text-sm font-semibold text-white/42">
                        {prompt.updatedAt ? `Updated ${formatDateTimeId(prompt.updatedAt)}` : "Default blueprint prompt"}
                      </p>
                    </div>
                    <label className="flex items-center gap-2 text-sm font-bold text-white/64">
                      <input type="checkbox" name="isActive" defaultChecked={prompt.isActive} disabled={!canWrite} className="size-4 accent-[#29f1ff]" />
                      Active
                    </label>
                  </div>
                  <div className="mt-4 grid gap-4">
                    <TextField name="title" label="Prompt Title" defaultValue={prompt.title} disabled={!canWrite} required />
                    <TextareaField name="body" label="Prompt Body" defaultValue={prompt.body} disabled={!canWrite} required />
                  </div>
                  {canWrite ? (
                    <button className="mt-4 min-h-10 rounded-[16px] surface-chip px-4 text-xs font-black text-white/76">
                      Save Prompt
                    </button>
                  ) : null}
                </form>
              ))}
            </div>
          </GlassCard>
        </div>

        <aside className="space-y-5">
          <GlassCard className="p-5">
            <div className="flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-[22px] bg-emerald-400/12 text-emerald-100">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">Readiness</h3>
                <p className="mt-1 text-xs font-semibold text-white/50">V1 AI guardrail status</p>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {readiness.map((item) => (
                <ReadinessItem key={item.label} {...item} />
              ))}
            </div>
          </GlassCard>

          <GlassCard className="p-5">
            <h3 className="text-lg font-black text-white">Request Preview</h3>
            <pre className="mt-4 max-h-[460px] overflow-auto rounded-[22px] surface-inset p-4 text-xs font-semibold leading-5 text-white/62">
              {JSON.stringify(payloadPreview, null, 2)}
            </pre>
          </GlassCard>

          <GlassCard className="p-5">
            <h3 className="text-lg font-black text-white">Recent AI Activity</h3>
            <div className="mt-4 space-y-3">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="rounded-[22px] surface-inset p-3">
                  <p className="text-sm font-black text-white">{activity.action}</p>
                  <p className="mt-1 text-xs font-semibold text-white/50">{activity.description ?? activity.entityType}</p>
                  <p className="mt-2 text-[11px] font-semibold text-white/35">{formatDateTimeId(activity.createdAt)}</p>
                </div>
              ))}
              {recentActivity.length === 0 ? (
                <div className="rounded-[22px] surface-inset p-5 text-sm font-semibold text-white/54">
                  Belum ada aktivitas konfigurasi AI.
                </div>
              ) : null}
            </div>
          </GlassCard>
        </aside>
      </section>
    </AppShell>
  );
}

function MetricCard({ title, value, icon, compact = false }: { title: string; value: string; icon: ReactNode; compact?: boolean }) {
  return (
    <GlassCard className="p-5">
      <div className="grid size-11 place-items-center rounded-[22px] bg-[#29f1ff]/14 text-[#b8fbff]">{icon}</div>
      <p className="mt-4 text-sm font-bold text-white/58">{title}</p>
      <p className={compact ? "mt-2 break-words text-lg font-black text-white" : "mt-2 text-3xl font-black text-white"}>{value}</p>
    </GlassCard>
  );
}

function FeatureToggle({ name, label, checked, disabled }: { name: string; label: string; checked: boolean; disabled: boolean }) {
  return (
    <label className="flex min-h-11 items-center gap-2 rounded-[22px] surface-field px-4 text-sm font-bold text-white/70">
      <input type="checkbox" name={name} defaultChecked={checked} disabled={disabled} className="size-4 accent-[#29f1ff]" />
      {label}
    </label>
  );
}

function ReadinessItem({ label, description, pass }: { label: string; description: string; pass: boolean }) {
  return (
    <div className="rounded-[22px] surface-inset p-4">
      <div className="flex items-start gap-3">
        {pass ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-200" /> : <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-200" />}
        <div>
          <p className="font-black text-white">{label}</p>
          <p className="mt-1 text-xs font-semibold leading-5 text-white/52">{description}</p>
        </div>
      </div>
    </div>
  );
}

function TextField({
  label,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className={className}>
      <span className="mb-2 block text-xs font-black uppercase tracking-normal text-white/42">{label}</span>
      <input
        {...props}
        className="min-h-11 w-full rounded-[22px] surface-field px-4 text-sm font-bold text-white outline-none placeholder:text-white/34 disabled:opacity-50"
      />
    </label>
  );
}

function TextareaField({
  label,
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return (
    <label className={className}>
      <span className="mb-2 block text-xs font-black uppercase tracking-normal text-white/42">{label}</span>
      <textarea
        {...props}
        rows={5}
        className="w-full rounded-[22px] surface-field px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-white/34 disabled:opacity-50"
      />
    </label>
  );
}
