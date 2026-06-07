# Changelog

## 0.18.2 - Module UI Consistency QA

- Added cross-module E2E coverage for page-level overflow across primary operational modules.
- Added E2E coverage for live Rupiah thousands formatting on money inputs.
- Refined unit quick status actions so Maintenance and Mark Ready use distinct action colors.
- Re-ran browser route audit for desktop and mobile module surfaces with no page-level overflow or panel overlap findings.

## 0.18.1 - UI Status And Currency Polish

- Expanded status badge tones so operational statuses are easier to distinguish across reservations, units, housekeeping, service requests, orders, payments, and dashboard surfaces.
- Added formatted Rupiah inputs that display thousands separators while submitting raw numeric values to existing server actions.
- Updated primary money fields in catalog, orders, payments, reservations, check-in, check-out, and unit type creation.
- Fixed wide board/table layouts so Housekeeping and similar modules no longer let the main panel overlap right-side panels.

## 0.18.0 - POS Catalog Availability Controls

- Added POS item availability, lead time, service slot, and daily capacity fields.
- Added Catalog controls for sold-out status, service windows, lead time, and per-day capacity.
- Updated Orders to show item slot/lead/remaining capacity and disable unavailable or capped-out items.
- Hardened order creation so stale submissions cannot exceed daily item capacity.
- Seeded demo F&B, package, spa, activity, and transport items with realistic operational limits.
- Added E2E coverage for stale order submissions against daily POS capacity.

## 0.17.0 - Production Deployment Readiness

- Added `/api/health` readiness endpoint that verifies application and database availability.
- Added Dockerfile for building and running the Next.js application in production mode.
- Added `docker-compose.prod.yml` with app, PostgreSQL, Nginx reverse proxy, health checks, persistent database volume, and persistent upload volumes.
- Added Nginx proxy configuration with forwarded headers and 10MB upload limit.
- Added `.env.production.example` for production deployment values.
- Updated production readiness documentation with Docker Compose rollout, database preparation, health checks, and HTTP/IP staging cookie notes.

## 0.15.15 - Payment Ledger Module

- Added payment ledger schema with transaction type, method, posted/voided status, references, notes, recorded-by, and reservation linkage.
- Added finance-only `payment:read` and `payment:write` permissions plus Payments navigation on desktop and mobile.
- Added `/payments` module with cashflow metrics, transaction posting, refund/adjustment support, search, and void audit controls.
- Added reservation detail payment ledger with inline post/refund and void workflows.
- Connected check-in and check-out payment amount changes to ledger delta transactions with method/reference capture.
- Seeded and locally backfilled payment transactions so demo reservations have ledger history.
- Added E2E coverage for payment posting, finance access control, and mobile Payments navigation.

## 0.15.14 - Payment Invoice Readiness

- Added reservation invoice number, amount paid/deposit, and payment notes fields to the database and seed data.
- Added invoice-ready reservation detail surfaces with folio total, collected amount, paid orders, and balance due.
- Added a print-friendly reservation invoice page with room, discount, order, payment, and balance summaries.
- Updated reservation create/edit, check-in, and check-out flows to capture amount paid and keep paid checkout orders in sync.
- Added outstanding balance visibility to reservation boards, reports, and CSV exports.
- Added Playwright coverage for the reservation invoice flow.

## 0.15.13 - CI Automation

- Added GitHub Actions CI with PostgreSQL service, npm install, Playwright browser install, database push/seed, typecheck, lint, build, dev-server startup, and E2E execution.
- Added CI artifact upload for Playwright report, test results, and dev-server logs on failure.
- Added Playwright artifacts and transient dev-server logs to `.gitignore`.
- Updated README to mention the automated CI verification path.
- Verified CI workflow YAML syntax, typecheck, lint, and production build locally.

## 0.15.12 - Persistent QA And Production Readiness

- Added Playwright E2E configuration with desktop and mobile projects.
- Added persistent E2E coverage for development login, report export authorization, forbidden access feedback, invalid action feedback, calendar date feedback, and mobile navigation coverage.
- Added `test:e2e`, `test:e2e:ui`, and `test:qa` npm scripts.
- Added `docs/PRODUCTION_READINESS.md` with environment, database, security, operational verification, go-live smoke, and known V1 limits.
- Updated README verification instructions for local and remote E2E execution.
- Verified the new suite with typecheck, 12 passing E2E tests, lint, and production build.

## 0.15.11 - Mobile Navigation And Responsive QA

