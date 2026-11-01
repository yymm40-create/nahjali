import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, readSettings, type Product } from "@config/course";

// «تم التحويل» answers with the WhatsApp group's link: the owner, 1 November 2026 — «الكل يدخل المجموعة»: every buyer of the clock
// course gets it (live, recorded or the whole course); a buyer of any other course does not.
const ID = "3b68eb1d-ca1b-4e71-a5f7-78013603b443";
const h = vi.hoisted(() => ({ order: null as unknown }));
vi.mock("@/lib/api", () => {
  class UserError extends Error {
    constructor(message: string, public status = 400) {
      super(message);
    }
  }
  return { UserError, handle: <A extends unknown[]>(fn: (...a: A) => unknown) => fn, requireApiUser: async () => ({ id: "u1", email: "a@b.co" }) };
});
vi.mock("@/lib/course/orders", () => ({ markTransferred: async () => h.order }));
vi.mock("@/lib/course/settings", () => ({ loadSettings: async () => readSettings({ ...DEFAULT_SETTINGS, ladderCourseId: ID, groupLink: "https://chat.whatsapp.com/abc" }) }));

const press = async (product: Product, courseId: string | null) => {
  h.order = { id: "11111111-1111-4111-8111-111111111111", product, courseId };
  const { POST } = await import("@/app/api/course/transferred/route");
  const res = (await POST(new Request("https://x.test/api/course/transferred", { method: "POST", body: JSON.stringify({ orderId: "11111111-1111-4111-8111-111111111111" }) }))) as Response;
  return ((await res.json()) as { groupLink: string }).groupLink;
};

describe("«تم التحويل» and the WhatsApp group", () => {
  beforeEach(() => {
    h.order = null;
  });

  it("gives the link to every buyer of the clock course, the recorded one too", async () => {
    for (const p of ["live", "combo", "recorded"] as Product[]) expect(await press(p, ID)).toBe("https://chat.whatsapp.com/abc");
  });

  it("gives it to nobody who bought another course", async () => {
    expect(await press("recorded", "00b706a4-f437-4d78-9b12-64202af88dcd")).toBe("");
    expect(await press("recorded", null)).toBe("");
  });
});
