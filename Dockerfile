FROM node:24-bookworm-slim AS builder

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY . .

RUN DATABASE_URL=postgresql://postgres:postgres@localhost:5432/smart_glamping?schema=public AUTH_SECRET=docker-build-placeholder-change-at-runtime npm ci
RUN DATABASE_URL=postgresql://postgres:postgres@localhost:5432/smart_glamping?schema=public AUTH_SECRET=docker-build-placeholder-change-at-runtime npm run build

FROM node:24-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app ./

EXPOSE 3000

CMD ["npm", "start"]
