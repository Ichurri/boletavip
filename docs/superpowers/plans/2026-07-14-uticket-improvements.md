# Üticket Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the 14 improvements from the 2026-07-14 project review: correctness fixes (atomic order confirmation), notifications (proof submitted, event pending), abuse protection (order caps, email cooldowns, security headers), private payment proofs, buyer trust surface (organizer contact, legal pages, search), organizer operations (CSV export, door scan codes, PDF tickets), and reliability (email feedback, integration tests).

**Architecture:** Six phases, each independently shippable. All mutations stay in `/app/api/**` routes with Zod validation; reads stay in server components. Two new Prisma migrations (`User.phone`, `Event.scanCode`). New deps: `pdf-lib` only. Integration tests run against a dedicated local Postgres DB (`boletavip_test`) with `@/lib/api-auth` mocked.

**Tech Stack:** Next.js 16 (App Router, `src/proxy.ts`), Prisma 7 (client in `src/generated/prisma`), NextAuth v5 beta, Zod 4, Vitest 4, Tailwind v4, `@vercel/blob` v2 (supports `access: "private"` + `get()`), `pdf-lib`.

---

**Project conventions that apply to every task (from CLAUDE.md):**

- UI copy in Spanish (voseo), code/comments/commits in English.
- Import Prisma types from `@/generated/prisma/client`, enums from `@/generated/prisma/enums`.
- After schema changes: `pnpm prisma generate` **and restart the dev server**.
- Money is `Decimal` — `Number()` before passing to client components.
- Never create `Intl.DateTimeFormat` without `timeZone: BOLIVIA_TZ`; use `formatDate`/`formatDateTime` from `src/lib/utils.ts`.
- Before claiming a phase done: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`.
- **The user approves each phase before starting the next one.**

**Explicitly out of scope** (reviewed and deferred deliberately):

- Full IP-based rate limiting (needs Redis/KV infra; the DB-backed cooldowns in Task 7 cover the email-abuse vector, the order cap in Task 6 covers inventory abuse).
- JWT invalidation on password reset/suspension (known limitation, documented in CLAUDE.md).
- Moving ticket QR data-URLs out of the DB (minor storage optimization, revisit if the table grows).
- Offline check-in mode (the CSV export in Task 15 is the interim mitigation).
- Notifying the organizer when the admin approves/rejects an event (only admin-side notification was in the review).

---

## Phase 1 — Correctness & notifications

### Task 1: Atomic status guard in order confirmation

Two concurrent confirms (double click, organizer + admin) both pass the status check and issue duplicate tickets. Move the status transition inside the transaction as a guarded `updateMany`.

**Files:**
- Modify: `src/app/api/orders/[id]/confirm/route.ts`
- (Concurrency covered by integration test in Task 19 — this task verifies manually.)

- [x] **Step 1: Rewrite the route with the transactional claim**

Replace the entire contents of `src/app/api/orders/[id]/confirm/route.ts` with:

```ts
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { expireStaleOrders } from "@/lib/orders";
import { orderConfirmedEmail, sendEmail } from "@/lib/email";
import type { TicketStatus } from "@/generated/prisma/enums";

type RouteContext = { params: Promise<{ id: string }> };

class ConfirmError extends Error {}

export async function POST(request: Request, { params }: RouteContext) {
  const { session, error } = await requireRole("ORGANIZER", "ADMIN");
  if (error) return error;

  const { id } = await params;
  await expireStaleOrders();

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: true,
      event: { select: { id: true, title: true, organizerId: true } },
      buyer: { select: { name: true, email: true } },
    },
  });
  if (!order) {
    return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  }
  if (
    order.event.organizerId !== session.user.id &&
    session.user.role !== "ADMIN"
  ) {
    return NextResponse.json(
      { error: "No tenés permisos sobre este pedido" },
      { status: 403 },
    );
  }
  if (order.status !== "PENDING_PAYMENT" && order.status !== "PAYMENT_SUBMITTED") {
    return NextResponse.json(
      { error: "Este pedido ya no está pendiente de pago" },
      { status: 409 },
    );
  }

  // One ticket per seat item; N tickets for zone items with quantity N
  const ticketsData: {
    code: string;
    qrCode: string;
    orderId: string;
    eventId: string;
    seatId: string | null;
    zoneId: string | null;
    status: TicketStatus;
  }[] = [];

  for (const item of order.items) {
    const count = item.seatId ? 1 : item.quantity;
    for (let i = 0; i < count; i++) {
      const code = randomUUID();
      const qrCode = await QRCode.toDataURL(code, { width: 320, margin: 2 });
      ticketsData.push({
        code,
        qrCode,
        orderId: order.id,
        eventId: order.event.id,
        seatId: item.seatId,
        zoneId: item.zoneId,
        status: "VALID",
      });
    }
  }

  const seatIds = order.items
    .map((item) => item.seatId)
    .filter((seatId): seatId is string => seatId !== null);

  try {
    await prisma.$transaction(async (tx) => {
      // Atomic claim: only one concurrent confirm can flip the status, so a
      // double click (or organizer + admin at once) can't issue tickets twice.
      const claimed = await tx.order.updateMany({
        where: {
          id: order.id,
          status: { in: ["PENDING_PAYMENT", "PAYMENT_SUBMITTED"] },
        },
        data: { status: "CONFIRMED" },
      });
      if (claimed.count === 0) {
        throw new ConfirmError("Este pedido ya no está pendiente de pago");
      }
      await tx.seat.updateMany({
        where: { id: { in: seatIds } },
        data: { status: "SOLD" },
      });
      await tx.ticket.createMany({ data: ticketsData });
    });
  } catch (err) {
    if (err instanceof ConfirmError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }

  const origin = new URL(request.url).origin;
  const { subject, html } = orderConfirmedEmail(
    order.buyer.name,
    order.event.title,
    ticketsData.length,
    `${origin}/orders/${order.id}`,
  );
  await sendEmail({ to: order.buyer.email, subject, html });

  return NextResponse.json({ ok: true, tickets: ticketsData.length });
}
```

- [x] **Step 2: Verify the suite still passes**

Run: `pnpm test && pnpm typecheck`
Expected: all tests pass, no type errors.

- [x] **Step 3: Manual double-fire check against the dev server**

Start the dev server (`nohup pnpm dev > /tmp/uticket-dev.log 2>&1 &` if backgrounding). Log in as `organizador@boletavip.com` / `Password123`, find (or create as `comprador@boletavip.com`) an order in PAYMENT_SUBMITTED, then fire two confirms at once from a terminal (reuse the session cookie from the browser dev tools):

```bash
COOKIE='authjs.session-token=<value from browser>'
ORDER=<order-id>
curl -s -o /dev/null -w "%{http_code}\n" -b "$COOKIE" -X POST "http://localhost:3000/api/orders/$ORDER/confirm" &
curl -s -o /dev/null -w "%{http_code}\n" -b "$COOKIE" -X POST "http://localhost:3000/api/orders/$ORDER/confirm" &
wait
```

Expected: one `200`, one `409`; ticket count in Prisma Studio equals the order quantity (not double).

- [x] **Step 4: Commit**

```bash
git add src/app/api/orders/[id]/confirm/route.ts
git commit -m "fix: claim order status atomically before issuing tickets"
```

---

### Task 2: New email templates (proof submitted, event pending review)

**Files:**
- Modify: `src/lib/email.ts`
- Test: `src/lib/email.test.ts` (create)

- [x] **Step 1: Write the failing tests**

Create `src/lib/email.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  eventPendingReviewEmail,
  parseSender,
  proofSubmittedEmail,
} from "@/lib/email";

describe("parseSender", () => {
  it("splits a display-name sender", () => {
    expect(parseSender("Üticket <hola@uticket.bo>")).toEqual({
      name: "Üticket",
      email: "hola@uticket.bo",
    });
  });
});

describe("proofSubmittedEmail", () => {
  it("escapes user-provided values", () => {
    const { html } = proofSubmittedEmail(
      "Org",
      '<img src=x onerror=alert(1)>',
      "Evento <script>alert(1)</script>",
      "Bs 100,00",
      "https://uticket.bo/dashboard/orders",
    );
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;script&gt;");
  });

  it("links to the review page and names the buyer", () => {
    const { subject, html } = proofSubmittedEmail(
      "Org",
      "Ana",
      "Concierto",
      "Bs 250,00",
      "https://uticket.bo/dashboard/orders",
    );
    expect(subject).toContain("Concierto");
    expect(html).toContain("https://uticket.bo/dashboard/orders");
    expect(html).toContain("Ana");
  });
});

