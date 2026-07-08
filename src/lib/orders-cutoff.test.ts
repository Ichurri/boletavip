import { describe, expect, it } from "vitest";
import { eventStartsAt, eventDate } from "@/lib/utils";
import { platformSettingsSchema } from "@/lib/validations/settings";
import { parseSender } from "@/lib/email";

describe("parseSender", () => {
  it("splits 'Name <email>' format", () => {
    expect(parseSender("Üticket <hola@uticket.me>")).toEqual({
      name: "Üticket",
      email: "hola@uticket.me",
    });
  });

  it("falls back to brand name for plain addresses", () => {
    expect(parseSender("santiago@example.com")).toEqual({
      name: "Üticket",
      email: "santiago@example.com",
    });
  });
});

describe("eventStartsAt", () => {
  it("combines the noon-UTC date with the time in Bolivia (UTC-4)", () => {
    const startsAt = eventStartsAt({
      date: eventDate("2026-09-10"),
      time: "20:30",
    });
    // 20:30 in La Paz = 00:30 UTC next day
    expect(startsAt.toISOString()).toBe("2026-09-11T00:30:00.000Z");
  });

  it("keeps the calendar date stable for early times", () => {
    const startsAt = eventStartsAt({
      date: eventDate("2026-01-05"),
      time: "09:00",
    });
    expect(startsAt.toISOString()).toBe("2026-01-05T13:00:00.000Z");
  });

  it("cutoff comparison: closes sales N hours before start", () => {
    const startsAt = eventStartsAt({
      date: eventDate("2026-09-10"),
      time: "20:00",
    });
    const cutoffHours = 2;
    const salesCloseAt = startsAt.getTime() - cutoffHours * 60 * 60 * 1000;
    const beforeCutoff = new Date("2026-09-10T21:59:00Z").getTime(); // 17:59 La Paz
    const afterCutoff = new Date("2026-09-10T22:01:00Z").getTime(); // 18:01 La Paz
    expect(beforeCutoff < salesCloseAt).toBe(true);
    expect(afterCutoff > salesCloseAt).toBe(true);
  });
});

describe("platformSettingsSchema", () => {
  it("coerces numeric strings from forms", () => {
    expect(
      platformSettingsSchema.parse({ orderCutoffHours: "4" }).orderCutoffHours,
    ).toBe(4);
  });

  it("accepts 0 (sales open until start) and rejects out-of-range values", () => {
    expect(
      platformSettingsSchema.safeParse({ orderCutoffHours: 0 }).success,
    ).toBe(true);
    expect(
      platformSettingsSchema.safeParse({ orderCutoffHours: -1 }).success,
    ).toBe(false);
    expect(
      platformSettingsSchema.safeParse({ orderCutoffHours: 169 }).success,
    ).toBe(false);
    expect(
      platformSettingsSchema.safeParse({ orderCutoffHours: 2.5 }).success,
    ).toBe(false);
  });
});
