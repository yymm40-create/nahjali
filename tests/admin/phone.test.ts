import { describe, expect, it } from "vitest";
import { waDigits, waLink } from "@/lib/phone";

describe("phone numbers → WhatsApp", () => {
  it("a Saudi number written the usual ways", () => {
    for (const n of ["0501234567", "501234567", "+966501234567", "00966501234567", "+966 50 123 4567", "050-123-4567", "(050) 123 4567"]) expect(waDigits(n)).toBe("966501234567");
  });
  it("other countries keep their code", () => {
    expect(waDigits("+97150 123 4567")).toBe("971501234567");
    expect(waDigits("0097150 123 4567")).toBe("971501234567");
    expect(waDigits("+201001234567")).toBe("201001234567");
  });
  it("not a number: no link", () => {
    for (const n of ["", "   ", "abc", "123", "0", "+9665012345678901234"]) expect(waLink(n)).toBeNull();
  });
  it("the link", () => {
    expect(waLink("0501234567")).toBe("https://wa.me/966501234567");
  });
});
