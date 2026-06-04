# SMART GLAMPING OS V1
## Design-Driven Technical Blueprint for Codex Implementation

**Project codename:** `NUSA ESCAPE`  
**Document type:** Product Requirement Document (PRD) + UI/UX Design System + Technical Build Specification  
**Primary use:** Upload to GitHub, pull to VPS, and use as the master instruction file for Codex  
**Version:** `2.0.0`  
**Status:** Ready for implementation  
**Product direction:** Premium eco-luxury hospitality operating system with a clean morphglass interface  
**Default language:** Indonesian UI with architecture prepared for future English localization  

---

# 0. How Codex Must Use This Blueprint

Codex must treat this file as the **single source of truth** for the first production-ready MVP.

## Mandatory implementation principles

1. **Design quality is not optional.** Do not generate a generic admin template.
2. Build a **custom visual identity** based on the “Morphglass Nature Premium” design system defined below.
3. Build reusable components before duplicating layouts.
4. Build working core flows first:
   - Reservation
   - Guest CRM
   - Unit status
   - Check-in
   - Check-out
   - Housekeeping
   - Owner dashboard
5. Do not over-engineer features outside the MVP scope.
6. Use realistic seeded demo data so the application looks alive immediately after deployment.
7. Every page must include:
   - loading state
   - empty state
   - error state
   - success feedback
   - responsive behavior
8. Use Indonesian labels in the UI unless specifically noted.
9. Use strict TypeScript and schema validation.
10. Lock dependency versions after the initial setup.
11. Run lint, typecheck, migration, seed, and build before marking a milestone complete.
12. Keep a changelog and implementation checklist.

## Desired first impression

When the owner opens the dashboard, the interface should feel like:

> A premium eco-resort command center: calm, elegant, nature-inspired, clean, highly usable, and modern — not a generic SaaS panel.

---

# 1. Product Vision

Smart Glamping OS V1 is a digital operating system for a premium glamping business in Bali.

The application unifies the operational flow from booking to checkout:

```text
Lead / Booking
      ↓
Reservation Calendar
      ↓
Guest Profile
      ↓
Payment Status
      ↓
Check-in
      ↓
Stay Experience
      ↓
Service Requests
      ↓
Check-out
      ↓
Housekeeping Task
      ↓
Ready for Next Guest
      ↓
Owner Dashboard & Reports
```

## Primary business problems solved

| Problem | Operational impact | V1 response |
|---|---|---|
| Booking scattered across WhatsApp, calls, and OTA | Double booking and slow response | Central reservation board |
| Unit status not visible in real time | Front office and housekeeping coordination issues | Unit status board |
| Guest data not structured | No customer history or loyalty insight | Guest CRM |
| Check-in/check-out is manual | Staff workload and inconsistent process | Guided workflow |
| Housekeeping coordination through chat | Rooms may not be ready on time | Kanban housekeeping board |
| Additional guest requests are hard to track | Slow service response | Service request module |
| Owner lacks daily visibility | Decisions based on assumptions | Real-time dashboard |

## Product positioning

> A lightweight, beautiful, operationally useful Hospitality OS for glamping, boutique eco-resorts, and villas.

---

# 2. MVP Scope

## 2.1 Build in V1

### Core administration
- Authentication
- Role-based access control
- Property settings
- User management
- Activity log

### Operations
- Units and room types
- Reservation management
- Calendar view
- Guest CRM
- Check-in wizard
- Check-out wizard
- Housekeeping Kanban
- Service requests
- Basic maintenance notes
- POS and activities catalog
- Basic order tracking

### Owner visibility
- KPI dashboard
- Occupancy chart
- Revenue chart
- Booking sources
- Unit status
- Upcoming arrivals
- Upcoming departures
- Pending housekeeping tasks
- Pending service requests
- Basic reports

### Guest communication preparation
- WhatsApp quick links
- Message templates
- Guest phone storage
- Future integration-ready conversation structure

### AI preparation
- OpenRouter wrapper
- AI feature flags
- Prompt configuration placeholder
- No autonomous action in V1

## 2.2 Do not build in V1

- Full native Android or iOS app
- Full OTA channel manager API
- Full accounting system
- Payroll
- IoT smart room
- Facial recognition
- Advanced dynamic pricing engine
- Autonomous AI booking
- Multi-property enterprise architecture
- Complex tax accounting logic
- Full payment gateway reconciliation
- Complex inventory warehouse system

---

# 3. Product Roles and Permission Matrix

## 3.1 Roles

| Role | Primary responsibility |
|---|---|
| `OWNER` | Monitor business performance and access all modules |
| `MANAGER` | Run operations and manage staff workflows |
| `FRONT_OFFICE` | Handle bookings, guests, check-in, check-out |
| `HOUSEKEEPING` | Update cleaning task progress and unit readiness |
| `FNB_ACTIVITY` | Handle food, beverages, and activities |
| `VIEWER` | Read-only access for selected dashboard pages |

## 3.2 Permission matrix

| Module / action | Owner | Manager | Front Office | Housekeeping | F&B / Activity | Viewer |
|---|---:|---:|---:|---:|---:|---:|
| Dashboard | Full | Full | Limited | Limited | Limited | Read |
| Reservation view | Full | Full | Full | Arrival summary | Limited | Read |
| Reservation create/edit | Full | Full | Full | No | No | No |
| Check-in/out | Full | Full | Full | No | No | No |
| Guest CRM | Full | Full | Full | Limited | Limited | Read masked |
| Unit setup | Full | Full | Read | Status only | Read | Read |
| Housekeeping | Full | Full | Read | Full | Read | Read |
| Service requests | Full | Full | Full | Assigned only | Assigned only | Read |
| POS catalog | Full | Full | Read | No | Full | Read |
| Orders | Full | Full | Create/read | No | Full | Read |
| Reports | Full | Full | Limited | Limited | Limited | Read |
| Settings | Full | Limited | No | No | No | No |
| User management | Full | Limited | No | No | No | No |

---

# 4. Recommended Technical Stack

## 4.1 Application stack

| Layer | Technology | Reason |
|---|---|---|
| Framework | Next.js App Router | Full-stack web application with layouts, nested routing, loading states, and server/client component separation |
| Language | TypeScript strict mode | Better maintainability and safer domain logic |
| Styling | Tailwind CSS | Fast custom UI development with token-based styling |
| UI foundation | shadcn/ui | Accessible primitives that remain customizable and editable |
| Icons | Lucide React | Consistent outline icon system |
| Animation | Framer Motion | Controlled microinteractions |
| Forms | React Hook Form + Zod | Strong validation and user-friendly forms |
| ORM | Prisma ORM | Type-safe database access |
| Database | PostgreSQL | Stable relational database for operational data |
| Auth | Auth.js or secure custom credentials implementation | Session-based authentication and future extension |
| Charts | Recharts | Dashboard visualization |
| Date handling | date-fns | Calendar and operational date utilities |
| Notifications | Sonner | Lightweight toast notifications |
| Drag and drop | dnd-kit | Housekeeping board and optional calendar interactions |
| Storage | Cloudflare R2-compatible S3 API or local dev storage | File storage abstraction |
| Deployment | Docker Compose + Nginx | Repeatable VPS deployment |
| SSL | Cloudflare proxy or Certbot | HTTPS production access |
| AI preparation | OpenRouter API wrapper | Model abstraction and optional fallback routing |