describe("eventPendingReviewEmail", () => {
  it("escapes the event title and links to admin review", () => {
    const { html } = eventPendingReviewEmail(
      "Fiesta <b>XXL</b>",
      "Orga",
      "https://uticket.bo/admin/events",
    );
    expect(html).not.toContain("<b>XXL</b>");
    expect(html).toContain("https://uticket.bo/admin/events");
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- src/lib/email.test.ts`
Expected: FAIL — `proofSubmittedEmail` / `eventPendingReviewEmail` are not exported.

- [x] **Step 3: Add the templates**

In `src/lib/email.ts`, append after the existing `orderRejectedEmail` function:

```ts
export function proofSubmittedEmail(
  rawOrganizerName: string | null,
  rawBuyerName: string,
  rawEventTitle: string,
  rawAmountLabel: string,
  reviewUrl: string,
) {
  const name = rawOrganizerName ? escapeHtml(rawOrganizerName) : null;
  const buyerName = escapeHtml(rawBuyerName);
  const eventTitle = escapeHtml(rawEventTitle);
  const amountLabel = escapeHtml(rawAmountLabel);
  return {
    subject: `Nuevo comprobante de pago para ${eventTitle}`,
    html: layout(
      `Hola${name ? ` ${name}` : ""}, tenés un pago por revisar`,
      `<p style="margin:0 0 16px;font-size:14px;line-height:1.6;">
        <strong>${buyerName}</strong> subió el comprobante de una transferencia de
        <strong>${amountLabel}</strong> para <strong>${eventTitle}</strong>.
        Verificalo para emitir los boletos — mientras tanto el comprador queda
        esperando.
      </p>
      ${button(reviewUrl, "Revisar comprobante")}`,
    ),
  };
}

export function eventPendingReviewEmail(
  rawEventTitle: string,
  rawOrganizerName: string | null,
  reviewUrl: string,
) {
  const eventTitle = escapeHtml(rawEventTitle);
  const organizerName = rawOrganizerName
    ? escapeHtml(rawOrganizerName)
    : "un organizador";
  return {
    subject: `Evento pendiente de revisión: ${eventTitle}`,
    html: layout(
      "Hay un evento esperando aprobación",
      `<p style="margin:0 0 16px;font-size:14px;line-height:1.6;">
        <strong>${organizerName}</strong> envió <strong>${eventTitle}</strong> a
        revisión. No se publica hasta que lo apruebes o rechaces.
      </p>
      ${button(reviewUrl, "Revisar evento")}`,
    ),
  };
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- src/lib/email.test.ts`
Expected: PASS (all 4 tests).

- [x] **Step 5: Commit**

```bash
git add src/lib/email.ts src/lib/email.test.ts
git commit -m "feat: add proof-submitted and event-pending email templates"
```

---

### Task 3: Notify the organizer when a proof is uploaded

**Files:**
- Modify: `src/app/api/orders/[id]/proof/route.ts`

- [x] **Step 1: Widen the order query and send the email**

In `src/app/api/orders/[id]/proof/route.ts`:

Add to the imports:

```ts
import { proofSubmittedEmail, sendEmail } from "@/lib/email";
import { formatCurrency } from "@/lib/utils";
```

Replace the `findUnique` call:

```ts
  const order = await prisma.order.findUnique({
    where: { id },
    select: { id: true, buyerId: true, status: true },
  });
```

with:

```ts
  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      buyerId: true,
      status: true,
      totalAmount: true,
      buyer: { select: { name: true, email: true } },
      event: {
        select: {
          title: true,
          organizer: { select: { name: true, email: true } },
        },
      },
    },
  });
```

Then replace the final success return:

```ts
  return NextResponse.json({ ok: true, url }, { status: 201 });
```

with:

```ts
  // Notify the organizer on the first submission only — replacements while
  // already in review would just spam their inbox.
  if (order.status === "PENDING_PAYMENT") {
    const origin = new URL(request.url).origin;
    const { subject, html } = proofSubmittedEmail(
      order.event.organizer.name,
      order.buyer.name ?? order.buyer.email,
      order.event.title,
      formatCurrency(Number(order.totalAmount)),
      `${origin}/dashboard/orders`,
    );
    await sendEmail({ to: order.event.organizer.email, subject, html });
  }

  return NextResponse.json({ ok: true, url }, { status: 201 });
```

- [x] **Step 2: Verify manually in dev**

With the dev server running (no email keys locally, so the send logs to console): as `comprador@boletavip.com`, create an order and upload any image as proof. Check `/tmp/uticket-dev.log` for a line `[email:dev] to=organizador@boletavip.com subject="Nuevo comprobante de pago para ..."`. Upload a **replacement** proof and confirm no second email is logged.

- [x] **Step 3: Run checks and commit**

Run: `pnpm test && pnpm typecheck`
Expected: PASS.

```bash
git add src/app/api/orders/[id]/proof/route.ts
git commit -m "feat: email the organizer when a payment proof arrives"
```

---

### Task 4: Notify admins when an event is submitted for review

**Files:**
- Modify: `src/app/api/events/[id]/status/route.ts`

- [x] **Step 1: Send the email in the submit branch**

In `src/app/api/events/[id]/status/route.ts`, add to the imports:

```ts
import { eventPendingReviewEmail, sendEmail } from "@/lib/email";
```

Replace the submit branch's update-and-return:

```ts
    const updated = await prisma.event.update({
      where: { id },
      data: { status: "PENDING" },
    });
    return NextResponse.json({ event: updated });
```

with:

```ts
    const updated = await prisma.event.update({
      where: { id },
      data: { status: "PENDING" },
    });

    const admins = await prisma.user.findMany({
      where: { role: "ADMIN", suspended: false },
      select: { email: true },
    });
    const origin = new URL(request.url).origin;
    const { subject, html } = eventPendingReviewEmail(
      event.title,
      session.user.name ?? null,
      `${origin}/admin/events`,
    );
    await Promise.all(
      admins.map((admin) => sendEmail({ to: admin.email, subject, html })),
    );

    return NextResponse.json({ event: updated });
```

- [x] **Step 2: Verify manually in dev**

As `organizador@boletavip.com`, submit a DRAFT event to review. Check the dev log for `[email:dev] to=admin@boletavip.com subject="Evento pendiente de revisión: ..."`.

- [x] **Step 3: Run checks and commit**

Run: `pnpm test && pnpm typecheck`
Expected: PASS.

```bash
git add src/app/api/events/[id]/status/route.ts
git commit -m "feat: email admins when an event is submitted for review"
```

---

### Task 5: Fresh availability on the public event page

Expired-but-unswept `PENDING_PAYMENT` orders keep inflating zone counts and holding seats as RESERVED on `/events/[id]`. Run the lazy sweeper there like every other order-reading page does.

**Files:**
- Modify: `src/app/(public)/events/[id]/page.tsx`

- [x] **Step 1: Call the sweeper before reading availability**

Add to the imports in `src/app/(public)/events/[id]/page.tsx`:

```ts
import { expireStaleOrders } from "@/lib/orders";
```

Then at the top of `EventDetailPage`, change:

```ts
export default async function EventDetailPage({ params }: PageProps) {
  const { id } = await params;
  const event = await getApprovedEvent(id);
```

to:

```ts
export default async function EventDetailPage({ params }: PageProps) {
  const { id } = await params;
  await expireStaleOrders();
  const event = await getApprovedEvent(id);
```

- [x] **Step 2: Verify manually**

Create an order as `comprador@boletavip.com` (note the zone count drop on the event page), then in `pnpm db:studio` set that order's `expiresAt` to the past. Reload `/events/<id>`: the count must be restored and the seats AVAILABLE again without touching any other page.

- [x] **Step 3: Run checks and commit**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: PASS.

```bash
git add "src/app/(public)/events/[id]/page.tsx"
git commit -m "fix: expire stale orders before rendering public availability"
```

- [x] **Step 4: Phase 1 gate**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`
Expected: all green. **Stop and get user approval before Phase 2.**

---

## Phase 2 — Abuse protection

### Task 6: Cap unpaid orders per buyer

**Files:**
- Modify: `src/lib/constants.ts`
- Modify: `src/app/api/orders/route.ts`
- (Behavior covered by integration test in Task 19.)

- [x] **Step 1: Add the constant**

Append to `src/lib/constants.ts`:

```ts
/** A buyer may hold at most this many unpaid (PENDING_PAYMENT) orders at
 * once, so nobody can lock up an event's inventory in 15-minute cycles. */
export const MAX_PENDING_ORDERS_PER_BUYER = 3;
```

- [x] **Step 2: Enforce it in the order route**

In `src/app/api/orders/route.ts`, add to the imports:

```ts
import { MAX_PENDING_ORDERS_PER_BUYER } from "@/lib/constants";
```

Immediately after the `await expireStaleOrders();` line, insert:

```ts
  const pendingCount = await prisma.order.count({
    where: { buyerId: session.user.id, status: "PENDING_PAYMENT" },
  });
  if (pendingCount >= MAX_PENDING_ORDERS_PER_BUYER) {
    return NextResponse.json(
      {
        error: `Ya tenés ${pendingCount} pedidos esperando pago. Completá o cancelá alguno antes de crear otro.`,
      },
      { status: 429 },
    );
  }
```

- [x] **Step 3: Verify manually**

As `comprador@boletavip.com`, create 3 orders without paying, then attempt a 4th: the UI must show the error (the checkout surfaces `error` from the response). Cancel one and confirm the 4th now succeeds.

- [x] **Step 4: Commit**

```bash
git add src/lib/constants.ts src/app/api/orders/route.ts
git commit -m "feat: cap unpaid orders per buyer at 3"
```

---

### Task 7: Cooldown on verification/reset email sending

DB-backed (no new infra): `VerificationToken` has no `createdAt`, but `expires − TTL` *is* the creation time, so recency is derivable.

**Files:**
- Modify: `src/lib/verification.ts`
- Modify: `src/app/api/verify-email/resend/route.ts`
- Modify: `src/app/api/password/forgot/route.ts`
- Test: `src/lib/verification.test.ts` (create)

- [x] **Step 1: Write the failing test**

Create `src/lib/verification.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isWithinCooldown } from "@/lib/verification";

describe("isWithinCooldown", () => {
  const now = new Date("2026-07-14T12:00:00Z");

  it("is true for a token created seconds ago", () => {
    // created now → expires = now + 24 h
    const expires = new Date(now.getTime() + 24 * 3_600_000);
    expect(isWithinCooldown(expires, 24, now)).toBe(true);
  });

  it("is false once the cooldown has elapsed", () => {
    // created 2 min ago → expires = now + 24 h − 2 min
    const expires = new Date(now.getTime() + 24 * 3_600_000 - 2 * 60_000);
    expect(isWithinCooldown(expires, 24, now)).toBe(false);
  });

  it("works for the 1-hour reset TTL", () => {
    const expires = new Date(now.getTime() + 3_600_000 - 30_000); // created 30 s ago
    expect(isWithinCooldown(expires, 1, now)).toBe(true);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/lib/verification.test.ts`
Expected: FAIL — `isWithinCooldown` is not exported.

- [x] **Step 3: Implement the helpers**

In `src/lib/verification.ts`, add after the `hashToken` function:

```ts
export const EMAIL_RESEND_COOLDOWN_SECONDS = 60;

/** VerificationToken has no createdAt; derive it from expires − TTL. */
export function isWithinCooldown(
  expires: Date,
  ttlHours: number,
  now = new Date(),
  cooldownSeconds = EMAIL_RESEND_COOLDOWN_SECONDS,
) {
  const createdAt = expires.getTime() - ttlHours * 3_600_000;
  return now.getTime() - createdAt < cooldownSeconds * 1000;
}

async function hasRecentToken(identifier: string, ttlHours: number) {
  const token = await prisma.verificationToken.findFirst({
    where: { identifier },
  });
  return token !== null && isWithinCooldown(token.expires, ttlHours);
}

export function hasRecentVerificationToken(email: string) {
  return hasRecentToken(email, VERIFICATION_TOKEN_TTL_HOURS);
}

export function hasRecentPasswordResetToken(email: string) {
  return hasRecentToken(`${RESET_PREFIX}${email}`, PASSWORD_RESET_TTL_HOURS);
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/lib/verification.test.ts`
Expected: PASS.

- [x] **Step 5: Apply the cooldown in the resend route (explicit 429)**

In `src/app/api/verify-email/resend/route.ts`, change the import:

```ts
import { sendVerificationEmail } from "@/lib/verification";
```

to:

```ts
import {
  hasRecentVerificationToken,
  sendVerificationEmail,
} from "@/lib/verification";
```

and insert before the `await sendVerificationEmail(` call:

```ts
  if (await hasRecentVerificationToken(user.email)) {
    return NextResponse.json(
      { error: "Ya te enviamos un correo hace un momento. Esperá un minuto e intentá de nuevo." },
      { status: 429 },
    );
  }
```

- [x] **Step 6: Apply the cooldown in the forgot route (silent, keeps the anti-probing 200)**

In `src/app/api/password/forgot/route.ts`, change the import:

```ts
import { sendPasswordResetEmail } from "@/lib/verification";
```

to:

```ts
import {
  hasRecentPasswordResetToken,
  sendPasswordResetEmail,
} from "@/lib/verification";
```

and change:

```ts
  if (user?.password) {
    await sendPasswordResetEmail(
      { name: user.name, email: user.email },
      new URL(request.url).origin,
    );
  }
```

to:

```ts
  // Cooldown is silent: a 429 here would reveal which emails are registered.
  if (user?.password && !(await hasRecentPasswordResetToken(user.email))) {
    await sendPasswordResetEmail(
      { name: user.name, email: user.email },
      new URL(request.url).origin,
    );
  }
```

- [x] **Step 7: Verify manually**

In dev: request a password reset twice within a minute for `comprador@boletavip.com` — only one `[email:dev]` line appears, both responses are 200. Hit `POST /api/verify-email/resend` twice for an unverified user — second response is 429.

- [x] **Step 8: Commit**

```bash
git add src/lib/verification.ts src/lib/verification.test.ts src/app/api/verify-email/resend/route.ts src/app/api/password/forgot/route.ts
git commit -m "feat: 60s cooldown on verification and reset emails"
```

---

### Task 8: Security headers

**Files:**
- Modify: `next.config.ts`

- [x] **Step 1: Add the headers**

In `next.config.ts`, inside the `nextConfig` object (after the `experimental` block, before `redirects`), add:

```ts
  // Baseline hardening; camera=(self) keeps the door scanner working.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
```

- [x] **Step 2: Verify**

Run: `curl -sI http://localhost:3000/events | grep -iE "x-frame|nosniff|referrer|permissions"`
Expected: all four headers present. Then open `/dashboard/verify` in the browser and confirm the camera still starts.

- [x] **Step 3: Commit**

```bash
git add next.config.ts
git commit -m "feat: baseline security headers"
```

- [x] **Step 4: Phase 2 gate**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`
Expected: all green. **Stop and get user approval before Phase 3.**

---

## Phase 3 — Private payment proofs

### Task 9: Store proofs privately and serve them through an authenticated route

Proofs are bank receipts (names, account numbers). Today they're public-by-URL. New proofs go to Vercel Blob with `access: "private"` (local dev: a non-served `private-uploads/` dir) and are streamed back only to the buyer, the event's organizer, or an admin via `GET /api/orders/[id]/proof`. Legacy proofs (stored as public URLs) keep working through a redirect branch.

**Files:**
- Modify: `src/app/api/orders/[id]/proof/route.ts`
- Modify: `src/components/dashboard/ProofImage.tsx`
- Modify: `src/app/orders/[id]/page.tsx`
- Modify: `src/app/dashboard/orders/page.tsx`
- Modify: `src/app/dashboard/events/[id]/buyers/page.tsx`
- Modify: `.gitignore`

- [x] **Step 1: Gitignore the local private dir**

In `.gitignore`, after the `# user-uploaded images` block, add:

```
# payment proofs (never publicly served)
/private-uploads/
```

- [x] **Step 2: Rewrite the proof route (private storage + GET)**

Replace the entire contents of `src/app/api/orders/[id]/proof/route.ts` with:

```ts
import { NextResponse } from "next/server";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { get, put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { expireStaleOrders } from "@/lib/orders";
import { proofSubmittedEmail, sendEmail } from "@/lib/email";
import { formatCurrency } from "@/lib/utils";
import { ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from "@/lib/constants";

// Proofs are bank receipts: stored privately (Vercel Blob private access in
// prod, a non-served local dir in dev) and streamed back only via the GET
// below. Legacy proofs predate this and were stored as public URLs.
const PRIVATE_UPLOAD_DIR = path.join(process.cwd(), "private-uploads", "proofs");
const useBlobStorage = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

const EXTENSION_CONTENT_TYPES: Record<string, string> = Object.fromEntries(
  Object.entries(ALLOWED_IMAGE_TYPES).map(([mime, ext]) => [ext, mime]),
);

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Buyer uploads the bank-transfer receipt for their own order. Moves the
 * order to PAYMENT_SUBMITTED, which stops the 15-minute expiry; the proof
 * can be replaced while the organizer hasn't reviewed it yet.
 */
export async function POST(request: Request, { params }: RouteContext) {
  const { session, error } = await requireRole("BUYER", "ORGANIZER", "ADMIN");
  if (error) return error;

  const { id } = await params;
  await expireStaleOrders();

  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      buyerId: true,
      status: true,
      totalAmount: true,
      buyer: { select: { name: true, email: true } },
      event: {
        select: {
          title: true,
          organizer: { select: { name: true, email: true } },
        },
      },
    },
  });
  if (!order || order.buyerId !== session.user.id) {
    return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  }
  if (order.status !== "PENDING_PAYMENT" && order.status !== "PAYMENT_SUBMITTED") {
    return NextResponse.json(
      { error: "Este pedido ya no acepta comprobantes" },
      { status: 409 },
    );
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "No se recibió ningún archivo" },
      { status: 400 },
    );
  }

  const extension = ALLOWED_IMAGE_TYPES[file.type];
  if (!extension) {
    return NextResponse.json(
      { error: "Formato no permitido. Usá JPG, PNG o WebP" },
      { status: 400 },
    );
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: "La imagen no puede superar los 5 MB" },
      { status: 400 },
    );
  }

  const fileName = `${randomUUID()}.${extension}`;
  const storedPath = `proofs/${fileName}`;
  if (useBlobStorage) {
    await put(storedPath, file, {
      access: "private",
      contentType: file.type,
    });
  } else {
    await mkdir(PRIVATE_UPLOAD_DIR, { recursive: true });
    await writeFile(
      path.join(PRIVATE_UPLOAD_DIR, fileName),
      Buffer.from(await file.arrayBuffer()),
    );
  }

  // Guard on status again so an expiry/confirmation that raced us can't be overwritten
  const updated = await prisma.order.updateMany({
    where: {
      id: order.id,
      status: { in: ["PENDING_PAYMENT", "PAYMENT_SUBMITTED"] },
    },
    data: {
      paymentProof: storedPath,
      paymentSubmittedAt: new Date(),
      status: "PAYMENT_SUBMITTED",
    },
  });
  if (updated.count === 0) {
    return NextResponse.json(
      { error: "Este pedido ya no acepta comprobantes" },
      { status: 409 },
    );
  }

  // Notify the organizer on the first submission only — replacements while
  // already in review would just spam their inbox.
  if (order.status === "PENDING_PAYMENT") {
    const origin = new URL(request.url).origin;
    const { subject, html } = proofSubmittedEmail(
      order.event.organizer.name,
      order.buyer.name ?? order.buyer.email,
      order.event.title,
      formatCurrency(Number(order.totalAmount)),
      `${origin}/dashboard/orders`,
    );
    await sendEmail({ to: order.event.organizer.email, subject, html });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}

/** Streams the proof image to the buyer, the event's organizer, or an admin. */
export async function GET(request: Request, { params }: RouteContext) {
  const { session, error } = await requireRole("BUYER", "ORGANIZER", "ADMIN");
  if (error) return error;

  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      paymentProof: true,
      buyerId: true,
      event: { select: { organizerId: true } },
    },
  });
  if (
    !order?.paymentProof ||
    (order.buyerId !== session.user.id &&
      order.event.organizerId !== session.user.id &&
      session.user.role !== "ADMIN")
  ) {
    return NextResponse.json(
      { error: "Comprobante no encontrado" },
      { status: 404 },
    );
  }

  // Legacy proofs were stored as public URLs/paths — just point at them
  if (
    order.paymentProof.startsWith("http") ||
    order.paymentProof.startsWith("/uploads/")
  ) {
    return NextResponse.redirect(new URL(order.paymentProof, request.url));
  }

  if (useBlobStorage) {
    const result = await get(order.paymentProof, { access: "private" });
    if (!result) {
      return NextResponse.json(
        { error: "Comprobante no encontrado" },
        { status: 404 },
      );
    }
    const headers = new Headers(result.headers);
    headers.set("Cache-Control", "private, no-store");
    return new Response(result.stream, { headers });
  }

  const fileName = path.basename(order.paymentProof);
  const extension = fileName.split(".").pop() ?? "jpg";
  const bytes = await readFile(path.join(PRIVATE_UPLOAD_DIR, fileName)).catch(
    () => null,
  );
  if (!bytes) {
    return NextResponse.json(
      { error: "Comprobante no encontrado" },
      { status: 404 },
    );
  }
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": EXTENSION_CONTENT_TYPES[extension] ?? "image/jpeg",
      "Cache-Control": "private, no-store",
    },
  });
}
```

Note: `UploadProofForm` never reads `data.url` from the response (verified 2026-07-14 — it only parses the body for error messages), so dropping `url` from the POST response is safe.

- [x] **Step 3: Make ProofImage auth-safe**

Next's image optimizer fetches server-side **without cookies**, so the authed proof URL must bypass it. In `src/components/dashboard/ProofImage.tsx`, add the `unoptimized` prop to **all three** `<Image ... />` elements (thumbnail, overlay, inline), e.g.:

```tsx
        <Image
          src={url}
          alt="Comprobante de pago"
          width={96}
          height={96}
          unoptimized
          className={cn(
            "bg-white object-cover",
            isOverlay ? "h-12 w-12" : "h-20 w-20 sm:h-24 sm:w-24",
          )}
        />
```

(Repeat `unoptimized` on the two expanded `<Image>`s below it.)

- [x] **Step 4: Point every consumer at the authed route**

All three pages currently pass `order.paymentProof` directly; switch them to the proxy URL (the presence check on `order.paymentProof` stays):

1. `src/app/dashboard/orders/page.tsx`:
```tsx
                {order.paymentProof && <ProofImage url={order.paymentProof} />}
```
→
```tsx
                {order.paymentProof && (
                  <ProofImage url={`/api/orders/${order.id}/proof`} />
                )}
```

2. `src/app/dashboard/events/[id]/buyers/page.tsx`:
```tsx
                      {order.paymentProof ? (
                        <ProofImage url={order.paymentProof} expand="overlay" />
```
→
```tsx
                      {order.paymentProof ? (
                        <ProofImage
                          url={`/api/orders/${order.id}/proof`}
                          expand="overlay"
                        />
```

3. `src/app/orders/[id]/page.tsx` (buyer's PAYMENT_SUBMITTED block):
```tsx
              {order.paymentProof && (
                <a
                  href={order.paymentProof}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block overflow-hidden rounded-md border border-border"
                >
                  <Image
                    src={order.paymentProof}
                    alt="Comprobante de pago enviado"
                    width={480}
                    height={320}
                    className="max-h-72 w-full bg-white object-contain"
                  />
                </a>
              )}
```
→
```tsx
              {order.paymentProof && (
                <a
                  href={`/api/orders/${order.id}/proof`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block overflow-hidden rounded-md border border-border"
                >
                  <Image
                    src={`/api/orders/${order.id}/proof`}
                    alt="Comprobante de pago enviado"
                    width={480}
                    height={320}
                    unoptimized
                    className="max-h-72 w-full bg-white object-contain"
                  />
                </a>
              )}
```

- [x] **Step 5: Verify the full loop in dev**

Upload a proof as the buyer; confirm the file lands in `private-uploads/proofs/` (NOT `public/uploads/`), the buyer's order page shows it, the organizer's `/dashboard/orders` shows it, and an **incognito/unauthenticated** `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/orders/<id>/proof` returns `401`. Also verify a pre-existing order with a legacy `/uploads/...` proof still renders (redirect branch).

- [x] **Step 6: Run checks and commit**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: PASS.

```bash
git add .gitignore src/app/api/orders/[id]/proof/route.ts src/components/dashboard/ProofImage.tsx src/app/orders/[id]/page.tsx src/app/dashboard/orders/page.tsx src/app/dashboard/events/[id]/buyers/page.tsx
git commit -m "feat: store payment proofs privately behind an authed route"
```

- [x] **Step 7: Phase 3 gate**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`
Expected: all green. **Production note for the deploy that ships this:** verify the Blob store accepts `access: "private"` puts (`@vercel/blob` ≥ 2.x is already installed; the store was created as Public for event images — public event images and private proofs coexist per-blob). Test one proof upload in prod right after deploying. **Stop and get user approval before Phase 4.**

---

## Phase 4 — Buyer trust surface

### Task 10: Organizer contact phone (schema + API + account form)

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/lib/validations/auth.ts`
- Create: `src/app/api/account/profile/route.ts`
- Create: `src/components/account/ProfileForm.tsx`
- Modify: `src/app/account/page.tsx`
- Test: `src/lib/validations/profile.test.ts` (create)

- [x] **Step 1: Add the column and migrate**

In `prisma/schema.prisma`, in `model User`, after the `image String?` line add:

```prisma
  /// Shown to buyers on the organizer's events (WhatsApp/phone, with country code)
  phone         String?
```

Run: `pnpm db:migrate --name user_phone`
Expected: migration created and applied. Then `pnpm prisma generate` and restart the dev server.

- [x] **Step 2: Write the failing validation test**

Create `src/lib/validations/profile.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { updateProfileSchema } from "@/lib/validations/auth";

describe("updateProfileSchema", () => {
  it("accepts an international phone", () => {
    const result = updateProfileSchema.safeParse({ phone: "+591 70000000" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.phone).toBe("+591 70000000");
  });

  it("turns an empty string into null (clears the phone)", () => {
    const result = updateProfileSchema.safeParse({ phone: "" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.phone).toBeNull();
  });

  it("rejects letters", () => {
    expect(updateProfileSchema.safeParse({ phone: "llamame" }).success).toBe(
      false,
    );
  });
});
```

Run: `pnpm test -- src/lib/validations/profile.test.ts`
Expected: FAIL — `updateProfileSchema` is not exported.

- [x] **Step 3: Add the schema**

Append to `src/lib/validations/auth.ts` (before the type exports at the bottom):

```ts
export const updateProfileSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(
      /^\+?[\d\s-]{7,15}$/,
      "Ingresá un número válido con código de país (ej: +591 70000000)",
    )
    .or(z.literal(""))
    .transform((value) => (value === "" ? null : value)),
});
```

Run: `pnpm test -- src/lib/validations/profile.test.ts`
Expected: PASS.

- [x] **Step 4: Create the API route**

Create `src/app/api/account/profile/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { updateProfileSchema } from "@/lib/validations/auth";

export async function POST(request: Request) {
  const { session, error } = await requireRole("BUYER", "ORGANIZER", "ADMIN");
  if (error) return error;

  const body = await request.json().catch(() => null);
  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 },
    );
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { phone: parsed.data.phone },
  });
  return NextResponse.json({ ok: true });
}
```

- [x] **Step 5: Create the form component**

Create `src/components/account/ProfileForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";

export function ProfileForm({ initialPhone }: { initialPhone: string | null }) {
  const router = useRouter();
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setStatus("saving");
    setError(null);
    const response = await fetch("/api/account/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? "No se pudo guardar el teléfono");
      setStatus("idle");
      return;
    }
    setStatus("saved");
    router.refresh();
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="profile-phone">Teléfono / WhatsApp</Label>
        <Input
          id="profile-phone"
          type="tel"
          placeholder="+591 70000000"
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value);
            setStatus("idle");
          }}
        />
        <p className="text-xs text-muted-foreground">
          Incluí el código de país. Los compradores lo verán en tus eventos
          para consultas sobre pagos. Dejalo vacío para ocultarlo.
        </p>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div>
        <Button type="submit" size="sm" disabled={status === "saving"}>
          {status === "saving"
            ? "Guardando..."
            : status === "saved"
              ? "Guardado ✓"
              : "Guardar"}
        </Button>
      </div>
    </form>
  );
}
```

- [x] **Step 6: Render it on the account page (organizers/admins only)**

In `src/app/account/page.tsx`:

Add the import:

```ts
import { ProfileForm } from "@/components/account/ProfileForm";
```

Add `phone: true,` to the `prisma.user.findUnique` select (after `role: true,`).

Insert a new card between the "Datos de la cuenta" card and the "Cambiar contraseña" card:

```tsx
      {user.role !== "BUYER" && (
        <Card>
          <CardHeader>
            <CardTitle>Contacto para compradores</CardTitle>
          </CardHeader>
          <CardContent>
            <ProfileForm initialPhone={user.phone} />
          </CardContent>
        </Card>
      )}
```

- [x] **Step 7: Verify and commit**

In dev, as `organizador@boletavip.com`, open `/account`, save `+591 70000000`, reload — value persists. As `comprador@boletavip.com` the card must not appear.

Run: `pnpm test && pnpm typecheck`
Expected: PASS.

```bash
git add prisma/schema.prisma prisma/migrations src/lib/validations/auth.ts src/lib/validations/profile.test.ts src/app/api/account/profile/route.ts src/components/account/ProfileForm.tsx src/app/account/page.tsx
git commit -m "feat: organizer contact phone on the account page"
```

---

### Task 11: Show the organizer's contact to buyers

**Files:**
- Modify: `src/app/(public)/events/[id]/page.tsx`
- Modify: `src/app/orders/[id]/page.tsx`

- [x] **Step 1: Event page — fetch and render the phone**

In `src/app/(public)/events/[id]/page.tsx`:

Change the organizer select inside `getApprovedEvent`:

```ts
      organizer: { select: { name: true } },
```
→
```ts
      organizer: { select: { name: true, phone: true } },
```

In the "Detalles" card, after the 📍 venue block, add:

```tsx
              {event.organizer.phone && (
                <div className="flex items-start gap-3">
                  <span>📞</span>
                  <div>
                    <p className="font-medium">Contacto del organizador</p>
                    <a
                      href={`https://wa.me/${event.organizer.phone.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {event.organizer.phone}
                    </a>
                  </div>
                </div>
              )}
```

- [x] **Step 2: Order page — fetch and render the phone**

In `src/app/orders/[id]/page.tsx`:

Change the event select in the order query:

```ts
      event: {
        select: {
          id: true,
          title: true,
          date: true,
          time: true,
          organizerId: true,
          venue: { select: { name: true, city: true } },
        },
      },
```
→
```ts
      event: {
        select: {
          id: true,
          title: true,
          date: true,
          time: true,
          organizerId: true,
          organizer: { select: { phone: true } },
          venue: { select: { name: true, city: true } },
        },
      },
```

After the `const total = Number(order.totalAmount);` line, add:

```tsx
  const organizerPhone = order.event.organizer.phone;
  const organizerContact = organizerPhone ? (
    <p className="text-sm text-muted-foreground">
      ¿Dudas con el pago? Contactá al organizador:{" "}
      <a
        href={`https://wa.me/${organizerPhone.replace(/\D/g, "")}`}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-primary hover:underline"
      >
        {organizerPhone}
      </a>
    </p>
  ) : null;
```

Render `{organizerContact}` in three spots:
1. In the PENDING_PAYMENT "Instrucciones" card, right after the `</ol>` closing tag.
2. In the PAYMENT_SUBMITTED "Comprobante en revisión" card, after the intro `<p>…no hace falta que te quedes en esta página.</p>`.
3. In the CANCELLED block, after the rejection-reason `<p>` and before the "Volver al evento" link.

- [x] **Step 3: Verify and commit**

In dev, with the organizer's phone saved: the event page shows 📞 with a `wa.me` link; an order's pending/review/cancelled views show the contact line; with the phone cleared nothing renders.

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

```bash
git add "src/app/(public)/events/[id]/page.tsx" src/app/orders/[id]/page.tsx
git commit -m "feat: show organizer contact on event and order pages"
```

---

### Task 12: Help, terms & privacy pages + footer links

**Files:**
- Create: `src/app/(public)/help/page.tsx`
- Create: `src/app/(public)/terms/page.tsx`
- Create: `src/app/(public)/privacy/page.tsx`
- Modify: `src/components/layout/Footer.tsx`

- [x] **Step 1: Create the help page**

Create `src/app/(public)/help/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Ayuda" };

const faqs = [
  {
    q: "¿Cómo compro un boleto?",
    a: "Elegí un evento, seleccioná tu zona o asiento y creá el pedido. Vas a ver el QR bancario del organizador: transferí el monto exacto desde la app de tu banco, sacale captura al comprobante y subilo en la página del pedido. Tenés 15 minutos para subir el comprobante antes de que el pedido expire.",
  },
  {
    q: "Ya pagué, ¿cuándo recibo mis boletos?",
    a: "El organizador revisa tu comprobante manualmente — le avisamos por correo apenas lo subís. La mayoría de los pagos se confirman en pocas horas. Cuando lo verifique, te llega un correo y tus boletos con QR aparecen en \"Mis pedidos\". No hace falta que te quedes esperando en la página.",
  },
  {
    q: "¿Qué pasa si el organizador rechaza mi comprobante?",
    a: "Te avisamos por correo con el motivo y los asientos se liberan. Si creés que es un error, contactá al organizador — su teléfono aparece en la página del evento y del pedido. Üticket no retiene tu dinero: el pago va directo a la cuenta del organizador, así que cualquier devolución la coordina él.",
  },
  {
    q: "¿Cómo entro al evento?",
    a: "Mostrá el QR de tu boleto en la puerta (desde la página del pedido, el PNG descargado o el PDF). Cada boleto se acepta una sola vez. Te recomendamos descargarlo antes por si no hay señal en el lugar.",
  },
  {
    q: "¿Puedo cancelar un pedido?",
    a: "Podés cancelar un pedido mientras esté esperando pago. Una vez que subiste el comprobante, la revisión queda en manos del organizador.",
  },
  {
    q: "Quiero vender entradas para mi evento",
    a: "Registrate como organizador (o pedí el cambio desde tu cuenta), creá tu venue y tu evento, y subí el QR de cobro de tu banco. Un administrador revisa el evento antes de publicarlo.",
  },
];

export default function HelpPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10">
      <div>
        <h1 className="text-3xl font-bold">Ayuda</h1>
        <p className="mt-1 text-muted-foreground">
          Las respuestas a lo que más nos preguntan.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        {faqs.map((faq) => (
          <section key={faq.q}>
            <h2 className="font-semibold">{faq.q}</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {faq.a}
            </p>
          </section>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">
        ¿No encontraste tu respuesta? Revisá los{" "}
        <Link href="/terms" className="text-primary hover:underline">
          términos y condiciones
        </Link>{" "}
        o escribinos a soporte.
      </p>
    </div>
  );
}
```

- [x] **Step 2: Create the terms page**

Create `src/app/(public)/terms/page.tsx`:

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Términos y condiciones" };

const sections = [
  {
    title: "1. Qué es Üticket",
    body: "Üticket es una plataforma que conecta organizadores de eventos con compradores de boletos en Bolivia. Üticket no organiza los eventos ni procesa los pagos: el dinero se transfiere directamente del comprador a la cuenta bancaria del organizador mediante su QR de cobro.",
  },
  {
    title: "2. Pagos y confirmación",
    body: "Al crear un pedido, el comprador dispone de 15 minutos para subir el comprobante de la transferencia. El organizador verifica el comprobante manualmente y, al confirmarlo, se emiten los boletos con código QR. Üticket no retiene fondos ni garantiza la verificación en un plazo determinado.",
  },
  {
    title: "3. Rechazos y devoluciones",
    body: "Si el organizador rechaza un comprobante, los asientos se liberan y se notifica al comprador con el motivo. Cualquier devolución de dinero se coordina directamente con el organizador, cuyo contacto figura en la página del evento. Üticket puede mediar de buena fe pero no es responsable de las devoluciones.",
  },
  {
    title: "4. Boletos y entrada",
    body: "Cada boleto tiene un código QR único que se acepta una sola vez en la puerta. El comprador es responsable de no compartir su QR: la primera persona que lo presente será admitida.",
  },
  {
    title: "5. Eventos cancelados",
    body: "Si un evento se cancela, el organizador es responsable de la devolución del dinero a los compradores. Üticket marcará el evento como cancelado y facilitará el contacto entre las partes.",
  },
  {
    title: "6. Cuentas y conducta",
    body: "Está prohibido usar la plataforma para retener inventario sin intención de compra, subir comprobantes falsos o revender boletos de forma fraudulenta. Üticket puede suspender cuentas que incumplan estas condiciones.",
  },
  {
    title: "7. Cambios a estos términos",
    body: "Üticket puede actualizar estos términos; los cambios rigen desde su publicación en esta página.",
  },
];

export default function TermsPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10">
      <div>
        <h1 className="text-3xl font-bold">Términos y condiciones</h1>
        <p className="mt-1 text-muted-foreground">
          Última actualización: julio de 2026.
        </p>
      </div>
      <div className="flex flex-col gap-6">
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="font-semibold">{section.title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {section.body}
            </p>
          </section>
        ))}
      </div>
    </div>
  );
}
```

- [x] **Step 3: Create the privacy page**

Create `src/app/(public)/privacy/page.tsx`:

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacidad" };

const sections = [
  {
    title: "Qué datos guardamos",
    body: "Tu nombre, correo y (si sos organizador) tu teléfono de contacto; los pedidos y boletos que generás; y los comprobantes de pago que subís. Los comprobantes se almacenan de forma privada y solo pueden verlos vos, el organizador del evento y los administradores de la plataforma.",
  },
  {
    title: "Para qué los usamos",
    body: "Para emitir y validar tus boletos, para que el organizador pueda verificar tu pago y contactarte si hace falta, y para enviarte correos transaccionales (verificación de cuenta, confirmación o rechazo de pedidos). No enviamos publicidad ni compartimos tus datos con terceros ajenos a la operación del servicio.",
  },
  {
    title: "Dónde se almacenan",
    body: "Los datos viven en proveedores de infraestructura en la nube (base de datos y almacenamiento de archivos) contratados por Üticket. Las contraseñas se guardan cifradas con hash; nunca en texto plano.",
  },
  {
    title: "Tus derechos",
    body: "Podés pedir la corrección o eliminación de tus datos escribiéndonos. Ten en cuenta que los registros de pedidos confirmados pueden conservarse por obligaciones contables del organizador.",
  },
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10">
      <div>
        <h1 className="text-3xl font-bold">Política de privacidad</h1>
        <p className="mt-1 text-muted-foreground">
          Última actualización: julio de 2026.
        </p>
      </div>
      <div className="flex flex-col gap-6">
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="font-semibold">{section.title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {section.body}
            </p>
          </section>
        ))}
      </div>
    </div>
  );
}
```

- [x] **Step 4: Link them from the footer**

Replace the entire contents of `src/components/layout/Footer.tsx` with:

```tsx
import Link from "next/link";

const links = [
  { href: "/help", label: "Ayuda" },
  { href: "/terms", label: "Términos" },
  { href: "/privacy", label: "Privacidad" },
];

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row">
        <p>© {new Date().getFullYear()} Üticket. Todos los derechos reservados.</p>
        <nav className="flex items-center gap-4">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="hover:text-foreground hover:underline"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <p>Boletos digitales para tus eventos favoritos 🇧🇴</p>
      </div>
    </footer>
  );
}
```

- [x] **Step 5: Verify and commit**

Open `/help`, `/terms`, `/privacy` in dev (logged out) — all render with the shared navbar/footer; footer links work in light and dark mode.

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

```bash
git add "src/app/(public)/help" "src/app/(public)/terms" "src/app/(public)/privacy" src/components/layout/Footer.tsx
git commit -m "feat: help, terms and privacy pages with footer links"
```

---

### Task 13: Search events by name

**Files:**
- Modify: `src/components/events/EventFilters.tsx`
- Modify: `src/app/(public)/events/page.tsx`

- [x] **Step 1: Add the `q` filter to the component**

In `src/components/events/EventFilters.tsx`:

Add `q?: string;` to `EventFilterValues`:

```ts
export interface EventFilterValues {
  q?: string;
  categoria?: string;
  ciudad?: string;
  fecha?: string;
  precio?: string;
}
```

Add state next to the others:

```ts
  const [query, setQuery] = useState(current.q ?? "");
