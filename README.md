# Smart Glamping OS V1

Nusa Escape Smart Glamping OS is a design-driven MVP for premium glamping operations. The current implementation follows the V1 blueprint plus the `styleupdate/SMART_GLAMPING_OS_UIUX_REDESIGN_UPDATE.md` refresh: dark command-center shell, cyan/teal morphglass UI, live dashboard surfaces, and role-aware operational navigation.

## Current Scope

- Next.js App Router with strict TypeScript
- Tailwind CSS 4 design tokens
- Styleupdate dark command-center visual direction
- Brand mark and lockup
- Grouped desktop sidebar, compact operations header, and mobile bottom navigation
- Console-style login screen
- Owner dashboard with live database-backed demo data
- Unit Type and Unit master data connected to PostgreSQL
- Guest CRM list, create, detail, and edit flows connected to PostgreSQL
- Reservation list, create, detail, edit, cancel, check-in wizard, check-out wizard, and operational calendar flows connected to PostgreSQL
- Calendar reschedule controls plus unit maintenance/private block creation and release flows
- Housekeeping kanban, task creation, task transitions, and unit readiness sync connected to PostgreSQL
- Service request queue plus POS catalog and order flows connected to PostgreSQL
- Dashboard KPIs and charts backed by live database summaries
- Reports page with live operational summaries and CSV export
- Settings administration for property profile, team access, role matrix, and readiness checks
- Guest communication preparation with WhatsApp quick links, message templates, and communication logs
- AI preparation with OpenRouter configuration, feature flags, prompt placeholders, and V1 human-review guardrails
- Activity log audit trail with filters, CSV export, and role-aware navigation

## Requirements

- Node.js 24+
- npm 11+

## Local Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Open:

```text
http://localhost:3000
```

## Verification

```bash
npm run lint
npm run typecheck
npm run build
```

Browser smoke tests are available after the app server is running:

```bash
npm run dev
npm run test:e2e
```

For staging or production targets:

```bash
E2E_BASE_URL=https://your-domain.example npm run test:e2e
```

See `docs/PRODUCTION_READINESS.md` for the go-live checklist.

GitHub Actions CI runs typecheck, lint, build, database seed, and Playwright E2E against a PostgreSQL service.

## Production Docker Preview

Copy the production environment template and fill the secrets:

```bash
cp .env.production.example .env.production
nano .env.production
```

Start the production stack:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

Prepare the database on first deploy:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec app npm run db:push
docker compose --env-file .env.production -f docker-compose.prod.yml exec app npm run db:seed
```

Health check:

```bash
curl http://localhost/api/health
```

## Demo Credentials

Development-only display on the login screen:

```text
owner@nusaescape.local
password123
```

Authentication is wired through custom credentials, bcrypt password hashes, and an HTTP-only session cookie. Server-side module permissions are enforced across implemented operational modules.

## Database Setup

Milestone 1 uses PostgreSQL through Prisma 7.

```bash
docker compose up -d postgres
npm run db:push
npm run db:seed
```

Useful database commands:

```bash
npm run db:generate
npm run db:seed:messages
npm run db:seed:ai
npm run db:studio
```

Seeded users all use:

```text
password123
```

## Roadmap

1. Milestone 0: repository and visual foundation
2. Milestone 1: database and authentication
3. Milestone 2: core master data
4. Milestone 3: reservations
5. Milestone 4: check-in/out and housekeeping
6. Milestone 5: requests, POS, and dashboard data
7. Milestone 6: reports, polish, and deployment
8. Milestone 7: settings and access readiness
9. Milestone 8: guest communication preparation
10. Milestone 9: AI preparation
11. Milestone 10: POS and activities catalog management
12. Milestone 11: check-out wizard and review handoff
13. Milestone 12: check-in wizard and welcome handoff
14. Milestone 13: activity audit trail and role-aware navigation
15. Milestone 14: styleupdate UI/UX refresh

## Implemented Master Data Routes

```text
/units
/units/new
/units/[id]
/guests
/guests/new
/guests/[id]
```

## Implemented Reservation Routes

```text
/reservations
/reservations/new
/reservations/[id]
/reservations/[id]/edit
/check-in/[reservationId]
/check-out/[reservationId]
/calendar
```

## Implemented Housekeeping Routes

```text
/housekeeping
```

## Implemented Service And POS Routes

```text
/service-requests
/catalog
/orders
```

## Implemented Report Routes

```text
/reports
/reports/export
```

## Implemented Settings Routes

```text
/settings
```

## Implemented Communication Routes

```text
/messages
```

## Implemented AI Preparation Routes

```text
/ai
```

## Implemented Audit Routes

```text
/activity
/activity/export
```
