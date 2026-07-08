# Payment proof, sales cutoff & email verification — design spec

Date: 2026-07-08. Approved by the user (options chosen via Q&A: Resend, account verification + notifications, global admin cutoff, 15-min window to upload proof).

## Problem

Today the buyer pays via static QR and waits for the organizer to confirm blindly. The organizer has no evidence and must watch the panel 24/7. Orders can also be placed up to the event start, and there is no email infrastructure.

## Design

### 1. Data model (one migration)

- `OrderStatus` adds `PAYMENT_SUBMITTED` — flow: `PENDING_PAYMENT → PAYMENT_SUBMITTED → CONFIRMED | CANCELLED`.
- `Order` adds `paymentProof String?` (image URL), `paymentSubmittedAt DateTime?`, `rejectionReason String?`.
- New `PlatformSettings` singleton (`id = "main"`): `orderCutoffHours Int @default(2)`.
- Migration backfills `User.emailVerified = now()` for existing users (grandfathered) and seeds the settings row.

### 2. Buyer flow

- Payment screen (order `PENDING_PAYMENT`, 15-min countdown): buyer uploads the bank receipt image → `POST /api/orders/[id]/proof` (multipart; buyer-owned order; JPG/PNG/WebP ≤ 5 MB; Vercel Blob `proofs/` or local disk). Order → `PAYMENT_SUBMITTED` ("En revisión"), stops expiring; seats stay held. Proof can be replaced while in review.
- `expireStaleOrders()` keeps cancelling only `PENDING_PAYMENT`.
- Capacity queries (free-zone aggregates in order creation + event page) count `PAYMENT_SUBMITTED` as committed.

### 3. Organizer flow (`/dashboard/orders`)

- New "En revisión" section showing the proof (thumbnail → full image) with **Verificar** (→ existing confirm: CONFIRMED, seats SOLD, tickets issued, confirmation email) and **Rechazar** (optional reason → CANCELLED, seats released, rejection email with reason).
- Orders without proof (`PENDING_PAYMENT`) keep today's confirm/cancel (e.g. cash), buyers may still self-cancel only in `PENDING_PAYMENT`.

### 4. Sales cutoff

- `PlatformSettings.orderCutoffHours` editable by ADMIN (`PATCH /api/admin/settings`, card on `/admin`, Zod 0–168).
- `eventStartsAt(event)` combines the noon-UTC date + `time` at fixed `-04:00` (Bolivia, no DST). `POST /api/orders` rejects when `now > startsAt − cutoff`; the event page shows "Venta cerrada" instead of the seat map/summary.

### 5. Email (Resend via plain fetch — no SDK dependency)

- `src/lib/email.ts`: `sendEmail({to, subject, html})`. Without `RESEND_API_KEY` it logs to console (dev works offline). `EMAIL_FROM` defaults to `Üticket <onboarding@resend.dev>` (sandbox only delivers to the account owner's address — a verified domain is needed for real buyers). Failures are logged, never break the API response.
- Templates (brand purple, Spanish): account verification, order confirmed (link to tickets), order rejected (with reason).

### 6. Email verification

- Register: creates a hashed token in `VerificationToken` (24 h TTL, one active per email) and sends a link to `/verificar-correo?token=…` (page consumes it and sets `emailVerified`). Resend endpoint `POST /api/verify-email/resend` for logged-in unverified users; slim banner under the navbar with the resend button.
- **Purchase requires a verified email** (`POST /api/orders` → 403 with a clear message otherwise). Google sign-ins are auto-verified (`events.signIn`). Seed users are verified.
- Leaves tokens+email infra ready for the future "¿Olvidaste tu contraseña?" (out of scope this phase).

## Out of scope

Password reset UI/API; per-event cutoff; notifying organizers by email; PDF proofs.

## Testing

Unit: `eventStartsAt`, settings/proof validation schemas. E2E dev-server: register→verification email logged→verify→buy; proof upload → in-review; organizer verify → confirmed + email logged; reject → cancelled + seats released; cutoff blocks near events; unverified buyer blocked. Plus `pnpm test && pnpm typecheck && pnpm lint && pnpm build`.

## Deploy notes

Neon migration BEFORE pushing; add `RESEND_API_KEY` (+ `EMAIL_FROM` when a domain exists) to Vercel and redeploy — without the key, prod would silently not send verification emails and new buyers couldn't verify.