- Ran owner desktop/mobile smoke coverage across 23 operational routes for status, page errors, page-level overflow, and empty controls.
- Expanded the mobile bottom navigation from a five-item subset into a role-aware horizontal module bar covering every permitted module.
- Prioritized the active module at the start of the mobile bar when it would otherwise sit far off-screen.
- Verified mobile navigation coverage for Dashboard, Calendar, Activity, and Settings with no page overflow.
- Re-ran typecheck, lint, and production build after the responsive navigation pass.

## 0.15.10 - Export Access And Daily Ops Hardening

- Reworked protected export redirects so unauthenticated users return through login cleanly and export paths land back on the operational page after login.
- Added route-level feedback redirects for report and activity CSV export failures instead of raw Unauthorized/Forbidden text.
- Added dashboard, activity, reports, and calendar feedback banners for access denials, export failures, and invalid date filters.
- Hardened report/activity CSV responses with no-store caching and spreadsheet-friendly UTF-8 BOM output.
- Verified owner/F&B export permissions, dashboard access feedback, calendar invalid-date feedback, typecheck, lint, and production build.

## 0.15.9 - Form Feedback And Transaction UX

- Added reusable action feedback helpers and a morphglass feedback banner for server action success/error states.
- Converted major operational server actions to safe validation redirects instead of raw error pages across reservations, check-in/out, orders, service requests, housekeeping, units, guests, catalog, settings, messages, and AI.
- Added feedback banners to the affected module pages so invalid submissions and successful saves return users to the right workflow context.
- Hardened the development login form so default credentials are present in the initial HTML as well as React state.
- Verified owner login and invalid-action feedback with Playwright smoke coverage, plus typecheck, lint, and production build.

## 0.15.8 - Role Data Visibility Hardening

- Added explicit visibility helpers for stay financial data, operational financial data, guest contact data, and guest message initiation.
- Reworked dashboard, calendar, unit, reservation, guest, report, POS, catalog, and message surfaces so operational roles see substitutes instead of hidden finance/contact data.
- Split F&B visibility from stay finance: F&B can see POS/order revenue, but not room revenue, RevPAR, payment follow-up tasks, room rates, or full guest contact.
- Restricted report CSV export to stay-finance roles and blocked payment reminder template names, variables, and WhatsApp open actions from read-only communication roles.
- Verified role visibility with browser smoke checks for Housekeeping, F&B, Front Office, and synthetic Viewer sessions.

## 0.15.7 - Role UX And Action Hardening

- Verified route access across Owner, Manager, Front Office, Housekeeping, and F&B demo roles with server-side permission probes.
- Replaced dashboard dead controls with real links, including role-aware quick actions and functional "View all" links.
- Removed unused legacy reservation check-in/check-out server actions so all operational transitions go through the hardened wizard flows.
- Fixed the authenticated header role chip so it reflects the active user role instead of always showing Owner.
- Converted header search into a working reservation search form, changed the date chip to non-interactive display, linked notifications to Messages, and made login help an actionable mail link.

## 0.15.6 - Visual QA And E2E Hardening

- Replaced the dashboard chart panels with stable data summary rows for occupancy, revenue, unit status, and booking sources to avoid blank or odd chart graphics.
- Captured desktop and mobile Playwright screenshots across the main operational modules and fixed the dashboard visual regression found during review.
- Normalized a stray manual housekeeping test task into an operational in-house linen refresh task.
- Improved reservation unit selection so new bookings prefer READY/AVAILABLE units and show both date availability and current unit status in unit option labels.
- Verified the end-to-end operating flow from guest creation to reservation, check-in, service request, order, check-out, and housekeeping ready, then cleaned the QA data.

## 0.15.5 - Operational Simulation Hardening

- Added page-level permission redirects so direct URLs for unauthorized modules return users to the dashboard instead of throwing server errors.
- Aligned read-only and write UI states across reservations, units, guests, housekeeping, service requests, orders, catalog, AI, and settings.
- Hardened reservation status operations so create/edit stay in pre-arrival states, checked-in stays cannot be edited/cancelled from the reservation form, and cancel is limited to Pending/Confirmed bookings.
- Preserved occupied unit state during housekeeping updates when a unit still has an in-house reservation.
- Fixed seed and active database unit statuses so only units with CHECKED_IN reservations are marked OCCUPIED.
- Re-ran role, export, detail-flow, data invariant, lint, typecheck, and production build verification.

## 0.15.4 - Detail Flow Polish

- Replaced raw enum/status text across reservation, unit, guest, check-in, check-out, dashboard, and report detail surfaces with human-readable labels.
- Upgraded empty states on detail panels so missing orders, requests, housekeeping tasks, and stay history use polished inset surfaces instead of plain text.
- Refined guest creation, unit creation, and reservation create/edit forms with stronger morphglass hierarchy.
- Cleaned mixed wording such as "No guest" and "No items" in operational panels.