## 4.2 Package installation baseline

Codex must check current stable versions before installation and lock them after setup.

```bash
npx create-next-app@latest smart-glamping-os \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*"

cd smart-glamping-os

npm install prisma @prisma/client
npm install zod react-hook-form @hookform/resolvers
npm install lucide-react framer-motion recharts date-fns
npm install sonner next-themes
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
npm install bcryptjs
npm install clsx tailwind-merge class-variance-authority
npm install -D tsx
```

Initialize Prisma:

```bash
npx prisma init
```

Initialize shadcn/ui:

```bash
npx shadcn@latest init
```

Add required primitives:

```bash
npx shadcn@latest add \
  avatar badge breadcrumb button calendar card checkbox \
  command dialog dropdown-menu form input label popover \
  progress scroll-area select separator sheet skeleton \
  sonner table tabs textarea tooltip
```

---

# 5. Brand Identity and UI Direction

# 5.1 Design style

## Name

**Morphglass Nature Premium**

## Design statement

The interface must combine:
- luxury eco-resort ambience
- transparent layered glass panels
- soft depth and shadows
- forest-inspired colors
- warm gold accent
- calm spacing
- interactive but restrained motion
- professional information density

The visual experience must avoid:
- generic admin dashboard templates
- excessive neon
- overly bright gradients
- heavy cyberpunk style
- excessive animations
- cluttered layouts
- low-contrast text
- sharp boxy cards
- too many unrelated colors

## Keywords

```text
eco luxury
forest green
cream
soft gold
glassmorphism
morphglass
tropical calm
organic geometry
premium hospitality
clean data visualization
quiet sophistication
```

---

# 5.2 Brand name and temporary logo

Use temporary brand:

```text
NUSA ESCAPE
SMART GLAMPING OS
```

Temporary logo:
- simple line-art leaf
- optional dome outline
- avoid complex illustrated logo
- use Lucide `Leaf`, `TentTree`, or custom SVG line-art mark

Create:

```txt
src/components/brand/brand-mark.tsx
src/components/brand/brand-lockup.tsx
```

Logo behavior:
- desktop sidebar: icon + full wordmark
- collapsed sidebar: icon only
- login: full wordmark
- mobile header: icon + “Nusa Escape”

---

# 5.3 Typography

## Primary UI font

Use `Manrope` or `Inter` through `next/font/google`.

Recommended:
- `Manrope` for UI and dashboard
- optional `Cormorant Garamond` for selected marketing/hero headings only

Do not use decorative serif typography inside operational tables.

## Typography scale

| Token | Size | Weight | Line-height | Use |
|---|---:|---:|---:|---|
| `display-xl` | 56px | 700 | 1.05 | Login hero only |
| `display-lg` | 40px | 700 | 1.10 | Major marketing heading |
| `heading-1` | 30px | 700 | 1.20 | Page title |
| `heading-2` | 24px | 700 | 1.25 | Section title |
| `heading-3` | 18px | 700 | 1.35 | Card title |
| `body-lg` | 16px | 500 | 1.60 | Main paragraph |
| `body` | 14px | 500 | 1.55 | Standard UI text |
| `caption` | 12px | 600 | 1.45 | Helper text |
| `overline` | 11px | 700 | 1.30 | Uppercase label |

Guidelines:
- Page headings: sentence case
- Avoid all caps except overline labels
- Operational status text must remain readable at 12px minimum
- Main KPI values: 28–36px, bold

---

# 5.4 Color tokens

Implement semantic variables. Do not directly hardcode raw colors repeatedly inside components.

Use `oklch` or hex values mapped to semantic tokens.

```css
/* src/app/globals.css */

:root {
  --background: #f4f0e7;
  --foreground: #16372e;

  --surface: rgba(255, 255, 255, 0.68);
  --surface-strong: rgba(255, 255, 255, 0.88);
  --surface-muted: rgba(245, 241, 231, 0.76);
  --surface-dark: rgba(7, 47, 37, 0.82);

  --primary: #0b4a3a;
  --primary-foreground: #f9f7f0;
  --primary-soft: #d8e5d7;

  --secondary: #b9974d;
  --secondary-foreground: #1d322b;
  --secondary-soft: #f0e4c4;

  --muted: #e9e3d7;
  --muted-foreground: #66766e;

  --accent: #8fb26b;
  --accent-foreground: #17352c;

  --border: rgba(24, 72, 58, 0.14);
  --border-strong: rgba(201, 162, 74, 0.48);

  --success: #40865f;
  --warning: #c99637;
  --danger: #bf5b4e;
  --info: #4b8296;

  --glass-highlight: rgba(255, 255, 255, 0.62);
  --glass-shadow: rgba(11, 74, 58, 0.12);

  --chart-1: #0b4a3a;
  --chart-2: #4e8a70;
  --chart-3: #8fb26b;
  --chart-4: #b9974d;
  --chart-5: #d5c292;

  --radius: 1.25rem;
}

.dark {
  --background: #062b22;
  --foreground: #f6f2e8;

  --surface: rgba(8, 56, 44, 0.62);
  --surface-strong: rgba(9, 63, 49, 0.88);
  --surface-muted: rgba(13, 74, 58, 0.64);
  --surface-dark: rgba(4, 32, 26, 0.92);

  --primary: #a8c891;
  --primary-foreground: #082b23;
  --primary-soft: #154d3e;

  --secondary: #d4b76b;
  --secondary-foreground: #173229;
  --secondary-soft: #4a4025;

  --muted: #15483b;
  --muted-foreground: #b5c7bc;

  --accent: #8fb26b;
  --accent-foreground: #0a2f26;

  --border: rgba(210, 230, 218, 0.14);
  --border-strong: rgba(212, 183, 107, 0.48);

  --success: #76bb8c;
  --warning: #e0b75d;
  --danger: #dc8174;
  --info: #75acc0;
}
```

## Status mapping

| State | Badge color |
|---|---|
| Available / ready / paid / completed | success |
| Pending / assigned / partial | warning |
| Maintenance / urgent / blocked | danger |
| Occupied / in progress | info |
| Cancelled / inactive | muted |

---

# 5.5 Morphglass surfaces

Create 4 surface levels.

## Surface A — app background

Use:
- subtle natural image
- low saturation
- gradient overlay
- avoid noisy images beneath dense content

Desktop background example:

```css
background:
  linear-gradient(135deg, rgba(244,240,231,.92), rgba(232,239,228,.84)),
  url('/images/backgrounds/jungle-mist.webp') center / cover fixed;
```

Dark mode:

```css
background:
  linear-gradient(135deg, rgba(4,35,28,.94), rgba(6,52,41,.86)),
  url('/images/backgrounds/jungle-night.webp') center / cover fixed;
```

## Surface B — primary glass card

