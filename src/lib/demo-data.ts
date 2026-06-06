import {
  BedDouble,
  CalendarDays,
  ClipboardCheck,
  DollarSign,
  Home,
  TrendingUp,
  Users,
  Wrench,
} from "lucide-react";

export const kpis = [
  {
    title: "Occupancy Today",
    value: "72%",
    trend: { value: "8%", direction: "up" as const },
    icon: Users,
    tone: "forest" as const,
  },
  {
    title: "Revenue Today",
    value: "Rp 45,6 jt",
    trend: { value: "12%", direction: "up" as const },
    icon: DollarSign,
    tone: "gold" as const,
  },
  {
    title: "Bookings",
    value: "18",
    trend: { value: "5", direction: "up" as const },
    icon: CalendarDays,
    tone: "blue" as const,
  },
  {
    title: "Available Units",
    value: "14 / 50",
    description: "28% tersedia",
    icon: Home,
    tone: "sage" as const,
  },
  {
    title: "RevPAR",
    value: "Rp 912 rb",
    trend: { value: "9%", direction: "up" as const },
    icon: TrendingUp,
    tone: "violet" as const,
  },
];

export const occupancyTrend = [
  { day: "18 Mei", value: 58 },
  { day: "19 Mei", value: 52 },
  { day: "20 Mei", value: 74 },
  { day: "21 Mei", value: 63 },
  { day: "22 Mei", value: 62 },
  { day: "23 Mei", value: 58 },
  { day: "24 Mei", value: 61 },
];

export const revenueTrend = [
  { day: "18 Mei", value: 30 },
  { day: "19 Mei", value: 21 },
  { day: "20 Mei", value: 35 },
  { day: "21 Mei", value: 29 },
  { day: "22 Mei", value: 44 },
  { day: "23 Mei", value: 31 },
  { day: "24 Mei", value: 39 },
];

export const unitStatus = [
  { name: "Occupied", value: 26, color: "#20c878" },
  { name: "Reserved", value: 10, color: "#8be09c" },
  { name: "Available", value: 14, color: "#29f1ff" },
  { name: "Maintenance", value: 2, color: "#dc8174" },
  { name: "Out of Order", value: 1, color: "#a7bbb2" },
];

export const arrivals = [
  { time: "14:00", guest: "Jessica Parker", meta: "2 Adults · 1 Night", unit: "Sapphire Tent 07" },
  { time: "15:30", guest: "Daniel & Sarah Kim", meta: "2 Adults · 2 Nights", unit: "Luxe Dome 03" },
  { time: "16:00", guest: "Rawan Al-Saud", meta: "2 Adults · 3 Nights", unit: "Sapphire Tent 12" },
  { time: "17:00", guest: "Michael Brown", meta: "2 Adults · 1 Night", unit: "Luxe Dome 01" },
];

export const reservations = [
  { guest: "Avery Johnson", date: "24 Mei - 26 Mei 2025", status: "Confirmed", amount: "Rp 6.900.000" },
  { guest: "Chloe Martin", date: "25 Mei - 28 Mei 2025", status: "Confirmed", amount: "Rp 11.700.000" },
  { guest: "Yudha Pratama", date: "24 Mei - 25 Mei 2025", status: "Pending", amount: "Rp 3.450.000" },
  { guest: "Olivia Bennett", date: "26 Mei - 29 Mei 2025", status: "Confirmed", amount: "Rp 10.350.000" },
];

export const serviceRequests = [
  { icon: Wrench, title: "AC not cooling", unit: "Sapphire Tent 05", age: "10 min ago", priority: "High" },
  { icon: BedDouble, title: "Water leak in bathroom", unit: "Luxe Dome 02", age: "35 min ago", priority: "Medium" },
  { icon: ClipboardCheck, title: "Lights not working", unit: "Sapphire Tent 09", age: "1 hr ago", priority: "Medium" },
  { icon: Home, title: "Extra towels & amenities", unit: "Luxe Dome 04", age: "2 hr ago", priority: "Low" },
];

export const bookingSources = [
  { source: "Website", value: 38 },
  { source: "WhatsApp", value: 24 },
  { source: "Booking.com", value: 18 },
  { source: "Agoda", value: 12 },
  { source: "Walk-in", value: 8 },
];

export const priorityTasks = [
  { label: "Siapkan PD-01 untuk arrival 14:00", status: "Urgent", tone: "danger" as const },
  { label: "Follow-up pembayaran NE250523-0015", status: "Pending", tone: "warning" as const },
  { label: "Review request dinner honeymoon", status: "Open", tone: "info" as const },
];