```

Include it in `hasActiveFilters`:

```ts
  const hasActiveFilters =
    current.q ||
    current.categoria ||
    current.ciudad ||
    current.fecha ||
    current.precio;
```

In `applyFilters`, before `if (categoria)`:

```ts
    if (query.trim()) params.set("q", query.trim());
```

In `clearFilters`, add `setQuery("");` alongside the other resets.

Change the wrapper grid from `lg:grid-cols-5` to `lg:grid-cols-6` and insert this as the **first** field (before Categoría):

```tsx
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="filter-query">Buscar</Label>
        <Input
          id="filter-query"
          type="search"
          placeholder="Nombre del evento"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") applyFilters();
          }}
        />
      </div>
```

- [x] **Step 2: Apply it in the server query**

In `src/app/(public)/events/page.tsx`, extend the `where` object:

```ts
  const where: Prisma.EventWhereInput = {
    status: "APPROVED",
    date: { gte: filters.fecha ? eventDate(filters.fecha) : startOfToday },
    ...(filters.q?.trim()
      ? { title: { contains: filters.q.trim(), mode: "insensitive" } }
      : {}),
    ...(filters.categoria ? { category: filters.categoria } : {}),
    ...(filters.ciudad ? { venue: { city: filters.ciudad } } : {}),
    ...(filters.precio && Number(filters.precio) > 0
      ? { price: { lte: Number(filters.precio) } }
      : {}),
  };
