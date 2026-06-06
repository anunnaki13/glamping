import { addDays, setHours, startOfDay } from "date-fns";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import {
  AiPromptScope,
  BookingSource,
  HousekeepingStatus,
  MessageTemplateCategory,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  PaymentTransactionType,
  PosCategory,
  PrismaClient,
  Priority,
  RequestStatus,
  RequestType,
  ReservationStatus,
  UnitStatus,
  UserRole,
} from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to seed Smart Glamping OS.");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const today = startOfDay(new Date());

async function main() {
  await clearDatabase();

  const property = await prisma.property.create({
    data: {
      name: "Nusa Escape Glamping",
      slug: "nusa-escape",
      address: "Bali, Indonesia",
      phone: "+62 812 3456 7890",
      email: "booking@nusaescape.id",
      timezone: "Asia/Makassar",
      currency: "IDR",
    },
  });

  await prisma.messageTemplate.createMany({
    data: [
      {
        propertyId: property.id,
        name: "Booking Confirmation",
        category: MessageTemplateCategory.BOOKING_CONFIRMATION,
        sortOrder: 10,
        body: "Halo {{guest_name}}, reservasi {{booking_code}} di {{property_name}} sudah kami konfirmasi. Check-in {{check_in}}, check-out {{check_out}}, unit {{unit_name}}. Jika ada pertanyaan, hubungi {{property_phone}}.",
      },
      {
        propertyId: property.id,
        name: "Payment Reminder",
        category: MessageTemplateCategory.PAYMENT_REMINDER,
        sortOrder: 20,
        body: "Halo {{guest_name}}, kami ingin mengingatkan status pembayaran reservasi {{booking_code}} masih {{payment_status}} dengan total {{total_amount}}. Tim {{property_name}} siap membantu jika membutuhkan instruksi pembayaran.",
      },
      {
        propertyId: property.id,
        name: "Check-in Reminder",
        category: MessageTemplateCategory.CHECK_IN_REMINDER,
        sortOrder: 30,
        body: "Halo {{guest_name}}, kami menantikan kedatangan Anda di {{property_name}} pada {{check_in}}. Unit Anda: {{unit_name}}. Silakan kabari estimasi waktu tiba agar tim kami dapat menyambut dengan baik.",
      },
      {
        propertyId: property.id,
        name: "Welcome Message",
        category: MessageTemplateCategory.WELCOME_MESSAGE,
        sortOrder: 40,
        body: "Selamat datang di {{property_name}}, {{guest_name}}. Semoga stay Anda nyaman. Jika membutuhkan bantuan selama menginap di {{unit_name}}, balas pesan ini atau hubungi {{property_phone}}.",
      },
      {
        propertyId: property.id,
        name: "Checkout Thank You",
        category: MessageTemplateCategory.CHECKOUT_THANK_YOU,
        sortOrder: 50,
        body: "Terima kasih sudah menginap di {{property_name}}, {{guest_name}}. Semoga perjalanan berikutnya lancar. Kami senang dapat menyambut Anda kembali di kesempatan berikutnya.",
      },
      {
        propertyId: property.id,
        name: "Review Request",
        category: MessageTemplateCategory.REVIEW_REQUEST,
        sortOrder: 60,
        body: "Halo {{guest_name}}, terima kasih sudah memilih {{property_name}}. Jika pengalaman Anda menyenangkan, kami sangat menghargai review singkat Anda. Masukan Anda membantu tim kami menjaga kualitas layanan.",
      },
    ],
  });

  await prisma.aiConfiguration.create({
    data: {
      propertyId: property.id,
      isEnabled: false,
      primaryModel: "openrouter/auto",
      fallbackModel: "~anthropic/claude-sonnet-latest",
      temperature: 0.3,
      maxTokens: 800,
      autonomousActions: false,
    },
  });

  await prisma.aiPromptTemplate.createMany({
    data: [
      {
        propertyId: property.id,
        scope: AiPromptScope.SYSTEM_GUARDRAILS,
        title: "Smart Glamping OS Guardrails",
        body: "You are an assistant for a premium glamping operation. You may summarize data and draft staff-facing suggestions. Never confirm bookings, cancel reservations, change prices, take payments, send outbound messages, or promise availability without a human operator.",
      },
      {
        propertyId: property.id,
        scope: AiPromptScope.AI_CONCIERGE,
        title: "Guest Concierge Draft",
        body: "Draft a warm, concise guest-facing reply using the reservation context, guest preferences, and property tone. Keep it practical, premium, and easy for staff to review before sending.",
      },
      {
        propertyId: property.id,
        scope: AiPromptScope.MESSAGE_DRAFT,
        title: "WhatsApp Message Draft",
        body: "Draft WhatsApp copy for a human staff member to review. Use the guest name, booking code, stay dates, and service context. Keep the message under 900 characters.",
      },
      {
        propertyId: property.id,
        scope: AiPromptScope.OPERATIONS_SUMMARY,
        title: "Daily Operations Summary",
        body: "Summarize arrivals, departures, in-house guests, dirty units, blocked housekeeping tasks, urgent requests, and unpaid reservations. Return a calm action list for the manager.",
      },
      {
        propertyId: property.id,
        scope: AiPromptScope.REPORT_INSIGHTS,
        title: "Report Insight Draft",
        body: "Interpret occupancy, revenue, booking source, service request, housekeeping, and POS metrics. Highlight anomalies and suggest questions the owner should ask the team.",
      },
    ],
  });

  const passwordHash = await bcrypt.hash("password123", 12);

  await prisma.user.createMany({
    data: [
      { propertyId: property.id, name: "Budi Santoso", email: "owner@nusaescape.local", passwordHash, role: UserRole.OWNER },
      { propertyId: property.id, name: "Maya Prasetyo", email: "manager@nusaescape.local", passwordHash, role: UserRole.MANAGER },
      { propertyId: property.id, name: "Ayu Lestari", email: "frontoffice@nusaescape.local", passwordHash, role: UserRole.FRONT_OFFICE },
      { propertyId: property.id, name: "Made Wira", email: "housekeeping@nusaescape.local", passwordHash, role: UserRole.HOUSEKEEPING },
      { propertyId: property.id, name: "Komang Danu", email: "fnb@nusaescape.local", passwordHash, role: UserRole.FNB_ACTIVITY },
    ],
  });

  const [deluxeDome, premiumDome, familyDome, jungleVilla, suiteTent] = await Promise.all([
    prisma.unitType.create({
      data: { propertyId: property.id, name: "Deluxe Dome", capacity: 2, baseRate: "1700000", description: "Cozy dome untuk pasangan dan short stay." },
    }),
    prisma.unitType.create({
      data: { propertyId: property.id, name: "Premium Dome", capacity: 2, baseRate: "1900000", description: "Premium dome dengan view utama dan private deck." },
    }),
    prisma.unitType.create({
      data: { propertyId: property.id, name: "Family Dome", capacity: 4, baseRate: "2400000", description: "Unit keluarga dengan layout lebih luas." },
    }),
    prisma.unitType.create({
      data: { propertyId: property.id, name: "Jungle Villa", capacity: 3, baseRate: "2850000", description: "Villa nature-view untuk stay premium." },
    }),
    prisma.unitType.create({
      data: { propertyId: property.id, name: "Suite Tent", capacity: 2, baseRate: "2200000", description: "Tent suite dengan ambience romantis." },
    }),
  ]);

  const unitRows = [
    ["DD-01", "Deluxe Dome 01", deluxeDome.id, UnitStatus.OCCUPIED],
    ["DD-02", "Deluxe Dome 02", deluxeDome.id, UnitStatus.OCCUPIED],
    ["DD-03", "Deluxe Dome 03", deluxeDome.id, UnitStatus.READY],
    ["DD-04", "Deluxe Dome 04", deluxeDome.id, UnitStatus.CLEANING],
    ["PD-01", "Premium Dome 01", premiumDome.id, UnitStatus.OCCUPIED],
    ["PD-02", "Premium Dome 02", premiumDome.id, UnitStatus.READY],
    ["FD-01", "Family Dome 01", familyDome.id, UnitStatus.READY],
    ["FD-02", "Family Dome 02", familyDome.id, UnitStatus.MAINTENANCE],
    ["JV-01", "Jungle Villa 01", jungleVilla.id, UnitStatus.READY],
    ["JV-02", "Jungle Villa 02", jungleVilla.id, UnitStatus.OCCUPIED],
    ["ST-01", "Suite Tent 01", suiteTent.id, UnitStatus.OCCUPIED],
    ["ST-02", "Suite Tent 02", suiteTent.id, UnitStatus.READY],
  ] as const;
  const unitPhotoByPrefix = {
    DD: "/uploads/demo/unit-geodesic-dome-forest.jpg",
    FD: "/uploads/demo/unit-suite-tent-interior.jpg",
    JV: "/uploads/demo/unit-jungle-cabin.jpg",
    PD: "/uploads/demo/unit-glamping-tents-dusk.jpg",
    ST: "/uploads/demo/unit-safari-tent-sunrise.jpg",
  } as const;

  await prisma.unit.createMany({
    data: unitRows.map(([code, name, unitTypeId, status]) => ({
      propertyId: property.id,
      unitTypeId,
      code,
      name,
      status,
      amenities: ["Private deck", "Air conditioning", "Wi-Fi", "Breakfast"],
      photoUrl: unitPhotoByPrefix[code.slice(0, 2) as keyof typeof unitPhotoByPrefix],
    })),
  });

  const units = await prisma.unit.findMany({ orderBy: { code: "asc" } });

  const guestNames = [
    ["Aria Wibowo", "aria.wibowo@gmail.com", "+6281234567890", "Indonesia", "VIP"],
    ["Jessica Parker", "jessica.parker@example.com", "+14155550101", "United States", "COUPLE"],
    ["Daniel Kim", "daniel.kim@example.com", "+821012345678", "South Korea", "COUPLE"],
    ["Sarah Johnson", "sarah.johnson@example.com", "+61412345678", "Australia", "WELLNESS"],
    ["Michael Tan", "michael.tan@example.com", "+6591234567", "Singapore", "GENERAL"],
    ["Dewi Kartika", "dewi.kartika@example.com", "+628138880001", "Indonesia", "FAMILY"],
    ["Lucas Fernandez", "lucas.fernandez@example.com", "+34911222333", "Spain", "NOMAD"],
    ["Chloe Martin", "chloe.martin@example.com", "+33712345678", "France", "COUPLE"],
    ["Yudha Pratama", "yudha.pratama@example.com", "+628129990002", "Indonesia", "GENERAL"],
    ["Olivia Bennett", "olivia.bennett@example.com", "+447700900123", "United Kingdom", "WELLNESS"],
    ["Avery Johnson", "avery.johnson@example.com", "+12025550177", "United States", "GENERAL"],
    ["Rawan Al-Saud", "rawan.alsaud@example.com", "+966500000001", "Saudi Arabia", "VIP"],
    ["Putri Rahmawati", "putri.rahmawati@example.com", "+628138880003", "Indonesia", "FAMILY"],
    ["James Wilson", "james.wilson@example.com", "+447700900456", "United Kingdom", "COUPLE"],
    ["Emma Brown", "emma.brown@example.com", "+61412345999", "Australia", "WELLNESS"],
    ["Rizky Pratama", "rizky.pratama@example.com", "+628138880004", "Indonesia", "GENERAL"],
    ["Mark Thompson", "mark.thompson@example.com", "+12025550199", "United States", "NOMAD"],
    ["Siti Rahmawati", "siti.rahmawati@example.com", "+628138880005", "Indonesia", "FAMILY"],
    ["John Smith", "john.smith@example.com", "+14155550122", "United States", "GENERAL"],
    ["Maya Sari", "maya.sari@example.com", "+628138880006", "Indonesia", "COUPLE"],
    ["Anna Muller", "anna.muller@example.com", "+491701234567", "Germany", "WELLNESS"],
    ["Kenji Sato", "kenji.sato@example.com", "+819012345678", "Japan", "GENERAL"],
    ["Nadia Putri", "nadia.putri@example.com", "+628138880007", "Indonesia", "VIP"],
    ["Sophie Lee", "sophie.lee@example.com", "+85291234567", "Hong Kong", "COUPLE"],
    ["Thomas Clark", "thomas.clark@example.com", "+12025550333", "Canada", "NOMAD"],
  ];

  await prisma.guest.createMany({
    data: guestNames.map(([fullName, email, phone, country, guestType]) => ({
      fullName,
      email,
      phone,
      country,
      guestType,
      preferences: guestType === "VIP" ? "High view, late checkout, quiet unit" : "Breakfast included",
      notes: guestType === "WELLNESS" ? "Interested in yoga and spa package" : null,
    })),
  });

  const guests = await prisma.guest.findMany({ orderBy: { fullName: "asc" } });
  const unitByCode = new Map(units.map((unit) => [unit.code, unit]));
  const guestByName = new Map(guests.map((guest) => [guest.fullName, guest]));

  const reservationInputs = [
    ["NE250523-0011", "Avery Johnson", "DD-01", -1, 1, ReservationStatus.CHECKED_IN, BookingSource.DIRECT_WEBSITE, PaymentStatus.PAID, 3450000],
    ["NE250523-0012", "Aria Wibowo", "PD-01", 0, 2, ReservationStatus.CHECKED_IN, BookingSource.DIRECT_WEBSITE, PaymentStatus.PAID, 6750000],
    ["NE250523-0013", "Chloe Martin", "JV-01", 1, 4, ReservationStatus.CONFIRMED, BookingSource.BOOKING_COM, PaymentStatus.PARTIAL, 11700000],
    ["NE250523-0014", "Daniel Kim", "ST-01", 0, 2, ReservationStatus.CHECKED_IN, BookingSource.AGODA, PaymentStatus.PAID, 4400000],
    ["NE250523-0015", "Dewi Kartika", "FD-01", 1, 4, ReservationStatus.CONFIRMED, BookingSource.WHATSAPP, PaymentStatus.PARTIAL, 6450000],
    ["NE250523-0016", "Jessica Parker", "PD-02", 0, 1, ReservationStatus.CONFIRMED, BookingSource.WHATSAPP, PaymentStatus.PAID, 3900000],
    ["NE250523-0017", "Lucas Fernandez", "DD-02", -2, 5, ReservationStatus.CHECKED_IN, BookingSource.AIRBNB, PaymentStatus.PAID, 7800000],
    ["NE250523-0018", "Michael Tan", "JV-02", -1, 1, ReservationStatus.CHECKED_IN, BookingSource.OTHER, PaymentStatus.PAID, 2850000],
    ["NE250523-0019", "Olivia Bennett", "ST-02", 2, 5, ReservationStatus.CONFIRMED, BookingSource.DIRECT_WEBSITE, PaymentStatus.UNPAID, 10350000],
    ["NE250523-0020", "Rawan Al-Saud", "DD-03", 0, 3, ReservationStatus.CONFIRMED, BookingSource.TRAVEL_AGENT, PaymentStatus.PAID, 7650000],
  ] as const;

  for (const [bookingCode, guestName, unitCode, inOffset, outOffset, status, source, paymentStatus, totalAmount] of reservationInputs) {
    const unit = unitByCode.get(unitCode);
    const guest = guestByName.get(guestName);
    if (!unit || !guest) continue;
    const amountPaid =
      paymentStatus === PaymentStatus.PAID
        ? totalAmount
        : paymentStatus === PaymentStatus.PARTIAL
          ? Math.round(totalAmount * 0.35)
          : 0;

    const reservation = await prisma.reservation.create({
      data: {
        bookingCode,
        invoiceNumber: `INV-${bookingCode}`,
        guestId: guest.id,
        unitId: unit.id,
        checkInDate: setHours(addDays(today, inOffset), 14),
        checkOutDate: setHours(addDays(today, outOffset), 11),
        adults: guestName === "Dewi Kartika" ? 2 : 2,
        children: guestName === "Dewi Kartika" ? 2 : 0,
        status,
        source,
        paymentStatus,
        roomRate: (totalAmount / Math.max(1, outOffset - inOffset)).toFixed(2),
        totalAmount: String(totalAmount),
        amountPaid: String(amountPaid),
        paymentNotes: amountPaid > 0 ? `Seed deposit/payment recorded: ${amountPaid}.` : null,
      },
    });

    if (amountPaid > 0) {
      await prisma.paymentTransaction.create({
        data: {
          code: `PAY-SEED-${bookingCode}`,
          propertyId: property.id,
          reservationId: reservation.id,
          type: PaymentTransactionType.PAYMENT,
          method: paymentStatus === PaymentStatus.PAID ? PaymentMethod.CREDIT_CARD : PaymentMethod.BANK_TRANSFER,
          amount: String(amountPaid),
          reference: `SEED-${bookingCode}`,
          note: "Initial seeded payment ledger transaction.",
          recordedBy: "Seeder",
        },
      });
    }
  }

  const reservations = await prisma.reservation.findMany({ include: { guest: true, unit: true } });

  await prisma.housekeepingTask.createMany({
    data: [
      { unitId: unitByCode.get("DD-04")!.id, taskType: "Checkout cleaning", status: HousekeepingStatus.IN_PROGRESS, priority: Priority.HIGH, assignedTo: "Made Wira", dueAt: setHours(today, 13), notes: "Next arrival 14:00" },
      { unitId: unitByCode.get("FD-02")!.id, taskType: "Maintenance block", status: HousekeepingStatus.BLOCKED, priority: Priority.URGENT, assignedTo: "Komang Danu", dueAt: setHours(today, 16), notes: "AC inspection required" },
      { unitId: unitByCode.get("PD-02")!.id, taskType: "Pre-arrival inspection", status: HousekeepingStatus.INSPECTION, priority: Priority.HIGH, assignedTo: "Made Wira", dueAt: setHours(today, 13), startedAt: setHours(today, 11) },
      { unitId: unitByCode.get("DD-03")!.id, taskType: "Ready verification", status: HousekeepingStatus.READY, priority: Priority.MEDIUM, assignedTo: "Made Wira", completedAt: setHours(today, 10) },
    ],
  });

  const ariaReservation = reservations.find((reservation) => reservation.guest.fullName === "Aria Wibowo");
  const dewikReservation = reservations.find((reservation) => reservation.guest.fullName === "Dewi Kartika");
  const mayaGuest = guestByName.get("Maya Sari");

  await prisma.serviceRequest.createMany({
    data: [
      { code: "SR-1021", reservationId: ariaReservation?.id, guestId: ariaReservation?.guestId, type: RequestType.MAINTENANCE, title: "AC not cooling", status: RequestStatus.OPEN, priority: Priority.HIGH, description: "Guest reports room feels warm." },
      { code: "SR-1022", reservationId: dewikReservation?.id, guestId: dewikReservation?.guestId, type: RequestType.HOUSEKEEPING, title: "Extra towels", status: RequestStatus.ASSIGNED, priority: Priority.LOW, assignedTo: "Made Wira" },
      { code: "SR-1023", guestId: mayaGuest?.id, type: RequestType.SPECIAL_REQUEST, title: "Romantic dinner setup", status: RequestStatus.IN_PROGRESS, priority: Priority.MEDIUM, assignedTo: "Komang Danu" },
      { code: "SR-1024", reservationId: ariaReservation?.id, guestId: ariaReservation?.guestId, type: RequestType.ROOM_SERVICE, title: "Mineral water refill", status: RequestStatus.COMPLETED, priority: Priority.LOW, completedAt: setHours(today, 12) },
    ],
  });

  const items = await prisma.posItem.createManyAndReturn({
    data: [
      { name: "Floating Breakfast", category: PosCategory.PACKAGE, price: "350000", description: "Breakfast tray served at private pool/deck.", photoUrl: "/uploads/demo/catalog-floating-breakfast.jpg" },
      { name: "Romantic Dinner", category: PosCategory.PACKAGE, price: "850000", description: "Private dinner setup with decoration.", photoUrl: "/uploads/demo/catalog-romantic-dinner.jpg" },
      { name: "BBQ Night", category: PosCategory.FOOD, price: "450000", description: "Outdoor BBQ dinner experience.", photoUrl: "/uploads/demo/catalog-bbq-night.jpg" },
      { name: "Nusa Signature Breakfast", category: PosCategory.FOOD, price: "280000", description: "Bali-style breakfast spread with fruit, pastry, and coffee.", photoUrl: "/uploads/demo/catalog-floating-breakfast.jpg" },
      { name: "Coconut Mojito", category: PosCategory.BEVERAGE, price: "95000", description: "Fresh coconut mocktail with mint and lime.", photoUrl: "/uploads/demo/catalog-coconut-mojito.jpg" },
      { name: "Yoga Session", category: PosCategory.ACTIVITY, price: "150000", description: "Morning yoga session.", photoUrl: "/uploads/demo/catalog-yoga-session.jpg" },
      { name: "Couple Spa Treatment", category: PosCategory.SPA, price: "750000", description: "Couple massage and wellness treatment.", photoUrl: "/uploads/demo/catalog-couple-spa.jpg" },
      { name: "Jeep Sunrise Tour", category: PosCategory.ACTIVITY, price: "650000", description: "Sunrise tour with local operator.", photoUrl: "/uploads/demo/catalog-jeep-sunrise.jpg" },
      { name: "ATV Ride", category: PosCategory.ACTIVITY, price: "500000", description: "Guided ATV activity.", photoUrl: "/uploads/demo/catalog-atv-ride.jpg" },
      { name: "Waterfall Trekking", category: PosCategory.ACTIVITY, price: "425000", description: "Guided jungle trek to a waterfall route.", photoUrl: "/uploads/demo/catalog-waterfall-trek.jpg" },
      { name: "Airport Pickup", category: PosCategory.TRANSPORT, price: "450000", description: "Airport to property transfer.", photoUrl: "/uploads/demo/catalog-airport-pickup.jpg" },
    ],
  });

  const romanticDinner = items.find((item) => item.name === "Romantic Dinner")!;
  const floatingBreakfast = items.find((item) => item.name === "Floating Breakfast")!;

  if (ariaReservation) {
    await prisma.order.create({
      data: {
        code: "ORD-1001",
        reservationId: ariaReservation.id,
        guestId: ariaReservation.guestId,
        status: OrderStatus.COMPLETED,
        paymentStatus: PaymentStatus.PAID,
        subtotal: "1200000",
        total: "1200000",
        items: {
          create: [
            { itemId: romanticDinner.id, name: romanticDinner.name, quantity: 1, price: "850000", total: "850000" },
            { itemId: floatingBreakfast.id, name: floatingBreakfast.name, quantity: 1, price: "350000", total: "350000" },
          ],
        },
      },
    });
  }

  await prisma.activityLog.createMany({
    data: [
      { action: "seed.completed", entityType: "System", description: "Initial demo data seeded for Smart Glamping OS." },
      { action: "reservation.created", entityType: "Reservation", entityId: ariaReservation?.id, description: "Reservation confirmed by Front Office." },
      { action: "service_request.created", entityType: "ServiceRequest", description: "Guest service request queue initialized." },
    ],
  });
}

async function clearDatabase() {
  await prisma.activityLog.deleteMany();
  await prisma.aiPromptTemplate.deleteMany();
  await prisma.aiConfiguration.deleteMany();
  await prisma.communicationLog.deleteMany();
  await prisma.paymentTransaction.deleteMany();
  await prisma.messageTemplate.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.posItem.deleteMany();
  await prisma.serviceRequest.deleteMany();
  await prisma.housekeepingTask.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.guest.deleteMany();
  await prisma.unit.deleteMany();
  await prisma.unitType.deleteMany();
  await prisma.user.deleteMany();
  await prisma.property.deleteMany();
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