```tsx
className="
  rounded-[28px]
  border border-white/45
  bg-white/62
  shadow-[0_16px_50px_rgba(11,74,58,0.10)]
  backdrop-blur-2xl
  dark:border-white/10
  dark:bg-emerald-950/55
"
```

## Surface C — compact glass card

```tsx
className="
  rounded-2xl
  border border-emerald-950/10
  bg-white/70
  shadow-[0_8px_22px_rgba(11,74,58,0.08)]
  backdrop-blur-xl
  dark:border-white/10
  dark:bg-emerald-950/60
"
```

## Surface D — hero glass overlay

Use only in login, dashboard welcome banner, and report summary.

```tsx
className="
  rounded-[32px]
  border border-white/30
  bg-gradient-to-br from-emerald-950/82 to-emerald-900/52
  text-white
  shadow-[0_24px_70px_rgba(4,43,34,0.24)]
  backdrop-blur-2xl
"
```

---

# 5.6 Spacing, radius, and shadow

## Spacing grid

Use 4px base unit.

| Token | Value |
|---|---:|
| `space-1` | 4px |
| `space-2` | 8px |
| `space-3` | 12px |
| `space-4` | 16px |
| `space-5` | 20px |
| `space-6` | 24px |
| `space-8` | 32px |
| `space-10` | 40px |
| `space-12` | 48px |

## Radius

| Use | Radius |
|---|---:|
| Tag / badge | 999px |
| Input / button | 14px |
| Compact card | 18px |
| Standard card | 24px |
| Hero glass card | 32px |

## Shadow levels

```css
--shadow-soft: 0 8px 20px rgba(11, 74, 58, 0.08);
--shadow-card: 0 16px 45px rgba(11, 74, 58, 0.12);
--shadow-floating: 0 24px 70px rgba(4, 43, 34, 0.20);
```

---

# 5.7 Motion design

Motion must feel calm and premium.

## Rules

- Use animation to explain state changes, not decorate everything.
- Default duration: `180ms–280ms`
- Hero transitions: `350ms–500ms`
- Avoid bounce effects.
- Use subtle opacity, transform, and blur transitions.
- Respect `prefers-reduced-motion`.

## Motion patterns

| Interaction | Animation |
|---|---|
| Card hover | translateY(-2px), subtle shadow increase |
| Sidebar collapse | width transition 220ms |
| Dialog open | fade + scale from 0.98 |
| Status badge update | brief highlight glow |
| Kanban move | smooth layout animation |
| Dashboard KPI load | staggered fade-in |
| Toast | slide from bottom-right |
| Page transition | very subtle fade |
| Skeleton | low-contrast shimmer |

Framer Motion variants:

```tsx
export const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] }
  }
}
```

---

# 6. UX Principles

## 6.1 Operational clarity first

Front office and housekeeping users must recognize the next action immediately.

Examples:
- `Check-in` button appears prominently only when booking is eligible.
- `Mark as Ready` appears only after housekeeping reaches inspection.
- Urgent service requests stay pinned at the top.

## 6.2 Reveal complexity progressively

Use drawers, modals, and detail pages.

List pages should remain scannable:
- show only essential information
- open details in a sheet or route
- avoid displaying every field in dense tables

## 6.3 Reduce errors

- Confirm destructive actions
- Show reservation overlap warnings
- Disable invalid transitions
- Explain why an action is unavailable
- Use inline validation
- Show financial amounts clearly

## 6.4 Optimize for daily staff use

- Search is always visible
- Common actions accessible in one click
- Mobile/tablet screens support operational tasks
- Status colors always paired with text labels
- Forms support keyboard navigation

## 6.5 Make owner experience aspirational

Owner dashboard should feel premium:
- rich KPI visualization
- clean empty spaces
- clear trend indicators
- restrained use of gradients
- minimal but informative insights

---

# 7. Information Architecture

## 7.1 Sidebar navigation

```text
Overview
  Dashboard

Operations
  Reservations
  Calendar
  Guests
  Units
  Housekeeping
  Service Requests
  POS & Activities

Insights
  Reports
  Activity Log

System
  Settings
```

## 7.2 Desktop shell

```text
┌───────────────────────────────────────────────────────────────────────────┐
│ Sidebar  │ Header: breadcrumb · search · date · notifications · profile │
│          ├───────────────────────────────────────────────────────────────┤
│          │ Page content                                                  │
│          │                                                               │
│          │                                                               │
└───────────────────────────────────────────────────────────────────────────┘
```

## 7.3 Sidebar behavior

Desktop:
- expanded: `272px`
- collapsed: `84px`
- icon + label
- section headers
- active item: tinted glass background + gold left accent

Tablet:
- collapsed by default
- opens as sheet

Mobile:
- bottom navigation for:
  - Dashboard
  - Reservations
  - Housekeeping
  - Requests
  - More

## 7.4 Header behavior

Include:
- breadcrumb
- global search command palette
- current property
- date
- notifications icon
- dark mode toggle
- user avatar and dropdown

---

# 8. Shared UI Component System

Build these reusable components before page-specific work.

## 8.1 Base components

```text
src/components/ui/
  glass-card.tsx
  glass-panel.tsx
  page-shell.tsx
  page-header.tsx
  section-heading.tsx
  stat-card.tsx
  status-badge.tsx
  trend-badge.tsx
  action-menu.tsx
  empty-state.tsx
  error-state.tsx
  loading-skeleton.tsx
  data-table.tsx
  filter-bar.tsx
  search-input.tsx
  date-range-filter.tsx
  money.tsx
  masked-text.tsx
  confirm-action-dialog.tsx
  stepper.tsx
  activity-timeline.tsx
  quick-action-button.tsx
```

## 8.2 Status badge anatomy

```tsx
<StatusBadge
  tone="success"
  dot
  label="Ready"
/>
```

Rules:
- include text label
- optional dot
- pill radius
- no saturated background
- use soft tinted background
- use readable text

## 8.3 Stat card anatomy

```text
┌───────────────────────────────┐
│ Icon       Label              │
│            72%                │
│            ↑ 12% vs kemarin   │
│ Small sparkline               │
└───────────────────────────────┘
```

Props:

```ts
type StatCardProps = {
  title: string
  value: string
  description?: string
  trend?: { value: number; direction: "up" | "down" | "flat" }
  icon: LucideIcon
  sparkline?: number[]
  tone?: "forest" | "gold" | "sage" | "neutral"
}
```

## 8.4 Empty state examples

Reservation:
> Belum ada reservasi pada periode ini. Buat booking baru atau ubah filter tanggal.

Housekeeping:
> Semua unit siap digunakan. Tidak ada tugas housekeeping yang tertunda.

Guests:
> Database tamu masih kosong. Profil tamu akan tersimpan saat reservasi pertama dibuat.

## 8.5 Error state behavior

- never show raw stack traces
- show human-readable error
- provide retry button
- log technical error server-side

Example:
> Data reservasi belum dapat dimuat. Coba muat ulang beberapa saat lagi.

---

# 9. Page-by-Page UI/UX Specification

# 9.1 Login Page

## Route

```text
/login
```

## Goal

Create a strong premium first impression while keeping the login flow simple.

## Layout