## 0.15.3 - Remaining Surface Polish

- Added shared premium surface utilities for inset panels, rows, fields, and chips to unify the unfinished UI pages.
- Refined calendar into a softer timeline board with cleaner sticky unit rows, quieter empty cells, and deeper booking blocks.
- Reworked service request columns with per-status morphglass treatments and deeper request cards.
- Polished units, guests, and reports surfaces, tables, filters, and data bars to better match the uploaded style update mockups.
- Replaced remaining old flat white surfaces and rigid select/input backgrounds across operational pages with the new surface system.

## 0.15.2 - Dashboard Graphic Cleanup

- Removed the decorative sparkline SVG from dashboard KPI cards after visual review.
- Removed the remaining decorative KPI top accent line so occupancy, revenue, booking, unit, and RevPAR panels are clean metric cards.
- Replaced the fake login "Revenue Pulse" bar graphic with a simple command readiness status list.
- Audited dashboard graphics and kept only data-backed charts: occupancy trend, revenue trend, unit status donut, and booking source bars.

## 0.15.1 - Styleupdate Visual Correction

- Reworked the redesign pass to remove the green/teal background feel and shift the foundation to a graphite/navy-black cockpit with electric cyan-blue accents.
- Increased shell, panel, metric, and input radii to better match the uploaded morphglass mockups.
- Rebuilt the topbar into a mockup-aligned command cockpit with welcome copy, search pill, date chip, system status, notification, and user chip.
- Strengthened the dashboard visual delta with larger glow KPI cards, taller charts, bigger unit status donut, softer row cards, and deeper glass surfaces.
- Restructured reservations into a mockup-style workspace with search/filter table, right-side guest profile panel, and reservation timeline strip.
- Added colored housekeeping kanban column treatments and deeper glass task cards to better match the operations mockup.

## 0.15.0 - Styleupdate UI/UX Refresh

- Rebased the visual foundation to the Styleupdate dark command-center direction with cyan/teal primary accents, violet/amber support accents, tighter radii, and denser morphglass panels.
- Updated the global app background, glass surfaces, buttons, badges, skeletons, brand mark, and KPI cards.
- Redesigned the authenticated shell with a 232px grouped sidebar, compact operations topbar, role-aware mobile navigation, and updated session/user presentation.
- Refreshed the live dashboard with tighter KPI cards, cyan/violet charts, updated unit status palette, compact operational lists, and mockup-aligned panel spacing.
- Updated the login screen to the new console-style visual language while keeping development credentials and auth behavior unchanged.

## 0.1.0 - Milestone 0 Foundation

- Added Next.js App Router application scaffold.
- Added locked npm dependency baseline.
- Added Tailwind CSS 4 global Morphglass Nature Premium styling.
- Added brand mark, brand lockup, glass card, stat card, status badge, action button, empty/error/loading states.
- Added desktop app shell with sidebar/header and mobile bottom navigation.
- Added premium login screen.
- Added owner dashboard shell with static demo KPI, charts, unit status, arrivals, reservations, requests, source chart, and priority task data.
- Added placeholder pages for future modules.

## 0.2.0 - Milestone 1 Database And Auth Foundation

- Added Prisma 7 PostgreSQL schema for property, users, guests, unit types, units, reservations, housekeeping, service requests, POS orders, and activity logs.
- Added Prisma seed data for Nusa Escape demo operations.
- Added custom credentials auth with bcrypt password verification and HTTP-only JWT session cookie.
- Added login/logout/me API routes.
- Added role permission matrix and route protection middleware.
- Added local PostgreSQL Docker Compose service and database setup documentation.

## 0.3.0 - Milestone 2 Core Master Data

- Replaced Units placeholder with database-backed unit status board.
- Added unit type creation and unit creation flows.
- Added unit detail/edit page with reservation and housekeeping history.
- Replaced Guest CRM placeholder with searchable database-backed guest list.
- Added guest create and detail/edit flows.
- Added guest profile summary with contact, lifetime spend, stay history, preferences, and recent requests.
- Added server actions with permission checks and activity log writes for unit and guest changes.

## 0.4.0 - Milestone 3 Reservations

- Replaced Reservations placeholder with searchable, filterable, database-backed reservation board.
- Added reservation create and edit flows with unit availability checks and overlap protection.
- Added reservation detail page with guest, stay, payment, source, order, and service request context.
- Added reservation cancel action with permission checks, activity logs, and calendar revalidation.
- Added occupancy calendar MVP with 14-day navigation, unit rows, arrival/departure indicators, and active booking links.

## 0.5.0 - Milestone 4 Check-in And Housekeeping

