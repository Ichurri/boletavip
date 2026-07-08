# CLAUDE.md

Üticket (formerly BoletaVIP; internal identifiers — repo, DB, seed emails, localStorage keys — keep `boletavip`): event ticketing platform (Bolivia). Buyers pay via the organizer's static bank QR; the organizer confirms payments manually and tickets are issued with unique QR codes, validated at the door with an in-app scanner.

**Brand (guidelines v1.0)**: user-facing name **Üticket**. Palette: Primary Purple `#6D2BFF`, Secondary Purple `#4B14D1` (hover), Lavender `#879CFF` (accent/ring), Dark Gray `#2B2B2B`, Light Gray `#F5F5F7` — tokens in `globals.css` (dark mode uses lightened `#8E5CFF` primary for contrast). Typography: Plus Jakarta Sans (`--font-jakarta`). Logo: `src/components/layout/Logo.tsx` (Ü glyph SVG + wordmark) and `src/app/icon.svg`. Tagline: "Tu entrada en un clic." Tone: cercano, claro y emocionante.

## Language conventions

- Talk to the user in **Spanish**. Code, identifiers, comments and commits in **English**.
- **UI copy is Spanish** (voseo: "elegí", "tenés"). Currency is Bs via `formatCurrency` in `src/lib/utils.ts`.

## Commands

```bash
pnpm dev          # dev server (local Postgres, uploads to /public/uploads)
pnpm build        # prisma generate && next build  (do NOT remove the generate step)
pnpm test         # Vitest unit tests
pnpm typecheck    # tsc --noEmit
pnpm lint         # eslint
pnpm db:migrate   # prisma migrate dev (local DB)
pnpm db:seed      # idempotent demo seed — LOCAL ONLY, never against Neon
pnpm db:studio    # Prisma Studio
```

Local DB: PostgreSQL 17, db `boletavip`, role `ichurri` / `boletavip_dev`. Seed users (password `Password123`): admin@boletavip.com, organizador@boletavip.com, organizador2@boletavip.com, comprador@boletavip.com. Re-running the seed resets seed events' statuses.

## Stack quirks (things that differ from older docs/tutorials)

- **Next.js 16**: route protection lives in `src/proxy.ts` (NOT `middleware.ts` — deprecated). `params`/`searchParams` are Promises (`await` them). Route files under `app/api` may only export HTTP methods.
- **Prisma 7**: datasource has NO `url` in `schema.prisma`; the connection lives in `prisma.config.ts` (`env("DATABASE_URL")`). Client is generated to `src/generated/prisma` (gitignored) — import `PrismaClient`/`Prisma` from `@/generated/prisma/client`, enums from `@/generated/prisma/enums`. After schema changes run `pnpm prisma generate` (and restart the dev server — it caches the old client). Runtime uses the `PrismaPg` driver adapter (`src/lib/prisma.ts`).
- **NextAuth v5 beta**: JWT strategy; `id` and `role` are injected into the session. Edge-safe config split: `src/lib/auth.config.ts` (no Prisma, used by proxy) vs `src/lib/auth.ts` (full, with adapter + credentials + conditional Google). Google provider only activates when `GOOGLE_CLIENT_ID/SECRET` are set.
- **Tailwind v4**: tokens defined in `globals.css` via CSS vars + `@theme inline`; class-based dark mode (`next-themes`). No `tailwind.config`.
- **Zustand selectors must return stable references** (primitives or direct state refs). Never `state.items.filter(...)` or `: []` inside a selector — it breaks `useSyncExternalStore` ("getSnapshot should be cached"). Derive outside the selector.

## Architecture

- Mutations go through `/app/api/**` routes with Zod validation (`src/lib/validations/*`); reads happen directly in server components via `prisma`.
- API auth: `requireRole(...roles)` from `src/lib/api-auth.ts` — also rechecks the `suspended` flag in DB on every call (JWT outlives suspension).
- Ownership checks: organizers may only touch their own venues/events/orders; ADMIN bypasses.
- Prices are ALWAYS computed server-side: `event.price × zone.priceMultiplier`. Money fields are `Decimal` — convert with `Number()` before passing to client components.
- Event dates are stored at **noon UTC** (`eventDate()` in `src/lib/utils.ts`) so the calendar date is timezone-stable.

## Business rules

- Roles: BUYER | ORGANIZER | ADMIN. Registration offers buyer/organizer; ADMIN only via DB.
- Event lifecycle: DRAFT → submit (requires `paymentQrImage`) → PENDING → admin approves → APPROVED (public) / rejects → back to DRAFT. Approved events can only be cancelled, not edited/deleted.
- Venues own zones; a zone is either numbered (rows × seatsPerRow, `Seat` rows generated, `Zone.rows != null`) or free-capacity. Venue structure is locked once it has sales.
- Orders: created in a **serializable transaction** — seats flip AVAILABLE→RESERVED atomically, free-zone capacity checked against PENDING_PAYMENT/CONFIRMED orders. 15-min expiry. **No cron**: `expireStaleOrders()` (`src/lib/orders.ts`) runs lazily before order reads/writes and releases seats.
- Confirmation (organizer): order→CONFIRMED, seats→SOLD, one ticket per seat/quantity with UUID `code` + QR data URL.
- Ticket check-in (`/api/tickets/verify`): atomic `updateMany where status=VALID` → USED + `usedAt`; a QR is accepted exactly once. Only the event's organizer or admin can verify.
- Cart (client-only, Zustand + localStorage): single event at a time, max 10 tickets per zone.

## Deployment (Vercel + Neon + Vercel Blob) — LIVE in production

- Push to `main` auto-deploys. Working tree may contain the user's WIP — when committing, stage only the files you changed.
- **Migrations to prod BEFORE pushing code that needs them**:
  `DATABASE_URL="<neon-pooled-string>" pnpm prisma migrate deploy` (ask the user for the string; it's not stored in the repo). Never `migrate dev` and never seed against Neon.
- Uploads: `/api/upload` uses Vercel Blob when `BLOB_READ_WRITE_TOKEN` is set, local `/public/uploads` otherwise. The Blob store must be **Public**; image URL validation accepts `/uploads/...` or `*.public.blob.vercel-storage.com` only.
- Env vars on Vercel: `DATABASE_URL` (Neon pooled), `AUTH_SECRET`, `BLOB_READ_WRITE_TOKEN` (added manually from the store's Getting Started page — connecting the store does NOT inject it). Env changes require a redeploy; failed builds keep serving the previous deployment.

## Verification habits

Before claiming done: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`, plus exercise the affected flow against the dev server (login via `/api/auth/callback/credentials` with csrf token; check role-gated routes and API status codes). The user approves each work phase before the next — ask before expanding scope.