Desktop:
- 58% visual area with eco-glamping hero photo
- 42% login area
- morphglass login card
- brand logo
- email/password
- show/hide password
- remember me
- submit
- discreet footer

Mobile:
- background image full screen
- centered glass card
- simplified hero text

## Hero text

```text
Smart Hospitality,
Naturally Connected.

Kelola operasional glamping dengan lebih rapi,
cepat, dan terukur.
```

## Visual treatment

- soft dark green overlay over hero image
- warm lantern light image
- subtle gold brand mark
- no clutter

## Login error message

```text
Email atau kata sandi tidak sesuai.
```

## Development-only credentials panel

Only render in `NODE_ENV=development`.

---

# 9.2 Dashboard — Owner Command Center

## Route

```text
/dashboard
```

## Goal

Allow the owner or manager to understand the business in less than 30 seconds.

## Desktop layout

### A. Welcome hero

```text
Good morning, Budi
Today, 8 of 12 units are occupied.
3 guests are arriving and 2 units need housekeeping attention.
```

UI:
- hero glass overlay
- subtle background image
- weather placeholder disabled until implemented
- three quick actions:
  - New Reservation
  - Check-in Guest
  - View Housekeeping

### B. KPI row

Cards:
1. Occupancy today
2. Revenue today
3. Booking this month
4. Pending requests

### C. Main charts row

Left: Occupancy trend  
Right: Revenue trend

### D. Operational row

Left: Unit status donut  
Center: Arrivals / departures tabs  
Right: Priority task list

### E. Bottom row

Left: Booking source chart  
Right: Recent activity timeline

## Dashboard card behavior

- hover: lift 2px
- cards clickable when meaningful
- clicking dirty unit stat opens `/housekeeping?status=DIRTY`
- clicking pending requests opens `/service-requests?status=OPEN`

## Loading state

Use skeleton cards preserving layout height.

## Empty state

Seed realistic demo data so the dashboard is not empty in development.

---

# 9.3 Reservations List

## Route

```text
/reservations
```

## Page header

```text
Reservasi
Kelola booking, status pembayaran, serta jadwal kedatangan tamu.
```

Primary action:
```text
+ Buat Reservasi
```

## Filter bar

- date range
- status
- payment status
- booking source
- unit type
- search guest / booking code
- reset filter

## Desktop table columns

| Column | Behavior |
|---|---|
| Booking code | monospace-like small text, clickable |
| Guest | avatar initials + name + phone |
| Unit | unit code + type |
| Stay dates | formatted check-in → check-out |
| Nights | number |
| Status | badge |
| Payment | badge |
| Source | icon + label |
| Total | IDR format |
| Actions | dropdown |

## Tablet/mobile

Use stacked reservation cards:
- booking code
- guest
- date
- unit
- status
- total
- primary quick action

## Row click

Open reservation detail.

## Actions dropdown

- View detail
- Edit
- Check-in
- Check-out
- Open WhatsApp
- Cancel reservation

Disable invalid actions with tooltip explanation.

---

# 9.4 Create / Edit Reservation

## Routes

```text
/reservations/new
/reservations/[id]/edit
```

## Design

Use a 3-step flow.

### Step 1 — Stay details
- check-in date
- check-out date
- guest count
- unit type
- available unit cards

### Step 2 — Guest
- search existing guest
- create new guest inline
- contact
- preferences
- notes

### Step 3 — Payment and confirmation
- room rate
- extras placeholder
- discount
- total
- payment status
- booking source
- notes
- confirmation summary

## Available unit card

```text
[photo]
Premium Dome PD-01
Capacity: 2 adults
Base rate: Rp 1.850.000
[Available]
```

## Double-booking behavior

If selected date overlaps:
- hide unavailable units by default
- allow filter “show unavailable”
- show reason:
  - occupied by booking
  - maintenance
  - out of order

## Form UX

- autosave optional later
- sticky summary on desktop
- inline validation
- back/next buttons
- save as pending
- confirm booking

---

# 9.5 Reservation Detail

## Route

```text
/reservations/[id]
```

## Top section

- booking code
- status badge
- guest name
- unit
- stay dates
- primary action based on status
- action menu

## Main layout

Left:
- booking information
- guest detail
- stay summary
- financial summary

Right:
- timeline
- service requests
- orders
- internal notes
- WhatsApp quick action

## Timeline example

```text
20 May · 09:42
Reservation confirmed by Front Office

21 May · 14:07
Guest checked in to PD-01

21 May · 19:20
Romantic dinner ordered
```

---

# 9.6 Calendar View

## Route

```text
/calendar
```

## Goal

Visual occupancy map by date and unit.

## MVP grid

Rows:
- units

Columns:
- days

Reservation blocks:
- colored by status
- show guest surname
- show source icon on hover
- click to detail

## Toolbar

- previous / next period
- today
- 7 days / 14 days / month
- unit type filter
- status filter
- legend

## UI rule

Grid must remain readable.
Avoid overly dense booking text.

## Later enhancement

Drag and drop reservation changes after audit log and conflict checks are stable.

---

# 9.7 Guest CRM List

## Route

```text
/guests
```

## Header

```text
Guest CRM
Simpan riwayat tamu, preferensi, dan nilai hubungan pelanggan.
```

## Views

- table view
- card view optional

## Table columns

- guest name
- phone / email
- country
- guest type
- total visits
- last stay
- lifetime spend
- preferences
- actions

## Privacy

- mask ID / passport in lists
- reveal only on detail view based on permission
- do not display sensitive document numbers by default

---

# 9.8 Guest Profile

## Route

```text
/guests/[id]
```

## Hero card

- guest name
- country
- guest type
- lifetime spend
- visits count
- WhatsApp button
- email button

## Tabs

1. Overview
2. Stay history
3. Spending
4. Requests
5. Notes

## Overview blocks

- contact
- preferences
- special notes
- recent stay
- favorite extras
- feedback placeholder

---

# 9.9 Units Board

## Route

```text
/units
```

## Header

```text
Unit & Room Status
Pantau kesiapan seluruh unit secara real-time.
```

## Summary chips

- Available
- Occupied
- Dirty
- Cleaning
- Ready
- Maintenance

## Cards

Each unit card:

```text
[Photo thumbnail]
PD-01 · Premium Dome
[READY]
Capacity 2 guests
Next arrival: 20 May · 14:00
Housekeeping: complete
[View] [Update Status]
```

## Visual behavior

- image area ratio 16:9
- subtle overlay
- status badge
- contextual border
- hover reveal quick actions

## Mobile

Two-column compact layout when possible.

---

# 9.10 Housekeeping Kanban

## Route

```text
/housekeeping
```

## Goal

Make cleaning readiness instantly visible.

## Columns

1. Dirty
2. Assigned
3. In Progress
4. Inspection
5. Ready
6. Blocked

## Task card anatomy

```text
PD-01 · Premium Dome
Priority: High
Checkout: 11:00
Next arrival: 14:00
Assigned: Made
[Start Cleaning]
```

## Card indicators

- time until next check-in
- priority
- assigned staff
- notes count
- maintenance warning
- before/after photo later

## Drag and drop

Allowed:
- assigned → in progress
- in progress → inspection
- inspection → ready