- Added reservation check-in and check-out server actions.
- Synced check-in to occupied unit status and check-out to dirty unit status.
- Added automatic checkout cleaning task creation when a guest checks out.
- Replaced Housekeeping placeholder with database-backed kanban board.
- Added housekeeping task creation, status/priority/assignee updates, quick transitions, readiness sync, and activity logs.

## 0.6.0 - Milestone 5 Services, POS, And Live Dashboard

- Replaced Service Requests placeholder with database-backed request kanban.
- Added service request creation, assignment, priority/status updates, quick transitions, and activity logs.
- Added POS Orders module for reservation-linked add-ons with item quantity capture, totals, status, and payment updates.
- Added Orders route to protected navigation.
- Replaced static dashboard demo data with server-generated database summaries for KPIs, charts, unit status, arrivals, reservations, service requests, booking sources, and priority tasks.

## 0.7.0 - Milestone 6 Reports And Export

- Replaced Reports placeholder with database-backed operational reporting.
- Added period filters for occupancy, revenue, ADR, RevPAR, service SLA, booking source, unit status, housekeeping, and POS item performance.
- Added CSV export route for report summaries, daily performance, booking sources, service status, top POS items, and recent reservations.
- Added shared report calculation helper so reports page and export use the same metrics.
- Restricted local PostgreSQL Docker port binding to `127.0.0.1`.

## 0.8.0 - Milestone 7 Settings And Access Readiness

- Replaced Settings placeholder with database-backed property administration.
- Added property profile update flow with slug conflict protection and activity logging.
- Added team user creation, role/status editing, optional password reset, active owner safeguards, and duplicate email protection.
- Added role permission matrix, operational counts, recent activity, and production readiness checklist.
- Hardened login to support both JSON login and native form fallback redirects for IP-based development access.

## 0.9.0 - Milestone 8 Guest Communication Preparation

- Added Message Templates and Communication Logs data model.
- Added `/messages` route with WhatsApp quick links for active and upcoming reservations.
- Added templated message rendering with guest, booking, stay, payment, and property variables.
- Added template creation/editing, active template controls, copy action, and recent communication history.
- Added message permissions, sidebar navigation, route protection, and seeded V1 WhatsApp templates.

## 0.10.0 - Milestone 9 AI Preparation

- Added AI configuration and prompt template data model.
- Added `/ai` route for OpenRouter provider status, primary/fallback model settings, temperature, max token limits, and feature flags.
- Added V1 guardrail state that keeps autonomous actions locked off.
- Added OpenRouter chat completion wrapper with fallback model payload support.
- Added editable prompt placeholders for guardrails, concierge drafts, WhatsApp drafts, operations summaries, and report insights.
- Added AI permissions, route protection, sidebar navigation, and idempotent AI seed script.

## 0.11.0 - Milestone 10 POS And Activities Catalog

- Added `/catalog` route for POS and activity item management.
- Added catalog item create and edit actions with duplicate-name protection, activity logging, and Orders/Reports revalidation.
- Added category mix, top item activity, active/inactive catalog metrics, and inline item status controls.
- Added Catalog navigation and route protection.
- Tightened Orders page access to require `pos:read`.

## 0.12.0 - Milestone 11 Check-out Wizard

- Added `/check-out/[reservationId]` wizard for stay summary, extra charges, payment confirmation, and final check-out notes.
- Routed reservation list/detail check-out buttons through the wizard instead of direct status mutation.
- Added final check-out action that marks reservations checked out, updates the unit to dirty, creates/reuses checkout cleaning tasks, and logs activity.
- Added post-checkout completion screen with housekeeping handoff and WhatsApp review link generation from message templates.
- Added route protection and documentation for the check-out wizard flow.

## 0.13.0 - Milestone 12 Check-in Wizard

- Added `/check-in/[reservationId]` wizard for reservation verification, guest verification, payment confirmation, unit readiness, and final check-in.
- Routed reservation list/detail check-in buttons through the wizard instead of direct status mutation.
- Added final check-in action that marks reservations in-house, updates units to occupied, stores final payment status, appends notes, and logs activity.
- Added Owner/Manager override handling for pending reservations or non-ready units with mandatory reason logging.
- Added post-check-in completion screen with room handoff and WhatsApp welcome link generation from message templates.
- Added route protection and documentation for the check-in wizard flow.

## 0.14.0 - Milestone 13 Activity Audit Trail

- Added `/activity` route for property-scoped activity log review with search, action, entity, and actor filters.
- Added `/activity/export` CSV export that follows the same active filters.
- Added `activity:read` permission for Owner and Manager roles.
- Added Activity navigation plus role-aware sidebar and mobile navigation filtering.
- Updated the app shell/header to display the current session user and current date instead of static Owner/demo text.