```

- [x] **Step 3: Verify and commit**

In dev, `/events?q=<partial seed event title>` returns matches case-insensitively; combining with a category filter works; "Limpiar" clears the box.

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

```bash
git add src/components/events/EventFilters.tsx "src/app/(public)/events/page.tsx"
git commit -m "feat: search events by title"
```

- [x] **Step 4: Phase 4 gate**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`
Expected: all green. **Stop and get user approval before Phase 5.**

---

## Phase 5 — Organizer operations

### Task 14: Shared order-item labels + CSV helper

Extract the item-summary formatting used by the dashboard (and soon the CSV export), and add an RFC-4180 CSV writer.

**Files:**
- Create: `src/lib/order-items.ts`
- Create: `src/lib/csv.ts`
- Modify: `src/app/dashboard/orders/page.tsx`
- Test: `src/lib/csv.test.ts` (create)

- [x] **Step 1: Write the failing CSV test**

Create `src/lib/csv.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { csvField, csvLine } from "@/lib/csv";

describe("csvField", () => {
  it("passes plain values through", () => {
    expect(csvField("Ana")).toBe("Ana");
    expect(csvField(42)).toBe("42");
  });

  it("quotes fields with commas and newlines", () => {
    expect(csvField("General × 2, Platea A1")).toBe('"General × 2, Platea A1"');
    expect(csvField("línea1\nlínea2")).toBe('"línea1\nlínea2"');
  });

  it("escapes embedded quotes", () => {
    expect(csvField('El "Show"')).toBe('"El ""Show"""');
  });
});

describe("csvLine", () => {
  it("joins fields with commas", () => {
    expect(csvLine(["a", "b,c", 1])).toBe('a,"b,c",1');
  });
});
```