Blocked transitions:
- dirty → ready directly
- blocked → ready without resolution

On transition:
- update DB
- create activity log
- update unit status
- show toast

## Mobile

Use tabbed columns and swipe-friendly cards.

---

# 9.11 Check-in Wizard

## Route

```text
/check-in/[reservationId]
```

## Steps

1. Reservation verification
2. Guest verification
3. Payment confirmation
4. Unit readiness
5. Final confirmation

## UX rules

- clear stepper
- show warnings early
- prevent check-in when unit not ready
- permit manager override only with logged reason
- final screen shows:
  - room
  - guest name
  - stay dates
  - WhatsApp greeting quick link

---

# 9.12 Check-out Wizard

## Route

```text
/check-out/[reservationId]
```

## Steps

1. Stay summary
2. Extra charges
3. Payment summary
4. Final confirmation

## After completion

Automatically:
- reservation → checked out
- unit → dirty
- housekeeping task → created
- activity log → added
- guest stay history → updated
- optional review WhatsApp quick link → displayed

---

# 9.13 Service Requests

## Route

```text
/service-requests
```

## Views

- list
- board
- priority queue

## Categories

- housekeeping
- room service
- F&B order
- transport
- activity
- maintenance
- complaint
- special request
- other

## Request card

```text
#SR-1024
Extra towel
PD-01 · John Smith
[HIGH] [OPEN]
Created 8 minutes ago
[Assign] [Start] [Complete]
```

## SLA UI

Show elapsed time:
- green: < 10 minutes
- amber: 10–25 minutes
- red: > 25 minutes

Use labels and icons in addition to color.

---

# 9.14 POS & Activities

## Routes

```text
/pos
/pos/items
/pos/orders
/activities
```

## Item catalog view

Cards with:
- image
- name
- category
- price
- active status
- edit action

## Categories

- Food
- Beverage
- Spa
- Activity
- Transport
- Package
- Merchandise

## Suggested seeded items

| Category | Item | Price |
|---|---|---:|
| Package | Floating Breakfast | Rp 350.000 |
| Package | Romantic Dinner | Rp 850.000 |
| F&B | BBQ Night | Rp 450.000 |
| Activity | Yoga Session | Rp 150.000 |
| Spa | Couple Spa Treatment | Rp 750.000 |
| Activity | Jeep Sunrise Tour | Rp 650.000 |
| Activity | ATV Ride | Rp 500.000 |
| Transport | Airport Pickup | Rp 450.000 |

## Create order flow

1. select reservation or guest
2. select item
3. quantity
4. optional notes
5. calculate amount
6. payment status
7. fulfillment status
8. submit

---

# 9.15 Reports

## Route

```text
/reports
```

## MVP report cards

- Daily occupancy
- Daily revenue
- Monthly revenue
- Booking sources
- Unit performance
- Service request SLA
- Housekeeping turnaround
- Guest segments

## Report UX

- date filter
- export CSV
- printable summary later
- summary KPI row
- chart
- supporting table

---

# 9.16 Settings

## Route

```text
/settings
```

## Tabs

1. Property
2. Units
3. Team
4. Branding
5. WhatsApp templates
6. AI configuration
7. System

## Branding tab

Allow:
- property name
- logo placeholder
- accent color constrained to approved palette
- contact
- social links
- address

## AI settings tab

V1 placeholder:
- enable/disable
- API key status only, not reveal key
- primary model
- fallback model
- feature flags
- prompt test later

---

# 10. Data Model

Create a robust Prisma schema.

```prisma
enum UserRole {
  OWNER
  MANAGER
  FRONT_OFFICE
  HOUSEKEEPING
  FNB_ACTIVITY
  VIEWER
}

enum UnitStatus {
  AVAILABLE
  OCCUPIED
  DIRTY
  CLEANING
  READY
  MAINTENANCE
  OUT_OF_ORDER
}

enum ReservationStatus {
  PENDING
  CONFIRMED
  CHECKED_IN
  CHECKED_OUT
  CANCELLED
  NO_SHOW
}

enum BookingSource {
  DIRECT_WEBSITE
  WHATSAPP
  WALK_IN
  BOOKING_COM
  AIRBNB
  AGODA
  TRAVEL_AGENT
  OTHER
}

enum PaymentStatus {
  UNPAID
  PARTIAL
  PAID
  REFUNDED
}

enum HousekeepingStatus {
  DIRTY
  ASSIGNED
  IN_PROGRESS
  INSPECTION
  READY
  BLOCKED
}

enum Priority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

enum RequestType {
  HOUSEKEEPING
  ROOM_SERVICE
  FNB_ORDER
  TRANSPORT
  ACTIVITY
  MAINTENANCE
  SPECIAL_REQUEST
  COMPLAINT
  OTHER
}

enum RequestStatus {
  OPEN
  ASSIGNED
  IN_PROGRESS
  WAITING_GUEST
  COMPLETED
  CANCELLED
}

enum PosCategory {
  FOOD
  BEVERAGE
  SPA
  ACTIVITY
  TRANSPORT
  PACKAGE
  MERCHANDISE
}

enum OrderStatus {
  OPEN
  CONFIRMED
  PREPARING
  DELIVERED
  COMPLETED
  CANCELLED
}

model Property {
  id           String   @id @default(cuid())
  name         String
  slug         String   @unique
  address      String?
  phone        String?
  email        String?
  logoUrl      String?
  timezone     String   @default("Asia/Makassar")
  currency     String   @default("IDR")
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  units Unit[]
  users User[]
}

model User {
  id           String   @id @default(cuid())
  propertyId   String
  name         String
  email        String   @unique
  passwordHash String
  role         UserRole
  avatarUrl    String?
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  property Property @relation(fields: [propertyId], references: [id])
}

model Guest {
  id          String    @id @default(cuid())
  fullName    String
  email       String?
  phone       String?
  country     String?
  city        String?
  idType      String?
  idNumber    String?
  birthday    DateTime?
  guestType   String    @default("GENERAL")
  preferences String?
  notes       String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  reservations Reservation[]
  serviceRequests ServiceRequest[]
  orders Order[]
}

model UnitType {
  id          String   @id @default(cuid())
  propertyId  String
  name        String
  description String?
  capacity    Int
  baseRate    Decimal  @db.Decimal(14, 2)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  units Unit[]
}

model Unit {
  id          String     @id @default(cuid())
  propertyId  String
  unitTypeId  String
  code        String     @unique
  name        String
  status      UnitStatus @default(AVAILABLE)
  description String?
  amenities   Json?
  photoUrl    String?
  notes       String?
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  property Property @relation(fields: [propertyId], references: [id])
  unitType UnitType @relation(fields: [unitTypeId], references: [id])
  reservations Reservation[]
  housekeepingTasks HousekeepingTask[]
}

model Reservation {
  id            String            @id @default(cuid())
  bookingCode   String            @unique
  guestId       String
  unitId        String?
  checkInDate   DateTime
  checkOutDate  DateTime
  adults        Int               @default(1)
  children      Int               @default(0)
  status        ReservationStatus @default(PENDING)
  source        BookingSource     @default(WHATSAPP)
  paymentStatus PaymentStatus     @default(UNPAID)
  roomRate      Decimal           @db.Decimal(14, 2)
  discount      Decimal           @default(0) @db.Decimal(14, 2)
  totalAmount   Decimal           @db.Decimal(14, 2)
  notes         String?
  createdAt     DateTime          @default(now())
  updatedAt     DateTime          @updatedAt

  guest Guest @relation(fields: [guestId], references: [id])
  unit  Unit? @relation(fields: [unitId], references: [id])
  serviceRequests ServiceRequest[]
  orders Order[]

  @@index([checkInDate, checkOutDate])
  @@index([status])
}

model HousekeepingTask {
  id          String             @id @default(cuid())
  unitId      String
  assignedTo  String?
  taskType    String
  status      HousekeepingStatus @default(DIRTY)
  priority    Priority           @default(MEDIUM)
  dueAt       DateTime?
  startedAt   DateTime?
  completedAt DateTime?
  notes       String?
  createdAt   DateTime           @default(now())
  updatedAt   DateTime           @updatedAt

  unit Unit @relation(fields: [unitId], references: [id])

  @@index([status])
  @@index([dueAt])
}

model ServiceRequest {
  id             String        @id @default(cuid())
  code           String        @unique
  reservationId  String?
  guestId        String?
  type           RequestType
  title          String
  description    String?
  status         RequestStatus @default(OPEN)
  priority       Priority      @default(MEDIUM)
  assignedTo     String?
  internalNotes  String?
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt
  completedAt    DateTime?

  reservation Reservation? @relation(fields: [reservationId], references: [id])
  guest Guest? @relation(fields: [guestId], references: [id])

  @@index([status])
  @@index([priority])
}

model PosItem {
  id          String      @id @default(cuid())
  name        String
  category    PosCategory
  price       Decimal     @db.Decimal(14, 2)
  description String?
  photoUrl    String?
  isActive    Boolean     @default(true)
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
}

model Order {
  id             String        @id @default(cuid())
  code           String        @unique
  reservationId  String?
  guestId        String?
  status         OrderStatus   @default(OPEN)
  paymentStatus  PaymentStatus @default(UNPAID)
  subtotal       Decimal       @db.Decimal(14, 2)
  discount       Decimal       @default(0) @db.Decimal(14, 2)
  tax            Decimal       @default(0) @db.Decimal(14, 2)
  total          Decimal       @db.Decimal(14, 2)
  notes          String?
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt

  reservation Reservation? @relation(fields: [reservationId], references: [id])
  guest Guest? @relation(fields: [guestId], references: [id])
  items OrderItem[]
}

model OrderItem {
  id        String  @id @default(cuid())
  orderId   String
  itemId    String
  name      String
  quantity  Int
  price     Decimal @db.Decimal(14, 2)
  total     Decimal @db.Decimal(14, 2)

  order Order @relation(fields: [orderId], references: [id])
}

model ActivityLog {
  id          String   @id @default(cuid())
  actorId     String?
  action      String
  entityType  String
  entityId    String?
  description String?
  metadata    Json?
  createdAt   DateTime @default(now())

  @@index([createdAt])
}
```

