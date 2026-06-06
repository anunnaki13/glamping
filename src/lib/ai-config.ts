import { AiPromptScope } from "@/generated/prisma/enums";

export type AiPromptSeed = {
  scope: AiPromptScope;
  title: string;
  body: string;
};

export const aiPromptScopeLabels: Record<AiPromptScope, string> = {
  SYSTEM_GUARDRAILS: "System guardrails",
  AI_CONCIERGE: "AI Concierge",
  MESSAGE_DRAFT: "Message draft",
  OPERATIONS_SUMMARY: "Operations summary",
  REPORT_INSIGHTS: "Report insights",
};

export const defaultAiPrompts: AiPromptSeed[] = [
  {
    scope: AiPromptScope.SYSTEM_GUARDRAILS,
    title: "Smart Glamping OS Guardrails",
    body: "You are an assistant for a premium glamping operation. You may summarize data and draft staff-facing suggestions. Never confirm bookings, cancel reservations, change prices, take payments, send outbound messages, or promise availability without a human operator.",
  },
  {
    scope: AiPromptScope.AI_CONCIERGE,
    title: "Guest Concierge Draft",
    body: "Draft a warm, concise guest-facing reply using the reservation context, guest preferences, and property tone. Keep it practical, premium, and easy for staff to review before sending.",
  },
  {
    scope: AiPromptScope.MESSAGE_DRAFT,
    title: "WhatsApp Message Draft",
    body: "Draft WhatsApp copy for a human staff member to review. Use the guest name, booking code, stay dates, and service context. Keep the message under 900 characters.",
  },
  {
    scope: AiPromptScope.OPERATIONS_SUMMARY,
    title: "Daily Operations Summary",
    body: "Summarize arrivals, departures, in-house guests, dirty units, blocked housekeeping tasks, urgent requests, and unpaid reservations. Return a calm action list for the manager.",
  },
  {
    scope: AiPromptScope.REPORT_INSIGHTS,
    title: "Report Insight Draft",
    body: "Interpret occupancy, revenue, booking source, service request, housekeeping, and POS metrics. Highlight anomalies and suggest questions the owner should ask the team.",
  },
];

export function hasOpenRouterApiKey() {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}

export function getOpenRouterEnvDefaults() {
  return {
    enabled: process.env.OPENROUTER_ENABLED === "true",
    primaryModel: process.env.OPENROUTER_PRIMARY_MODEL?.trim() || "openrouter/auto",
    fallbackModel: process.env.OPENROUTER_FALLBACK_MODELS?.split(",").map((item) => item.trim()).filter(Boolean)[0] ?? "",
  };
}
