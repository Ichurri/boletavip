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