---

# 11. Business Rules

## 11.1 Reservation overlap

Before create or update:
- selected unit cannot have an overlapping active reservation
- active statuses:
  - `PENDING`
  - `CONFIRMED`
  - `CHECKED_IN`
- cancelled and no-show should not block availability
- units in `MAINTENANCE` or `OUT_OF_ORDER` cannot be assigned

Overlap formula:

```ts
existing.checkInDate < newCheckOutDate &&
existing.checkOutDate > newCheckInDate
```

## 11.2 Check-in

Allowed only if:
- reservation status = `CONFIRMED`
- unit assigned
- unit = `READY` or `AVAILABLE`
- payment status = `PAID` or `PARTIAL`

Manager override:
- require override reason
- create activity log

On success:
- reservation → `CHECKED_IN`
- unit → `OCCUPIED`
- create log

## 11.3 Check-out

Allowed only if:
- reservation = `CHECKED_IN`

On success:
- reservation → `CHECKED_OUT`
- unit → `DIRTY`
- create housekeeping task
- create activity log

## 11.4 Housekeeping

Transitions:

```text
DIRTY → ASSIGNED → IN_PROGRESS → INSPECTION → READY
                     ↓
                  BLOCKED
```

When ready:
- housekeeping task → `READY`
- unit → `READY`
- log status change

## 11.5 Occupancy

```ts
occupancyRate =
  occupiedUnitsToday / activeUnits * 100
```

## 11.6 Revenue

MVP:

```ts
roomRevenue =
  sum(reservation.totalAmount where paymentStatus in [PARTIAL, PAID])

extraRevenue =
  sum(order.total where paymentStatus in [PARTIAL, PAID])

totalRevenue =
  roomRevenue + extraRevenue
```

---

# 12. API and Server Action Map

Use server actions where practical and route handlers where integrations or explicit API endpoints are useful.

## Dashboard

```text
GET /api/dashboard/summary
GET /api/dashboard/occupancy-trend
GET /api/dashboard/revenue-trend
GET /api/dashboard/unit-status
GET /api/dashboard/upcoming-arrivals
GET /api/dashboard/priority-tasks
```

## Reservations

```text
GET    /api/reservations
POST   /api/reservations
GET    /api/reservations/:id
PATCH  /api/reservations/:id
POST   /api/reservations/:id/check-in
POST   /api/reservations/:id/check-out
POST   /api/reservations/:id/cancel
GET    /api/reservations/availability
```

## Guests

```text
GET    /api/guests
POST   /api/guests
GET    /api/guests/:id
PATCH  /api/guests/:id
```

## Units

```text
GET    /api/units
POST   /api/units
GET    /api/units/:id
PATCH  /api/units/:id
PATCH  /api/units/:id/status
```

## Housekeeping

```text
GET    /api/housekeeping/tasks
POST   /api/housekeeping/tasks
PATCH  /api/housekeeping/tasks/:id
POST   /api/housekeeping/tasks/:id/assign
POST   /api/housekeeping/tasks/:id/start
POST   /api/housekeeping/tasks/:id/inspection
POST   /api/housekeeping/tasks/:id/ready
POST   /api/housekeeping/tasks/:id/block
```

## Requests

```text
GET    /api/service-requests
POST   /api/service-requests
PATCH  /api/service-requests/:id
POST   /api/service-requests/:id/assign
POST   /api/service-requests/:id/complete
```

## POS

```text
GET    /api/pos/items
POST   /api/pos/items
PATCH  /api/pos/items/:id
GET    /api/pos/orders
POST   /api/pos/orders
PATCH  /api/pos/orders/:id
```

---

# 13. Application Folder Structure