Run: `pnpm test -- src/lib/csv.test.ts`
Expected: FAIL — module `@/lib/csv` not found.

- [x] **Step 2: Implement `src/lib/csv.ts`**

```ts
/** RFC 4180: quote a field when it contains a delimiter, quote or newline. */
export function csvField(value: string | number) {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function csvLine(fields: (string | number)[]) {
  return fields.map(csvField).join(",");
}
```

Run: `pnpm test -- src/lib/csv.test.ts`
Expected: PASS.

- [x] **Step 3: Create `src/lib/order-items.ts`**

```ts
export interface OrderItemLike {
  quantity: number;
  seat: { row: string; number: number } | null;
  zone: { name: string } | null;
}

/** "Platea A3" for a numbered seat, "General × 4" for a free-capacity zone. */
export function orderItemLabel(item: OrderItemLike) {
  if (item.seat) {
    return `${item.zone?.name ?? ""} ${item.seat.row}${item.seat.number}`.trim();
  }
  return `${item.zone?.name ?? "Zona"} × ${item.quantity}`;
}

export function orderItemsSummary(items: OrderItemLike[]) {
  return items.map(orderItemLabel).join(", ");
}
```

- [x] **Step 4: Use it in the dashboard orders page**

In `src/app/dashboard/orders/page.tsx`:
- Delete the local `itemsSummary` function (lines defining `function itemsSummary(...)`).
- Add the import: `import { orderItemsSummary } from "@/lib/order-items";`
- Replace all three `itemsSummary(order.items)` call sites with `orderItemsSummary(order.items)`.

- [x] **Step 5: Run checks and commit**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: PASS.

```bash
git add src/lib/csv.ts src/lib/csv.test.ts src/lib/order-items.ts src/app/dashboard/orders/page.tsx
git commit -m "refactor: shared order-item labels and CSV helpers"
```

---

### Task 15: CSV export of an event's buyers

**Files:**
- Create: `src/app/api/events/[id]/buyers/export/route.ts`
- Modify: `src/app/dashboard/events/[id]/buyers/page.tsx`

- [x] **Step 1: Create the export route**

Create `src/app/api/events/[id]/buyers/export/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { expireStaleOrders } from "@/lib/orders";
import { csvLine } from "@/lib/csv";
import { orderItemsSummary } from "@/lib/order-items";
import { formatDateTime } from "@/lib/utils";
import { ORDER_STATUS_LABELS } from "@/lib/constants";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const { session, error } = await requireRole("ORGANIZER", "ADMIN");
  if (error) return error;

  const { id } = await params;
  await expireStaleOrders();

  const event = await prisma.event.findUnique({
    where: { id },
    select: { organizerId: true },
  });
  if (
    !event ||
    (event.organizerId !== session.user.id && session.user.role !== "ADMIN")
  ) {
    return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  }

  const orders = await prisma.order.findMany({
    where: {
      eventId: id,
      status: { in: ["PENDING_PAYMENT", "PAYMENT_SUBMITTED", "CONFIRMED"] },
    },
    include: {
      buyer: { select: { name: true, email: true } },
      items: {
        include: {
          seat: { select: { row: true, number: true } },
          zone: { select: { name: true } },
        },
      },
      _count: { select: { tickets: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const lines = [
    csvLine(["Comprador", "Correo", "Estado", "Detalle", "Boletos", "Monto (Bs)", "Fecha"]),
    ...orders.map((order) =>
      csvLine([
        order.buyer.name ?? "",
        order.buyer.email,
        ORDER_STATUS_LABELS[order.status].label,
        orderItemsSummary(order.items),
        order._count.tickets,
        Number(order.totalAmount).toFixed(2),
        formatDateTime(order.createdAt),
      ]),
    ),
  ];

  // Leading BOM so Excel opens the file as UTF-8
  return new Response("\uFEFF" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="compradores-${id}.csv"`,
    },
  });
}
```

- [x] **Step 2: Add the download button**

In `src/app/dashboard/events/[id]/buyers/page.tsx`, replace the header's back link:

```tsx
        <Link
          href="/dashboard/events"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          ← Mis eventos
        </Link>
```

with:

```tsx
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/api/events/${event.id}/buyers/export`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Exportar CSV
          </a>
          <Link
            href="/dashboard/events"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            ← Mis eventos
          </Link>
        </div>
```

- [x] **Step 3: Verify and commit**

In dev, as the organizer, download the CSV from a seeded event's buyers page; open it and check headers, item summaries with commas are quoted, and totals have 2 decimals. Confirm another organizer's session gets a 404 from the raw URL.

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: PASS.

```bash
git add "src/app/api/events/[id]/buyers/export" "src/app/dashboard/events/[id]/buyers/page.tsx"
git commit -m "feat: CSV export of an event's buyers"
```

---

### Task 16: Door scan codes (staff check-in without an account)

Per-event bearer code: `Event.scanCode` unlocks a public `/scan/[code]` page whose scanner can only verify that event's tickets. Rotating the code invalidates the old link. Staff never see revenue or payment screens.

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `src/app/api/events/[id]/scan-code/route.ts`
- Modify: `src/lib/validations/ticket.ts`
- Modify: `src/app/api/tickets/verify/route.ts`
- Modify: `src/components/dashboard/TicketScanner.tsx`
- Create: `src/app/scan/[code]/page.tsx`
- Create: `src/components/dashboard/ScanAccessButton.tsx`
- Modify: `src/app/dashboard/events/[id]/buyers/page.tsx`
- (Scan-code verify path covered by integration test in Task 19.)

- [x] **Step 1: Add the column and migrate**

In `prisma/schema.prisma`, in `model Event`, after the `paymentQrImage String?` line add:

```prisma
  /// Bearer code for the public door-scanner page (/scan/[code]); rotatable
  scanCode       String?     @unique
```

Run: `pnpm db:migrate --name event_scan_code`, then `pnpm prisma generate` and restart the dev server.

- [x] **Step 2: Create the scan-code management route**

Create `src/app/api/events/[id]/scan-code/route.ts`:

```ts
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Returns the event's door-access code, creating it on first request.
 * Pass { rotate: true } to invalidate the previous link and issue a new one.
 */
export async function POST(request: Request, { params }: RouteContext) {
  const { session, error } = await requireRole("ORGANIZER", "ADMIN");
  if (error) return error;

  const { id } = await params;
  const event = await prisma.event.findUnique({
    where: { id },
    select: { id: true, status: true, organizerId: true, scanCode: true },
  });
  if (!event) {
    return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  }
  if (event.organizerId !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "No tenés permisos sobre este evento" },
      { status: 403 },
    );
  }
  if (event.status !== "APPROVED") {
    return NextResponse.json(
      { error: "Solo los eventos aprobados tienen acceso de puerta" },
      { status: 409 },
    );
  }

  const body = await request.json().catch(() => null);
  const rotate = Boolean((body as { rotate?: boolean } | null)?.rotate);

  if (event.scanCode && !rotate) {
    return NextResponse.json({ scanCode: event.scanCode });
  }
  const updated = await prisma.event.update({
    where: { id: event.id },
    data: { scanCode: randomUUID() },
    select: { scanCode: true },
  });
  return NextResponse.json({ scanCode: updated.scanCode });
}
```

- [x] **Step 3: Accept the scan code in the verify schema**

Replace the schema in `src/lib/validations/ticket.ts`:

```ts
import { z } from "zod";

export const verifyTicketSchema = z.object({
  code: z.uuid("Código de boleto inválido"),
  scanCode: z.uuid().optional(),
});

export type VerifyTicketInput = z.input<typeof verifyTicketSchema>;
```

- [x] **Step 4: Rework the verify route's authorization**

In `src/app/api/tickets/verify/route.ts`, replace the beginning of `POST` (the `requireRole` call, body parsing, and the FORBIDDEN ownership check) so the whole function reads:

```ts
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = verifyTicketSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { result: "INVALID_CODE", error: "El código escaneado no es un boleto válido" },
      { status: 400 },
    );
  }

  // Door staff authenticate with the event's scan code instead of a session
  let scanEventId: string | null = null;
  let sessionUserId: string | null = null;
  let isAdmin = false;

  if (parsed.data.scanCode) {
    const scanEvent = await prisma.event.findUnique({
      where: { scanCode: parsed.data.scanCode },
      select: { id: true },
    });
    if (!scanEvent) {
      return NextResponse.json(
        { result: "FORBIDDEN", error: "El código de acceso de puerta no es válido" },
        { status: 403 },
      );
    }
    scanEventId = scanEvent.id;
  } else {
    const { session, error } = await requireRole("ORGANIZER", "ADMIN");
    if (error) return error;
    sessionUserId = session.user.id;
    isAdmin = session.user.role === "ADMIN";
  }

  const ticket = await prisma.ticket.findUnique({
    where: { code: parsed.data.code },
    include: {
      event: { select: { title: true, date: true, time: true, organizerId: true } },
      seat: { select: { row: true, number: true } },
      zone: { select: { name: true } },
      order: { select: { buyer: { select: { name: true, email: true } } } },
    },
  });

  if (!ticket) {
    return NextResponse.json(
      { result: "NOT_FOUND", error: "Este boleto no existe" },
      { status: 404 },
    );
  }

  const allowed = scanEventId
    ? ticket.eventId === scanEventId
    : isAdmin || ticket.event.organizerId === sessionUserId;
  if (!allowed) {
    return NextResponse.json(
      { result: "FORBIDDEN", error: "Este boleto pertenece a otro evento" },
      { status: 403 },
    );
  }
```

(The remainder of the function — the CANCELLED check, the atomic `updateMany` check-in, and the ACCEPTED/ALREADY_USED responses — stays exactly as it is.)

- [x] **Step 5: Thread the scan code through the scanner**

In `src/components/dashboard/TicketScanner.tsx`:

Change the component signature:

```ts
export function TicketScanner() {
```
→
```ts
export function TicketScanner({ scanCode }: { scanCode?: string } = {}) {
```

In the `verify` callback, change the fetch body:

```ts
        body: JSON.stringify({ code }),
```
→
```ts
        body: JSON.stringify(scanCode ? { code, scanCode } : { code }),
```

and update the callback's dependency array from `}, []);` to `}, [scanCode]);`.

- [x] **Step 6: Create the public scan page**

Create `src/app/scan/[code]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { TicketScanner } from "@/components/dashboard/TicketScanner";

export const metadata: Metadata = { title: "Control de puerta" };

export default async function ScanPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const event = await prisma.event.findUnique({
    where: { scanCode: code },
    select: { title: true, date: true, time: true, status: true },
  });
  if (!event || event.status !== "APPROVED") notFound();

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-bold">Control de puerta</h1>
        <p className="mt-1 text-muted-foreground">
          {event.title} · {formatDate(event.date)} · {event.time} hrs
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Escaneá el QR de cada boleto. Cada uno se acepta una sola vez.
        </p>
      </div>
      <TicketScanner scanCode={code} />
    </div>
  );
}
```

(`/scan` is not in the proxy matcher, so the page is public by design — the unguessable code in the URL is the credential.)

- [x] **Step 7: Create the organizer-facing button**

Create `src/components/dashboard/ScanAccessButton.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

/** Fetches (or rotates) the event's door-access link and offers copy/share. */
export function ScanAccessButton({ eventId }: { eventId: string }) {
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchCode(rotate = false) {
    setLoading(true);
    setError(null);
    const response = await fetch(`/api/events/${eventId}/scan-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rotate }),
    });
    setLoading(false);
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.scanCode) {
      setError(data?.error ?? "No se pudo generar el acceso");
      return;
    }
    setLink(`${window.location.origin}/scan/${data.scanCode}`);
    setCopied(false);
  }

  async function copy() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
  }

  if (!link) {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={() => fetchCode()}
        >
          {loading ? "Generando..." : "Acceso para puerta"}
        </Button>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-1 rounded-lg border border-border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1 text-xs">
          {link}
        </code>
        <Button type="button" variant="outline" size="sm" onClick={copy}>
          {copied ? "¡Copiado!" : "Copiar"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={loading}
          onClick={() => fetchCode(true)}
        >
          {loading ? "..." : "Regenerar"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Compartí este enlace con tu personal de puerta: les abre el escáner de
        este evento sin necesidad de cuenta. Si se filtra, regeneralo.
      </p>
    </div>
  );
}
```

- [x] **Step 8: Surface it on the buyers page**

In `src/app/dashboard/events/[id]/buyers/page.tsx`:

Add the imports:

```ts
import { ScanAccessButton } from "@/components/dashboard/ScanAccessButton";
```

Also add `status: true,` to the event `select` in this page's `findUnique`.

Below the header `<div className="flex flex-wrap items-center justify-between gap-3">...</div>` block (immediately after its closing tag), insert:

```tsx
      {event.status === "APPROVED" && <ScanAccessButton eventId={event.id} />}
```

- [x] **Step 9: Verify end to end**

In dev: generate the link from a seeded approved event's buyers page, open it **in an incognito window** (no session), verify a confirmed ticket's code via manual input — first scan `✅`, second `⛔ ya utilizado`. Try a ticket from a *different* event — `⚠️ FORBIDDEN`. Regenerate the code and confirm the old link 404s.

- [x] **Step 10: Run checks and commit**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: PASS.

```bash
git add prisma/schema.prisma prisma/migrations "src/app/api/events/[id]/scan-code" src/lib/validations/ticket.ts src/app/api/tickets/verify/route.ts src/components/dashboard/TicketScanner.tsx src/app/scan src/components/dashboard/ScanAccessButton.tsx "src/app/dashboard/events/[id]/buyers/page.tsx"
git commit -m "feat: door scan codes for staff check-in without accounts"
```

---

### Task 17: Downloadable PDF tickets

**Files:**
- Modify: `package.json` (new dep `pdf-lib`)
- Create: `src/lib/ticket-pdf.ts`
- Create: `src/app/api/tickets/[id]/pdf/route.ts`
- Modify: `src/components/orders/TicketCard.tsx`
- Test: `src/lib/ticket-pdf.test.ts` (create)

- [x] **Step 1: Install the dependency**

Run: `pnpm add pdf-lib`
Expected: added to `dependencies`.

- [x] **Step 2: Write the failing test**

Create `src/lib/ticket-pdf.test.ts`:

```ts
import QRCode from "qrcode";
import { describe, expect, it } from "vitest";
import { buildTicketPdf, dataUrlToBytes } from "@/lib/ticket-pdf";

describe("dataUrlToBytes", () => {
  it("decodes the base64 payload", () => {
    const bytes = dataUrlToBytes("data:image/png;base64,aGVsbG8=");
    expect(new TextDecoder().decode(bytes)).toBe("hello");
  });
});

describe("buildTicketPdf", () => {
  it("produces a PDF with the QR embedded", async () => {
    const qrDataUrl = await QRCode.toDataURL("test-code", {
      width: 320,
      margin: 2,
    });
    const pdf = await buildTicketPdf({
      eventTitle: "Concierto de prueba 🎵", // emoji must not crash encoding
      dateLabel: "14 de julio de 2026",
      timeLabel: "20:00 hrs",
      venueLabel: "Teatro Municipal, La Paz",
      seatLabel: "Platea · Asiento A1",
      buyerName: "Ana Pérez",
      code: "123e4567-e89b-12d3-a456-426614174000",
      qrDataUrl,
    });
    expect(pdf.length).toBeGreaterThan(1000);
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe("%PDF-");
  });
});
```

Run: `pnpm test -- src/lib/ticket-pdf.test.ts`
Expected: FAIL — module `@/lib/ticket-pdf` not found.

- [x] **Step 3: Implement `src/lib/ticket-pdf.ts`**

```ts
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export interface TicketPdfInput {
  eventTitle: string;
  dateLabel: string;
  timeLabel: string;
  venueLabel: string;
  seatLabel: string;
  buyerName: string;
  code: string;
  qrDataUrl: string;
}

export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return new Uint8Array(Buffer.from(base64, "base64"));
}

/** Standard fonts only cover WinAnsi; drop anything else (emoji, CJK…). */
function winAnsiSafe(text: string) {
  return text.replace(/[^\x20-\x7E\u00A0-\u00FF]/g, "").trim();
}

const PAGE_WIDTH = 420;
const PAGE_HEIGHT = 640;
const PURPLE = rgb(0.427, 0.169, 1); // brand #6D2BFF
const GRAY = rgb(0.42, 0.4, 0.5);
const DARK = rgb(0.17, 0.17, 0.17);

export async function buildTicketPdf(input: TicketPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const regular = await doc.embedFont(StandardFonts.Helvetica);

  page.drawText("Üticket", {
    x: 40,
    y: PAGE_HEIGHT - 60,
    size: 24,
    font: bold,
    color: PURPLE,
  });
  page.drawText("Tu entrada en un clic", {
    x: 40,
    y: PAGE_HEIGHT - 78,
    size: 10,
    font: regular,
    color: GRAY,
  });

  let y = PAGE_HEIGHT - 130;
  page.drawText(winAnsiSafe(input.eventTitle), {
    x: 40,
    y,
    size: 18,
    font: bold,
    color: DARK,
    maxWidth: PAGE_WIDTH - 80,
  });
  y -= 30;
  const lines = [
    `${winAnsiSafe(input.dateLabel)} - ${winAnsiSafe(input.timeLabel)}`,
    winAnsiSafe(input.venueLabel),
    winAnsiSafe(input.seatLabel),
    `A nombre de: ${winAnsiSafe(input.buyerName)}`,
  ];
  for (const line of lines) {
    page.drawText(line, {
      x: 40,
      y,
      size: 12,
      font: regular,
      color: DARK,
      maxWidth: PAGE_WIDTH - 80,
    });
    y -= 20;
  }

  const qr = await doc.embedPng(dataUrlToBytes(input.qrDataUrl));
  const qrSize = 240;
  page.drawImage(qr, {
    x: (PAGE_WIDTH - qrSize) / 2,
    y: 170,
    width: qrSize,
    height: qrSize,
  });

  page.drawText(input.code, {
    x: 40,
    y: 130,
    size: 10,
    font: regular,
    color: GRAY,
  });
  page.drawText(
    "Presenta este QR en la entrada. Cada boleto se acepta una sola vez.",
    { x: 40, y: 106, size: 10, font: regular, color: GRAY, maxWidth: PAGE_WIDTH - 80 },
  );

  return doc.save();
}
```

Run: `pnpm test -- src/lib/ticket-pdf.test.ts`
Expected: PASS.

- [x] **Step 4: Create the download route**

Create `src/app/api/tickets/[id]/pdf/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { formatDate } from "@/lib/utils";
import { buildTicketPdf } from "@/lib/ticket-pdf";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const { session, error } = await requireRole("BUYER", "ORGANIZER", "ADMIN");
  if (error) return error;

  const { id } = await params;
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      order: {
        select: { buyerId: true, buyer: { select: { name: true, email: true } } },
      },
      event: {
        select: {
          title: true,
          date: true,
          time: true,
          organizerId: true,
          venue: { select: { name: true, city: true } },
        },
      },
      seat: { select: { row: true, number: true } },
      zone: { select: { name: true } },
    },
  });
  if (
    !ticket ||
    !ticket.qrCode ||
    (ticket.order.buyerId !== session.user.id &&
      ticket.event.organizerId !== session.user.id &&
      session.user.role !== "ADMIN")
  ) {
    return NextResponse.json({ error: "Boleto no encontrado" }, { status: 404 });
  }

  const pdf = await buildTicketPdf({
    eventTitle: ticket.event.title,
    dateLabel: formatDate(ticket.event.date),
    timeLabel: `${ticket.event.time} hrs`,
    venueLabel: `${ticket.event.venue.name}, ${ticket.event.venue.city}`,
    seatLabel: ticket.seat
      ? `${ticket.zone?.name ?? ""} · Asiento ${ticket.seat.row}${ticket.seat.number}`
      : (ticket.zone?.name ?? "Entrada general"),
    buyerName: ticket.order.buyer.name ?? ticket.order.buyer.email ?? "—",
    code: ticket.code,
    qrDataUrl: ticket.qrCode,
  });

  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="boleto-${ticket.code.slice(0, 8)}.pdf"`,
    },
  });
}
```

- [x] **Step 5: Link it from the ticket card**

In `src/components/orders/TicketCard.tsx`, replace the download block:

```tsx
        {ticket.qrCode && (
          <a
            href={ticket.qrCode}
            download={`boleto-${ticket.code.slice(0, 8)}.png`}
            className="text-sm font-medium text-primary hover:underline"
          >
            Descargar QR
          </a>
        )}
```

with:

```tsx
        {ticket.qrCode && (
          <div className="flex items-center gap-3">
            <a
              href={`/api/tickets/${ticket.id}/pdf`}
              className="text-sm font-medium text-primary hover:underline"
            >
              Descargar PDF
            </a>
            <a
              href={ticket.qrCode}
              download={`boleto-${ticket.code.slice(0, 8)}.png`}
              className="text-sm font-medium text-primary hover:underline"
            >
              Solo QR
            </a>
          </div>
        )}
```

- [x] **Step 6: Verify and commit**

In dev, as `comprador@boletavip.com` with a confirmed order, download a PDF: opens with title, date in Bolivia time, seat, buyer name and a scannable QR (scan it from the screen with `/dashboard/verify` as the organizer). An unauthenticated `curl` to the PDF URL returns 401; another buyer's session returns 404.

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: PASS.

```bash
git add package.json pnpm-lock.yaml src/lib/ticket-pdf.ts src/lib/ticket-pdf.test.ts "src/app/api/tickets/[id]/pdf" src/components/orders/TicketCard.tsx
git commit -m "feat: downloadable PDF tickets"
```

- [x] **Step 7: Phase 5 gate**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`
Expected: all green. **Stop and get user approval before Phase 6.**

---

## Phase 6 — Reliability

### Task 18: Surface email failures to the organizer

`sendEmail` already returns `{ ok }` and never throws; today the result is discarded, so a confirmed order whose email failed leaves the buyer uninformed and nobody the wiser.

**Files:**
- Modify: `src/app/api/orders/[id]/confirm/route.ts`
- Modify: `src/app/api/orders/[id]/cancel/route.ts`
- Modify: `src/components/dashboard/OrderActions.tsx`

- [x] **Step 1: Return the email outcome from confirm**

In `src/app/api/orders/[id]/confirm/route.ts`, replace the tail:

```ts
  await sendEmail({ to: order.buyer.email, subject, html });

  return NextResponse.json({ ok: true, tickets: ticketsData.length });
```

with:

```ts
  const emailResult = await sendEmail({ to: order.buyer.email, subject, html });
  if (!emailResult.ok) {
    console.error(`[email] confirmation email failed for order ${order.id}`);
  }

  return NextResponse.json({
    ok: true,
    tickets: ticketsData.length,
    emailSent: emailResult.ok,
  });
```

- [x] **Step 2: Return the email outcome from cancel**

In `src/app/api/orders/[id]/cancel/route.ts`, replace the tail:

```ts
  // Notify the buyer only when the organizer rejected a submitted proof
  if (isOrganizer && !isBuyer && order.status === "PAYMENT_SUBMITTED") {
    const origin = new URL(request.url).origin;
    const { subject, html } = orderRejectedEmail(
      order.buyer.name,
      order.event.title,
      reason,
      `${origin}/events/${order.event.id}`,
    );
    await sendEmail({ to: order.buyer.email, subject, html });
  }

  return NextResponse.json({ ok: true });
```

with:

```ts
  // Notify the buyer only when the organizer rejected a submitted proof
  let emailSent: boolean | null = null;
  if (isOrganizer && !isBuyer && order.status === "PAYMENT_SUBMITTED") {
    const origin = new URL(request.url).origin;
    const { subject, html } = orderRejectedEmail(
      order.buyer.name,
      order.event.title,
      reason,
      `${origin}/events/${order.event.id}`,
    );
    const emailResult = await sendEmail({ to: order.buyer.email, subject, html });
    emailSent = emailResult.ok;
    if (!emailResult.ok) {
      console.error(`[email] rejection email failed for order ${order.id}`);
    }
  }

  return NextResponse.json({ ok: true, emailSent });
```

- [x] **Step 3: Show the warning in OrderActions**

In `src/components/dashboard/OrderActions.tsx`:

Add a `notice` state next to `error`:

```ts
  const [notice, setNotice] = useState<string | null>(null);
```

In `run(...)`, reset it (`setNotice(null);` next to `setError(null);`) and replace the success tail:

```ts
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? "La acción falló");
      return;
    }
    router.refresh();
```

with:

```ts
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      setError(data?.error ?? "La acción falló");
      return;
    }
    if (data?.emailSent === false) {
      setNotice(
        "Listo, pero el correo al comprador falló — avisale por otro medio.",
      );
    }
    router.refresh();
```

And render it under the error line:

```tsx
      {error && <p className="text-xs text-danger">{error}</p>}
      {notice && (
        <p className="text-xs text-amber-600 dark:text-amber-400">{notice}</p>
      )}
```

- [x] **Step 4: Verify and commit**

In dev, emails go to the console so `emailSent` is `true`; to see the warning path, temporarily set `BREVO_API_KEY=broken` in `.env`, restart, confirm an order and check the amber notice appears (then remove the var and restart).

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: PASS.

```bash
git add src/app/api/orders/[id]/confirm/route.ts src/app/api/orders/[id]/cancel/route.ts src/components/dashboard/OrderActions.tsx
git commit -m "feat: surface buyer-email failures to the organizer"
```

---

### Task 19: Integration tests for the money path

Real Postgres (dedicated `boletavip_test` DB), real route handlers, `@/lib/api-auth` mocked. Covers: order creation (happy path, capacity, unverified email, pending cap), lazy expiry, concurrent confirmation, and single-use check-in incl. the scan-code path.

**Files:**
- Create: `vitest.integration.config.ts`
- Create: `src/tests/integration/setup.ts`
- Create: `src/tests/integration/helpers.ts`
- Create: `src/tests/integration/orders.itest.ts`
- Create: `src/tests/integration/confirm.itest.ts`
- Create: `src/tests/integration/verify.itest.ts`
- Modify: `package.json`

- [x] **Step 1: Create the test database (one-time)**

Run: `createdb -O ichurri boletavip_test`
Expected: silent success (`psql -l | grep boletavip_test` shows it).

- [x] **Step 2: Add the config, guard and script**

Create `vitest.integration.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: ["src/tests/integration/**/*.itest.ts"],
    environment: "node",
    setupFiles: ["./vitest.setup.ts", "./src/tests/integration/setup.ts"],
    // Every file truncates shared tables; never run them in parallel
    fileParallelism: false,
    testTimeout: 20_000,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
```

Create `src/tests/integration/setup.ts`:

```ts
// cleanDatabase() truncates every table — refuse anything that doesn't look
// like a dedicated test database.
const url = process.env.DATABASE_URL ?? "";
const dbName = url.split("/").pop()?.split("?")[0] ?? "";
if (!dbName.endsWith("_test")) {
  throw new Error(
    `Integration tests require a dedicated *_test database, got "${dbName || "(unset)"}". ` +
      'Run: DATABASE_URL="postgresql://ichurri:boletavip_dev@localhost:5432/boletavip_test" pnpm test:integration',
  );
}
```

In `package.json`, add to `scripts`:

```json
    "test:integration": "prisma migrate deploy && vitest run --config vitest.integration.config.ts",
```

Invocation (bash): `DATABASE_URL="postgresql://ichurri:boletavip_dev@localhost:5432/boletavip_test" pnpm test:integration`
Invocation (fish): `env DATABASE_URL="postgresql://ichurri:boletavip_dev@localhost:5432/boletavip_test" pnpm test:integration`

- [x] **Step 3: Create the helpers**

Create `src/tests/integration/helpers.ts`:

```ts
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { eventDate } from "@/lib/utils";

export async function cleanDatabase() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "Ticket", "OrderItem", "Order", "Seat", "Zone", "Event", "Venue", "VerificationToken", "Session", "Account", "PlatformSettings", "User" CASCADE',
  );
}

export function futureDateString(daysAhead = 30) {
  return new Date(Date.now() + daysAhead * 86_400_000).toISOString().slice(0, 10);
}

export async function createBuyer({ verified = true } = {}) {
  return prisma.user.create({
    data: {
      email: `buyer-${randomUUID()}@test.local`,
      name: "Comprador Test",
      role: "BUYER",
      emailVerified: verified ? new Date() : null,
    },
  });
}

export async function createApprovedEvent({
  freeZoneCapacity = 10,
  numbered = false,
}: { freeZoneCapacity?: number; numbered?: boolean } = {}) {
  const organizer = await prisma.user.create({
    data: {
      email: `organizer-${randomUUID()}@test.local`,
      name: "Organizador Test",
      role: "ORGANIZER",
      emailVerified: new Date(),
    },
  });
  const venue = await prisma.venue.create({
    data: {
      name: "Venue Test",
      address: "Calle Falsa 123",
      city: "La Paz",
      capacity: numbered ? 4 : freeZoneCapacity,
      seatMapType: numbered ? "NUMBERED" : "ZONE",
      organizerId: organizer.id,
    },
  });
  const zone = await prisma.zone.create({
    data: {
      name: "General",
      capacity: numbered ? 4 : freeZoneCapacity,
      priceMultiplier: 1,
      venueId: venue.id,
      ...(numbered ? { rows: 2, seatsPerRow: 2 } : {}),
    },
  });
  const seats = numbered
    ? await prisma.seat.createManyAndReturn({
        data: [
          { row: "A", number: 1, zoneId: zone.id },
          { row: "A", number: 2, zoneId: zone.id },
          { row: "B", number: 1, zoneId: zone.id },
          { row: "B", number: 2, zoneId: zone.id },
        ],
      })
    : [];
  const event = await prisma.event.create({
    data: {
      title: "Evento Test",
      description: "Descripción de prueba",
      category: "Música",
      date: eventDate(futureDateString()),
      time: "20:00",
      status: "APPROVED",
      price: 100,
      paymentQrImage: "/uploads/qr-test.png",
      venueId: venue.id,
      organizerId: organizer.id,
    },
  });
  return { organizer, venue, zone, seats, event };
}

export function jsonRequest(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
```

- [x] **Step 4: Write the order tests**

Create `src/tests/integration/orders.itest.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({
  user: { id: "", role: "BUYER", name: "Test", email: "test@test.local" },
}));

vi.mock("@/lib/api-auth", async () => {
  const { NextResponse } = await import("next/server");
  return {
    requireRole: async (...roles: string[]) => {
      if (!authState.user.id) {
        return {
          error: NextResponse.json({ error: "No autenticado" }, { status: 401 }),
        };
      }
      if (!roles.includes(authState.user.role)) {
        return {
          error: NextResponse.json({ error: "Sin permisos" }, { status: 403 }),
        };
      }
      return { session: { user: authState.user } };
    },
  };
});

import { POST as createOrder } from "@/app/api/orders/route";
import { prisma } from "@/lib/prisma";
import { expireStaleOrders } from "@/lib/orders";
import {
  cleanDatabase,
  createApprovedEvent,
  createBuyer,
  jsonRequest,
} from "./helpers";

function actAs(user: { id: string; role: string }) {
  authState.user = { ...authState.user, ...user };
}

function orderRequest(body: unknown) {
  return jsonRequest("http://test.local/api/orders", body);
}

beforeEach(async () => {
  await cleanDatabase();
});

describe("POST /api/orders", () => {
  it("creates a pending order in a free-capacity zone", async () => {
    const buyer = await createBuyer();
    const { event, zone } = await createApprovedEvent();
    actAs({ id: buyer.id, role: "BUYER" });

    const response = await createOrder(
      orderRequest({
        eventId: event.id,
        seatIds: [],
        zones: [{ zoneId: zone.id, quantity: 2 }],
      }),
    );
    expect(response.status).toBe(201);

    const order = await prisma.order.findFirstOrThrow({
      where: { buyerId: buyer.id },
    });
    expect(order.status).toBe("PENDING_PAYMENT");
    expect(Number(order.totalAmount)).toBe(200);
  });

  it("rejects orders exceeding the zone capacity", async () => {
    const buyer = await createBuyer();
    const { event, zone } = await createApprovedEvent({ freeZoneCapacity: 3 });
    actAs({ id: buyer.id, role: "BUYER" });

    const response = await createOrder(
      orderRequest({
        eventId: event.id,
        seatIds: [],
        zones: [{ zoneId: zone.id, quantity: 4 }],
      }),
    );
    expect(response.status).toBe(409);
  });

  it("requires a verified email", async () => {
    const buyer = await createBuyer({ verified: false });
    const { event, zone } = await createApprovedEvent();
    actAs({ id: buyer.id, role: "BUYER" });

    const response = await createOrder(
      orderRequest({
        eventId: event.id,
        seatIds: [],
        zones: [{ zoneId: zone.id, quantity: 1 }],
      }),
    );
    expect(response.status).toBe(403);
  });

  it("caps unpaid orders per buyer at 3", async () => {
    const buyer = await createBuyer();
    const { event, zone } = await createApprovedEvent({ freeZoneCapacity: 100 });
    actAs({ id: buyer.id, role: "BUYER" });

    for (let i = 0; i < 3; i++) {
      const ok = await createOrder(
        orderRequest({
          eventId: event.id,
          seatIds: [],
          zones: [{ zoneId: zone.id, quantity: 1 }],
        }),
      );
      expect(ok.status).toBe(201);
    }
    const blocked = await createOrder(
      orderRequest({
        eventId: event.id,
        seatIds: [],
        zones: [{ zoneId: zone.id, quantity: 1 }],
      }),
    );
    expect(blocked.status).toBe(429);
  });
});

