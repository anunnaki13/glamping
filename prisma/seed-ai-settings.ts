import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  AiPromptScope,
  PrismaClient,
} from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to seed AI settings.");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const prompts = [
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
] as const;

async function main() {
  const properties = await prisma.property.findMany({ select: { id: true, name: true } });

  for (const property of properties) {
    await prisma.aiConfiguration.upsert({
      where: { propertyId: property.id },
      update: {},
      create: {
        propertyId: property.id,
        isEnabled: false,
        primaryModel: process.env.OPENROUTER_PRIMARY_MODEL?.trim() || "openrouter/auto",
        fallbackModel: process.env.OPENROUTER_FALLBACK_MODELS?.split(",").map((item) => item.trim()).filter(Boolean)[0] ?? "~anthropic/claude-sonnet-latest",
        temperature: 0.3,
        maxTokens: 800,
        autonomousActions: false,
      },
    });

    for (const prompt of prompts) {
      await prisma.aiPromptTemplate.upsert({
        where: {
          propertyId_scope: {
            propertyId: property.id,
            scope: prompt.scope,
          },
        },
        update: {},
        create: {
          propertyId: property.id,
          ...prompt,
        },
      });
    }

    console.log(`Seeded AI preparation settings for ${property.name}.`);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