```text
smart-glamping-os/
├─ src/
│  ├─ app/
│  │  ├─ (auth)/
│  │  │  └─ login/
│  │  │     └─ page.tsx
│  │  ├─ (dashboard)/
│  │  │  ├─ layout.tsx
│  │  │  ├─ dashboard/page.tsx
│  │  │  ├─ reservations/
│  │  │  │  ├─ page.tsx
│  │  │  │  ├─ new/page.tsx
│  │  │  │  └─ [id]/
│  │  │  │     ├─ page.tsx
│  │  │  │     └─ edit/page.tsx
│  │  │  ├─ calendar/page.tsx
│  │  │  ├─ guests/
│  │  │  │  ├─ page.tsx
│  │  │  │  ├─ new/page.tsx
│  │  │  │  └─ [id]/page.tsx
│  │  │  ├─ units/
│  │  │  │  ├─ page.tsx
│  │  │  │  ├─ new/page.tsx
│  │  │  │  └─ [id]/page.tsx
│  │  │  ├─ housekeeping/page.tsx
│  │  │  ├─ service-requests/page.tsx
│  │  │  ├─ pos/
│  │  │  │  ├─ page.tsx
│  │  │  │  ├─ items/page.tsx
│  │  │  │  └─ orders/page.tsx
│  │  │  ├─ reports/page.tsx
│  │  │  ├─ activity-log/page.tsx
│  │  │  └─ settings/page.tsx
│  │  ├─ api/
│  │  ├─ globals.css
│  │  ├─ layout.tsx
│  │  └─ page.tsx
│  ├─ components/
│  │  ├─ brand/
│  │  ├─ layout/
│  │  ├─ ui/
│  │  ├─ dashboard/
│  │  ├─ reservation/
│  │  ├─ guests/
│  │  ├─ units/
│  │  ├─ housekeeping/
│  │  ├─ requests/
│  │  ├─ pos/
│  │  └─ reports/
│  ├─ lib/
│  │  ├─ auth.ts
│  │  ├─ prisma.ts
│  │  ├─ permissions.ts
│  │  ├─ formatters.ts
│  │  ├─ validation/
│  │  ├─ services/
│  │  └─ openrouter.ts
│  └─ types/
├─ prisma/
│  ├─ schema.prisma
│  └─ seed.ts
├─ public/
│  ├─ images/
│  │  ├─ backgrounds/
│  │  ├─ units/
│  │  └─ items/
│  └─ logo/
├─ docker-compose.yml
├─ Dockerfile
├─ nginx/
│  └─ default.conf
├─ .env.example
├─ README.md
├─ CHANGELOG.md
└─ BLUEPRINT.md
```

---

# 14. Seed Data

## 14.1 Property

```text
Nusa Escape Glamping
Bali, Indonesia
Timezone: Asia/Makassar
Currency: IDR
```

## 14.2 Users

```text
owner@nusaescape.local
manager@nusaescape.local
frontoffice@nusaescape.local
housekeeping@nusaescape.local
fnb@nusaescape.local
```

Development password:
```text
password123
```

Never use this password in production.

## 14.3 Units

| Code | Type | Name |
|---|---|---|
| DD-01 | Deluxe Dome | Deluxe Dome 01 |
| DD-02 | Deluxe Dome | Deluxe Dome 02 |
| DD-03 | Deluxe Dome | Deluxe Dome 03 |
| DD-04 | Deluxe Dome | Deluxe Dome 04 |
| PD-01 | Premium Dome | Premium Dome 01 |
| PD-02 | Premium Dome | Premium Dome 02 |
| FD-01 | Family Dome | Family Dome 01 |
| FD-02 | Family Dome | Family Dome 02 |
| JV-01 | Jungle Villa | Jungle Villa 01 |
| JV-02 | Jungle Villa | Jungle Villa 02 |
| ST-01 | Suite Tent | Suite Tent 01 |
| ST-02 | Suite Tent | Suite Tent 02 |

## 14.4 Realistic dashboard demo

Seed:
- 12 units
- 8 occupied
- 2 ready
- 1 cleaning
- 1 maintenance
- arrivals today: 3
- departures today: 2
- revenue today: around Rp 18–25 million
- 10 service requests mixed status
- 12 housekeeping tasks mixed status
- 25+ guests
- 30+ reservations
- 15+ orders

---

# 15. AI Preparation

AI is not autonomous in V1.

## 15.1 OpenRouter wrapper

File:

```text
src/lib/openrouter.ts
```

Environment:

```env
OPENROUTER_API_KEY=
OPENROUTER_PRIMARY_MODEL=
OPENROUTER_FALLBACK_MODELS=
OPENROUTER_SITE_NAME=Nusa Escape Smart Glamping OS
OPENROUTER_ENABLED=false
```

## 15.2 Future use cases

1. AI Concierge
2. Daily manager briefing
3. Review sentiment analysis
4. Suggested upselling
5. Service request classification
6. Demand and occupancy insight
7. FAQ response assistant

## 15.3 Guardrails

AI must never:
- confirm booking without live availability
- reveal internal notes
- reveal other guest data
- modify financial value without explicit confirmation
- promise unavailable service
- bypass permissions
- send outbound WhatsApp automatically in V1

---

# 16. WhatsApp Preparation

V1:
- store phone number
- provide quick link
- provide templated message copy buttons

Quick link:

```ts
const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
```

Templates:
- booking confirmation
- payment reminder
- check-in reminder
- welcome message
- checkout thank-you
- review request

Future:
- WhatsApp Cloud API
- inbound guest conversation
- AI assistant
- conversation history
- human handoff

---

# 17. Security

## Authentication
- password hash: bcrypt or argon2
- secure HTTP-only cookies
- session expiration
- rate limit login attempts
- no password logging

## Authorization
- enforce permissions server-side
- never trust hidden UI alone
- restrict guest sensitive data
- mask identity number

## Data
- daily DB backup
- environment secrets outside repo
- HTTPS production only
- file upload type validation
- size limits
- audit log

## Activity log events

- login
- reservation create/update/cancel
- check-in
- check-out
- payment status update
- unit status update
- housekeeping update
- request assignment
- request completion
- POS order update
- settings update

---

# 18. Deployment

## 18.1 VPS

Recommended:
- Ubuntu LTS
- 4 vCPU
- 8 GB RAM
- 160 GB SSD

Minimum for early MVP:
- 2 vCPU
- 4 GB RAM
- 80 GB SSD

## 18.2 Docker Compose services

```text
app
postgres
nginx
```

Later:
```text
redis
worker
backup
```

## 18.3 `.env.example`

```env
NODE_ENV=production
DATABASE_URL=postgresql://postgres:change-me@postgres:5432/smart_glamping
AUTH_SECRET=change-me
NEXTAUTH_URL=https://your-domain.com

OPENROUTER_ENABLED=false
OPENROUTER_API_KEY=
OPENROUTER_PRIMARY_MODEL=
OPENROUTER_FALLBACK_MODELS=

R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
R2_ENDPOINT=
```

## 18.4 Deployment commands

```bash
git clone https://github.com/YOUR-ORG/smart-glamping-os.git
cd smart-glamping-os

cp .env.example .env
nano .env

docker compose up -d --build
docker compose exec app npx prisma migrate deploy
docker compose exec app npx prisma db seed

docker compose logs -f app
```

## 18.5 Health checks

Add:
- DB readiness
- app HTTP health endpoint
- restart policy
- named volume for DB
- backup script

---

