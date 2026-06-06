import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  MessageTemplateCategory,
  PrismaClient,
} from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to seed message templates.");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const templates = [
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
] as const;

async function main() {
  const properties = await prisma.property.findMany({ select: { id: true, name: true } });

  for (const property of properties) {
    for (const template of templates) {
      await prisma.messageTemplate.upsert({
        where: {
          propertyId_name: {
            propertyId: property.id,
            name: template.name,
          },
        },
        update: {
          category: template.category,
          body: template.body,
          sortOrder: template.sortOrder,
          isActive: true,
        },
        create: {
          propertyId: property.id,
          ...template,
        },
      });
    }

    console.log(`Seeded message templates for ${property.name}.`);
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
