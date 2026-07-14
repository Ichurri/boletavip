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
