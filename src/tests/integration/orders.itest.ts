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
