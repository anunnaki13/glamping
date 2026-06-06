# Production Readiness Checklist

This checklist captures the minimum checks before Smart Glamping OS is used for a real property.

## Environment

- Set `NODE_ENV=production`.
- Generate a strong `AUTH_SECRET` with at least 32 random bytes.
- Set `DATABASE_URL` to the production PostgreSQL connection string.
- Keep `OPENROUTER_API_KEY` empty unless AI features are intentionally enabled.
- Confirm `OPENROUTER_ENABLED`, `OPENROUTER_PRIMARY_MODEL`, and fallback model settings before enabling AI.
- Do not reuse the seeded `password123` credential in production.
- Use `.env.production.example` as the deployment template for Docker Compose.
- For temporary HTTP/IP staging, session cookies intentionally omit `Secure`; behind HTTPS or an HTTPS proxy they remain secure.

## Database

- Run migrations or `prisma db push` only through the agreed deployment workflow.
- Run `npm run db:generate` after dependency or schema changes.
- Seed demo data only in non-production environments.
- Configure PostgreSQL backups and restore testing before go-live.
- Confirm owner account recovery path and at least one active owner.

## Security

- Serve only over HTTPS.
- Store secrets in the deployment platform secret manager, not in committed files.
- Confirm session cookies are `HttpOnly`, `SameSite=Lax`, and secure in production.
- Review role permissions for Owner, Manager, Front Office, Housekeeping, F&B, and Viewer before onboarding staff.
- Verify report exports are restricted to stay-finance roles.

## Operational Verification

Run these checks against the deployed URL:

```bash
npm run typecheck
npm run lint
npm run build
E2E_BASE_URL=https://your-domain.example npm run test:e2e
```

For local E2E, keep the dev server running first:

```bash
npm run dev
npm run test:e2e
```

## Docker Compose Production Preview

The production stack includes:

- `app`: Next.js production server
- `postgres`: PostgreSQL 17 with persistent volume
- `nginx`: reverse proxy on `HTTP_PORT`

First deploy:

```bash
cp .env.production.example .env.production
nano .env.production
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
docker compose --env-file .env.production -f docker-compose.prod.yml exec app npm run db:push
docker compose --env-file .env.production -f docker-compose.prod.yml exec app npm run db:seed
curl http://localhost/api/health
```

Routine restart:

```bash
git pull
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

Logs:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f app
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f nginx
```

Health endpoint:

```text
/api/health
```

The endpoint returns `200` only when the app can reach the database.

## Go-Live Smoke

- Owner can log in.
- F&B cannot export stay revenue CSV and sees feedback.
- Forbidden module access redirects to dashboard with feedback.
- Mobile navigation exposes all permitted modules.
- Check-in and check-out wizards load for valid reservations.
- Reports and Activity exports download CSV for authorized roles.
- Dashboard, Calendar, Reservations, Units, Guests, Housekeeping, Services, Orders, Catalog, Messages, Reports, Activity, AI, and Settings return 200.

## Known V1 Limits

- WhatsApp is quick-link based, not API sending.
- AI is preparation/configuration only unless explicitly wired to generation flows.
- Payment gateway, invoice PDF, refunds, and inventory stock are not complete V1 features.
- Calendar does not yet support drag/drop reschedule or maintenance block creation from cells.
