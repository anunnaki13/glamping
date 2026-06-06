"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AiPromptScope } from "@/generated/prisma/enums";
import { activityActor, requirePermission } from "@/lib/action-guard";
import { redirectWithActionError, redirectWithActionSuccess } from "@/lib/action-feedback";
import { getPrisma } from "@/lib/prisma";

const promptScopeValues = [
  AiPromptScope.SYSTEM_GUARDRAILS,
  AiPromptScope.AI_CONCIERGE,
  AiPromptScope.MESSAGE_DRAFT,
  AiPromptScope.OPERATIONS_SUMMARY,
  AiPromptScope.REPORT_INSIGHTS,
] as const;

const aiConfigSchema = z.object({
  isEnabled: z.boolean(),
  primaryModel: z.string().trim().min(3).max(120),
  fallbackModel: z.string().trim().max(120).optional().or(z.literal("")),
  temperature: z.coerce.number().min(0).max(2),
  maxTokens: z.coerce.number().int().min(128).max(8000),
  conciergeEnabled: z.boolean(),
  messageDraftEnabled: z.boolean(),
  operationsInsightEnabled: z.boolean(),
  reportInsightEnabled: z.boolean(),
});

const promptSchema = z.object({
  scope: z.enum(promptScopeValues),
  title: z.string().trim().min(2).max(100),
  body: z.string().trim().min(30).max(3000),
  isActive: z.boolean(),
});

function formDataObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

export async function updateAiConfigurationAction(formData: FormData) {
  const session = await requirePermission("ai:write");
  const parsedPayload = aiConfigSchema.safeParse({
    ...formDataObject(formData),
    isEnabled: formData.get("isEnabled") === "on",
    conciergeEnabled: formData.get("conciergeEnabled") === "on",
    messageDraftEnabled: formData.get("messageDraftEnabled") === "on",
    operationsInsightEnabled: formData.get("operationsInsightEnabled") === "on",
    reportInsightEnabled: formData.get("reportInsightEnabled") === "on",
  });

  if (!parsedPayload.success) {
    redirectWithActionError("/ai", parsedPayload.error);
  }

  const parsed = parsedPayload.data;
  const prisma = getPrisma();

  const configuration = await prisma.aiConfiguration.upsert({
    where: { propertyId: session.propertyId },
    update: {
      isEnabled: parsed.isEnabled,
      primaryModel: parsed.primaryModel,
      fallbackModel: parsed.fallbackModel || null,
      temperature: parsed.temperature,
      maxTokens: parsed.maxTokens,
      conciergeEnabled: parsed.conciergeEnabled,
      messageDraftEnabled: parsed.messageDraftEnabled,
      operationsInsightEnabled: parsed.operationsInsightEnabled,
      reportInsightEnabled: parsed.reportInsightEnabled,
      autonomousActions: false,
    },
    create: {
      propertyId: session.propertyId,
      isEnabled: parsed.isEnabled,
      primaryModel: parsed.primaryModel,
      fallbackModel: parsed.fallbackModel || null,
      temperature: parsed.temperature,
      maxTokens: parsed.maxTokens,
      conciergeEnabled: parsed.conciergeEnabled,
      messageDraftEnabled: parsed.messageDraftEnabled,
      operationsInsightEnabled: parsed.operationsInsightEnabled,
      reportInsightEnabled: parsed.reportInsightEnabled,
      autonomousActions: false,
    },
  });

  await prisma.activityLog.create({
    data: {
      ...activityActor(session),
      action: "ai_configuration.updated",
      entityType: "AiConfiguration",
      entityId: configuration.id,
      description: `${session.name} updated AI preparation settings.`,
    },
  });

  revalidatePath("/ai");
  revalidatePath("/settings");
  redirectWithActionSuccess("/ai", "AI configuration berhasil disimpan.");
}

export async function updateAiPromptTemplateAction(formData: FormData) {
  const session = await requirePermission("ai:write");
  const parsedPayload = promptSchema.safeParse({
    ...formDataObject(formData),
    isActive: formData.get("isActive") === "on",
  });

  if (!parsedPayload.success) {
    redirectWithActionError("/ai", parsedPayload.error);
  }

  const parsed = parsedPayload.data;
  const prisma = getPrisma();

  const prompt = await prisma.aiPromptTemplate.upsert({
    where: {
      propertyId_scope: {
        propertyId: session.propertyId,
        scope: parsed.scope,
      },
    },
    update: {
      title: parsed.title,
      body: parsed.body,
      isActive: parsed.isActive,
    },
    create: {
      propertyId: session.propertyId,
      scope: parsed.scope,
      title: parsed.title,
      body: parsed.body,
      isActive: parsed.isActive,
    },
  });

  await prisma.activityLog.create({
    data: {
      ...activityActor(session),
      action: "ai_prompt.updated",
      entityType: "AiPromptTemplate",
      entityId: prompt.id,
      description: `${session.name} updated AI prompt ${prompt.title}.`,
    },
  });

  revalidatePath("/ai");
  redirectWithActionSuccess("/ai", `Prompt ${prompt.title} berhasil disimpan.`);
}
