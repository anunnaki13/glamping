import { MessageTemplateCategory } from "@/generated/prisma/enums";

export type MessageTemplateSeed = {
  name: string;
  category: MessageTemplateCategory;
  body: string;
  sortOrder: number;
};

export const messageTemplateCategoryLabels: Record<MessageTemplateCategory, string> = {
  BOOKING_CONFIRMATION: "Booking confirmation",
  PAYMENT_REMINDER: "Payment reminder",
  CHECK_IN_REMINDER: "Check-in reminder",
  WELCOME_MESSAGE: "Welcome message",
  CHECKOUT_THANK_YOU: "Checkout thank-you",
  REVIEW_REQUEST: "Review request",
  CUSTOM: "Custom",
};

export const messageVariableLabels = [
  "guest_name",
  "booking_code",
  "property_name",
  "property_phone",
  "unit_name",
  "check_in",
  "check_out",
  "payment_status",
  "total_amount",
] as const;

export const defaultMessageTemplates: MessageTemplateSeed[] = [
  {
    name: "Booking Confirmation",
    category: MessageTemplateCategory.BOOKING_CONFIRMATION,
    sortOrder: 10,
    body: "Halo {{guest_name}}, reservasi {{booking_code}} di {{property_name}} sudah kami konfirmasi. Check-in {{check_in}}, check-out {{check_out}}, unit {{unit_name}}. Jika ada pertanyaan, hubungi {{property_phone}}.",
  },
  {
    name: "Payment Reminder",
    category: MessageTemplateCategory.PAYMENT_REMINDER,
    sortOrder: 20,
    body: "Halo {{guest_name}}, kami ingin mengingatkan status pembayaran reservasi {{booking_code}} masih {{payment_status}} dengan total {{total_amount}}. Tim {{property_name}} siap membantu jika membutuhkan instruksi pembayaran.",
  },
  {
    name: "Check-in Reminder",
    category: MessageTemplateCategory.CHECK_IN_REMINDER,
    sortOrder: 30,
    body: "Halo {{guest_name}}, kami menantikan kedatangan Anda di {{property_name}} pada {{check_in}}. Unit Anda: {{unit_name}}. Silakan kabari estimasi waktu tiba agar tim kami dapat menyambut dengan baik.",
  },
  {
    name: "Welcome Message",
    category: MessageTemplateCategory.WELCOME_MESSAGE,
    sortOrder: 40,
    body: "Selamat datang di {{property_name}}, {{guest_name}}. Semoga stay Anda nyaman. Jika membutuhkan bantuan selama menginap di {{unit_name}}, balas pesan ini atau hubungi {{property_phone}}.",
  },
  {
    name: "Checkout Thank You",
    category: MessageTemplateCategory.CHECKOUT_THANK_YOU,
    sortOrder: 50,
    body: "Terima kasih sudah menginap di {{property_name}}, {{guest_name}}. Semoga perjalanan berikutnya lancar. Kami senang dapat menyambut Anda kembali di kesempatan berikutnya.",
  },
  {
    name: "Review Request",
    category: MessageTemplateCategory.REVIEW_REQUEST,
    sortOrder: 60,
    body: "Halo {{guest_name}}, terima kasih sudah memilih {{property_name}}. Jika pengalaman Anda menyenangkan, kami sangat menghargai review singkat Anda. Masukan Anda membantu tim kami menjaga kualitas layanan.",
  },
];

export function renderMessageTemplate(body: string, context: Record<string, string>) {
  return body.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_match, key: string) => context[key] ?? "-");
}

export function normalizeWhatsappPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  if (digits.startsWith("0")) {
    return `62${digits.slice(1)}`;
  }

  if (digits.startsWith("8")) {
    return `62${digits}`;
  }

  return digits;
}

export function buildWhatsappUrl(phone: string, message: string) {
  const normalized = normalizeWhatsappPhone(phone);
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}