# 19. Delivery Milestones

# Milestone 0 — Repository and visual foundation

Duration: 2–3 days

Deliver:
- Next.js project
- Tailwind
- shadcn/ui
- theme tokens
- typography
- app shell
- sidebar
- header
- mobile navigation
- glass components
- README
- env example

Acceptance:
- login screen matches morphglass direction
- dashboard shell feels custom, not generic

# Milestone 1 — Database and authentication

Duration: 3–4 days

Deliver:
- Prisma
- PostgreSQL
- schema
- migrations
- seed
- login
- roles
- permissions

# Milestone 2 — Core master data

Duration: 4–5 days

Deliver:
- unit type CRUD
- unit CRUD
- guest CRUD
- unit board
- guest list and profile

# Milestone 3 — Reservations

Duration: 5–7 days

Deliver:
- reservation list
- create wizard
- edit
- availability
- double-booking protection
- detail page
- calendar MVP

# Milestone 4 — Check-in/out and housekeeping

Duration: 5–7 days

Deliver:
- check-in wizard
- checkout wizard
- unit transitions
- housekeeping auto-task
- housekeeping Kanban
- drag and drop
- status log

# Milestone 5 — Requests, POS, and dashboard

Duration: 5–7 days

Deliver:
- service requests
- POS catalog
- orders
- dashboard KPI
- charts
- priority tasks
- arrivals/departures

# Milestone 6 — Reports, polish, and deployment

Duration: 5–7 days

Deliver:
- reports
- activity log
- responsive polish
- accessibility pass
- empty states
- loading skeletons
- error handling
- Docker
- VPS deployment

---

# 20. Acceptance Criteria

## Visual quality
- consistent morphglass design
- forest / cream / gold palette
- clean responsive layout
- meaningful hover and motion
- no generic admin template feel
- no excessive gradients or noise
- no low-contrast labels

## Dashboard
- KPI based on DB data
- charts populated with seed data
- cards link to filtered pages
- arrivals, departures, and tasks visible

## Reservation
- create works
- edit works
- overlap prevented
- invalid status transitions blocked
- availability query works
- mobile card view usable

## Guest CRM
- create/edit profile
- history visible
- contact actions
- sensitive ID masked

## Housekeeping
- checkout creates cleaning task
- dirty status set
- ready transition updates unit
- blocked state available
- mobile usability acceptable

## Security
- authenticated routes protected
- permissions server-side
- password hashed
- logs stored
- secrets outside Git

## Deployment
- Docker starts cleanly
- migration works
- seed works
- HTTPS prepared
- DB persistent

---

# 21. Codex Execution Prompt

Copy this into Codex after uploading this blueprint:

```text
You are building Smart Glamping OS V1.

Read BLUEPRINT.md completely before coding.

This is a design-driven production MVP. Do not use a generic admin template. Implement the Morphglass Nature Premium visual system exactly as described:
- forest green
- cream
- warm gold
- soft glass panels
- subtle shadows
- calm nature-inspired backgrounds
- responsive layouts
- restrained microinteractions

Start with Milestone 0 only:
1. initialize Next.js App Router with TypeScript and Tailwind
2. initialize shadcn/ui
3. create semantic design tokens
4. create fonts and global styles
5. create BrandMark and BrandLockup
6. create AppShell, Sidebar, Header, MobileBottomNav
7. create GlassCard, StatCard, StatusBadge, EmptyState, ErrorState, Skeleton components
8. build a polished Login screen
9. build the Dashboard shell using realistic static demo data
10. create README and CHANGELOG

Before continuing to Milestone 1:
- run npm lint
- run typecheck
- run production build
- take screenshots of login and dashboard
- review visual quality against BLUEPRINT.md

Do not implement all modules at once.
Work milestone by milestone.
```

---

# 22. Codex Quality Gate Prompt

Use after each milestone:

```text
Review the current implementation against BLUEPRINT.md.

Check:
1. visual consistency
2. morphglass component reuse
3. spacing and typography
4. responsive behavior
5. loading, empty, and error states
6. accessibility labels
7. TypeScript safety
8. validation
9. permission enforcement
10. database migration and seed status
11. lint and build errors
12. production readiness

Fix issues before starting the next milestone.
Do not add unrelated features.
```

---

# 23. Git Workflow

Branches:

```text
main
develop
feature/ui-foundation
feature/auth
feature/units-guests
feature/reservations
feature/housekeeping
feature/requests-pos
feature/dashboard-reports
chore/deployment
```

Commit convention:

```text
feat(ui): add morphglass stat card
feat(reservation): add overlap validation
fix(housekeeping): prevent invalid ready transition
chore(deploy): add nginx docker config
docs: update blueprint progress
```

---

# 24. Repository Checklist

Create these files:

```text
README.md
BLUEPRINT.md
CHANGELOG.md
.env.example
Dockerfile
docker-compose.yml
nginx/default.conf
scripts/backup.sh
scripts/deploy.sh
```

README must contain:
- product description
- screenshots placeholder
- requirements
- local setup
- env setup
- migration
- seed
- Docker
- production deploy
- demo credentials
- roadmap

---

# 25. Visual QA Checklist

Before demo, verify:

## Login
- background sharp enough
- glass card readable
- logo visible
- form alignment correct
- mobile view clean

## Dashboard
- KPI cards balanced
- chart heights aligned
- no empty areas that look accidental
- cards clickable
- icons consistent
- dark mode acceptable

## Reservation
- table readable
- action buttons clear
- create wizard easy to follow
- mobile cards not crowded

## Housekeeping
- columns readable
- cards have next-arrival urgency
- drag/drop smooth
- mobile tab mode works

## General
- no raw untranslated labels
- IDR currency formatting
- Indonesian date formatting
- all statuses human-readable
- toasts visible
- skeletons use same layout as loaded state

---

# 26. Reference Documentation

Use official documentation when implementing:

- Next.js App Router: https://nextjs.org/docs/app
- shadcn/ui: https://ui.shadcn.com/docs
- shadcn/ui theming: https://ui.shadcn.com/docs/theming
- Tailwind CSS theme variables: https://tailwindcss.com/docs/theme
- Prisma ORM: https://www.prisma.io/docs
- Prisma PostgreSQL quickstart: https://www.prisma.io/docs/prisma-orm/quickstart/postgresql
- Auth.js: https://authjs.dev/getting-started
- Docker Compose: https://docs.docker.com/compose/
- Cloudflare R2 S3 compatibility: https://developers.cloudflare.com/r2/api/s3/
- OpenRouter API reference: https://openrouter.ai/docs/api/reference/overview
- OpenRouter model fallback: https://openrouter.ai/docs/guides/routing/model-fallbacks

---

# 27. Final Build Philosophy

Do not begin with AI.

Begin with clean operational data and a UI staff actually enjoy using.

The first product wins are:

1. No double booking
2. Clear availability
3. Faster front-office workflow
4. Reliable check-in/out
5. Housekeeping controlled
6. Owner dashboard visible
7. Guest history stored
8. Requests tracked
9. Revenue extras captured
10. Foundation ready for AI

Once operational data is structured, AI becomes useful rather than decorative.