describe("expireStaleOrders", () => {
  it("cancels overdue orders and releases their seats", async () => {
    const buyer = await createBuyer();
    const { event, seats } = await createApprovedEvent({ numbered: true });
    actAs({ id: buyer.id, role: "BUYER" });

    const created = await createOrder(
      orderRequest({ eventId: event.id, seatIds: [seats[0].id], zones: [] }),
    );
    expect(created.status).toBe(201);

    await prisma.order.updateMany({
      where: { buyerId: buyer.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    await expireStaleOrders();

    const order = await prisma.order.findFirstOrThrow({
      where: { buyerId: buyer.id },
    });
    expect(order.status).toBe("CANCELLED");
    const seat = await prisma.seat.findUniqueOrThrow({
      where: { id: seats[0].id },
    });
    expect(seat.status).toBe("AVAILABLE");
  });
});
```

- [x] **Step 5: Write the concurrent-confirmation test**

Create `src/tests/integration/confirm.itest.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({
  user: { id: "", role: "BUYER", name: "Test", email: "test@test.local" },
}));

vi.mock("@/lib/api-auth", async () => {
  const { NextResponse } = await import("next/server");
  return {
    requireRole: async (...roles: string[]) => {
      if (!authState.user.id) {
        return {
          error: NextResponse.json({ error: "No autenticado" }, { status: 401 }),
        };
      }
      if (!roles.includes(authState.user.role)) {
        return {
          error: NextResponse.json({ error: "Sin permisos" }, { status: 403 }),
        };
      }
      return { session: { user: authState.user } };
    },
  };
});

import { POST as createOrder } from "@/app/api/orders/route";
import { POST as confirmOrder } from "@/app/api/orders/[id]/confirm/route";
import { prisma } from "@/lib/prisma";
import {
  cleanDatabase,
  createApprovedEvent,
  createBuyer,
  jsonRequest,
} from "./helpers";

function actAs(user: { id: string; role: string }) {
  authState.user = { ...authState.user, ...user };
}

beforeEach(async () => {
  await cleanDatabase();
});

describe("POST /api/orders/[id]/confirm", () => {
  it("issues tickets exactly once under concurrent confirms", async () => {
    const buyer = await createBuyer();
    const { organizer, event, zone } = await createApprovedEvent();

    actAs({ id: buyer.id, role: "BUYER" });
    const created = await createOrder(
      jsonRequest("http://test.local/api/orders", {
        eventId: event.id,
        seatIds: [],
        zones: [{ zoneId: zone.id, quantity: 2 }],
      }),
    );
    expect(created.status).toBe(201);
    const order = await prisma.order.findFirstOrThrow({
      where: { buyerId: buyer.id },
    });
    await prisma.order.update({
      where: { id: order.id },
      data: { status: "PAYMENT_SUBMITTED", paymentProof: "proofs/test.jpg" },
    });

    actAs({ id: organizer.id, role: "ORGANIZER" });
    const makeRequest = () =>
      confirmOrder(
        new Request(`http://test.local/api/orders/${order.id}/confirm`, {
          method: "POST",
        }),
        { params: Promise.resolve({ id: order.id }) },
      );

    const [first, second] = await Promise.all([makeRequest(), makeRequest()]);
    expect([first.status, second.status].sort()).toEqual([200, 409]);

    const ticketCount = await prisma.ticket.count({
      where: { orderId: order.id },
    });
    expect(ticketCount).toBe(2);

    const confirmed = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
    });
    expect(confirmed.status).toBe("CONFIRMED");
  });
});
```

- [x] **Step 6: Write the check-in tests**

Create `src/tests/integration/verify.itest.ts`:

```ts
import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({
  user: { id: "", role: "BUYER", name: "Test", email: "test@test.local" },
}));

vi.mock("@/lib/api-auth", async () => {
  const { NextResponse } = await import("next/server");
  return {
    requireRole: async (...roles: string[]) => {
      if (!authState.user.id) {
        return {
          error: NextResponse.json({ error: "No autenticado" }, { status: 401 }),
        };
      }
      if (!roles.includes(authState.user.role)) {
        return {
          error: NextResponse.json({ error: "Sin permisos" }, { status: 403 }),
        };
      }
      return { session: { user: authState.user } };
    },
  };
});

import { POST as createOrder } from "@/app/api/orders/route";
import { POST as confirmOrder } from "@/app/api/orders/[id]/confirm/route";
import { POST as verifyTicket } from "@/app/api/tickets/verify/route";
import { prisma } from "@/lib/prisma";
import {
  cleanDatabase,
  createApprovedEvent,
  createBuyer,
  jsonRequest,
} from "./helpers";

function actAs(user: { id: string; role: string }) {
  authState.user = { ...authState.user, ...user };
}

/** Buys 2 zone tickets and confirms the order; returns organizer, event, tickets. */
async function confirmedTickets() {
  const buyer = await createBuyer();
  const { organizer, event, zone } = await createApprovedEvent();

  actAs({ id: buyer.id, role: "BUYER" });
  const created = await createOrder(
    jsonRequest("http://test.local/api/orders", {
      eventId: event.id,
      seatIds: [],
      zones: [{ zoneId: zone.id, quantity: 2 }],
    }),
  );
  expect(created.status).toBe(201);
  const order = await prisma.order.findFirstOrThrow({
    where: { buyerId: buyer.id },
  });
  await prisma.order.update({
    where: { id: order.id },
    data: { status: "PAYMENT_SUBMITTED", paymentProof: "proofs/test.jpg" },
  });

  actAs({ id: organizer.id, role: "ORGANIZER" });
  const confirmed = await confirmOrder(
    new Request(`http://test.local/api/orders/${order.id}/confirm`, {
      method: "POST",
    }),
    { params: Promise.resolve({ id: order.id }) },
  );
  expect(confirmed.status).toBe(200);

  const tickets = await prisma.ticket.findMany({ where: { orderId: order.id } });
  return { organizer, event, tickets };
}

function verifyRequest(body: unknown) {
  return jsonRequest("http://test.local/api/tickets/verify", body);
}

beforeEach(async () => {
  await cleanDatabase();
});

describe("POST /api/tickets/verify", () => {
  it("accepts a ticket exactly once under concurrent scans", async () => {
    const { organizer, tickets } = await confirmedTickets();
    actAs({ id: organizer.id, role: "ORGANIZER" });

    const responses = await Promise.all([
      verifyTicket(verifyRequest({ code: tickets[0].code })),
      verifyTicket(verifyRequest({ code: tickets[0].code })),
    ]);
    const results = await Promise.all(responses.map((r) => r.json()));
    expect(results.filter((r) => r.result === "ACCEPTED")).toHaveLength(1);
    expect(results.filter((r) => r.result === "ALREADY_USED")).toHaveLength(1);
  });

  it("rejects another organizer's session", async () => {
    const { tickets } = await confirmedTickets();
    const intruder = await prisma.user.create({
      data: {
        email: `other-${randomUUID()}@test.local`,
        role: "ORGANIZER",
        emailVerified: new Date(),
      },
    });
    actAs({ id: intruder.id, role: "ORGANIZER" });

    const response = await verifyTicket(verifyRequest({ code: tickets[1].code }));
    expect(response.status).toBe(403);
  });

  it("accepts the event's door scan code without a session", async () => {
    const { event, tickets } = await confirmedTickets();
    const scanCode = randomUUID();
    await prisma.event.update({
      where: { id: event.id },
      data: { scanCode },
    });

    actAs({ id: "", role: "BUYER" }); // no session — scanCode is the credential
    const response = await verifyTicket(
      verifyRequest({ code: tickets[1].code, scanCode }),
    );
    const result = await response.json();
    expect(result.result).toBe("ACCEPTED");

    const wrongScan = await verifyTicket(
      verifyRequest({ code: tickets[1].code, scanCode: randomUUID() }),
    );
    expect(wrongScan.status).toBe(403);
  });
});
```

- [x] **Step 7: Run the integration suite**

Run (bash): `DATABASE_URL="postgresql://ichurri:boletavip_dev@localhost:5432/boletavip_test" pnpm test:integration`
Expected: migrations deploy to `boletavip_test`, then all 9 tests PASS. Also re-run `pnpm test` and confirm the unit suite does **not** pick up `*.itest.ts` files (the default config includes only `src/**/*.test.ts`).

- [x] **Step 8: Commit**

```bash
git add vitest.integration.config.ts src/tests/integration package.json
git commit -m "test: integration coverage for orders, confirmation and check-in"
```

---

### Task 20: Documentation updates

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/views-overview.md`

- [x] **Step 1: Update CLAUDE.md**

Apply these edits:

1. In the **Commands** block, after the `pnpm test` line, add:
```
pnpm test:integration  # integration tests — needs DATABASE_URL pointed at a *_test DB (boletavip_test)
```
2. In **Business rules**, in the order-flow bullet, note the new behaviors — append to the relevant bullets:
   - Order flow bullet: `Organizer is emailed on the first proof submission. Confirm claims the status atomically inside the transaction (concurrent confirms → one 409). Confirm/cancel responses include emailSent for the dashboard warning.`
   - Add a bullet: `- Buyers can hold at most 3 PENDING_PAYMENT orders (429 beyond that). Verification/reset emails have a 60 s cooldown (silent for /forgot to avoid probing).`
   - Add a bullet: `- Payment proofs are private: stored via Vercel Blob access:"private" (local: /private-uploads, gitignored) and served through GET /api/orders/[id]/proof (buyer/organizer/admin only); legacy public URLs still redirect. Proof images render with unoptimized (the image optimizer drops auth cookies).`
   - Add a bullet: `- Door check-in without accounts: Event.scanCode (rotatable via POST /api/events/[id]/scan-code) unlocks public /scan/[code]; /api/tickets/verify accepts scanCode as an alternative credential scoped to that event.`
   - Add a bullet: `- Organizers can set a contact phone (/account → POST /api/account/profile); shown on event and order pages as a wa.me link. Buyers page has CSV export (GET /api/events/[id]/buyers/export). Tickets downloadable as PDF (GET /api/tickets/[id]/pdf, pdf-lib, WinAnsi-sanitized).`
   - Add a bullet: `- Static pages: /help, /terms, /privacy (linked from the footer).`

- [x] **Step 2: Update docs/views-overview.md**

Add short entries for the new views: `/help`, `/terms`, `/privacy` (public, static), `/scan/[code]` (public, bearer-code gated door scanner), and mention the CSV export + scan access button on the buyers view and the PDF download on the order view. Follow the document's existing format.

- [x] **Step 3: Commit**

```bash
git add CLAUDE.md docs/views-overview.md
git commit -m "docs: document notifications, scan codes, private proofs and new views"
```

- [x] **Step 4: Final gate**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`, plus the integration suite.
Expected: all green.

---

## Deployment notes (production, after user approval)

1. **Migrations first** (two new: `user_phone`, `event_scan_code`):
   `DATABASE_URL="<neon-pooled-string>" pnpm prisma migrate deploy` — ask the user for the string; never `migrate dev`/seed against Neon.
2. No new env vars. `pdf-lib` is the only new dependency.
3. Private blobs: after the Phase 3 deploy, upload one real proof and open it from the organizer dashboard to confirm the store accepts `access: "private"` puts and the `get()` stream works with the existing `BLOB_READ_WRITE_TOKEN`.
4. Push to `main` deploys automatically; stage only the files from these tasks (the working tree may hold user WIP).
