import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(p, "utf8");

describe("«رابط حسابي»: my reading and my place on my public link", () => {
  it("is off by default and only shown when the person turns it on", () => {
    expect(read("supabase/migrations/0126_mahdi_share_reading.sql")).toContain("share_reading boolean not null default false");
    const server = read("src/lib/mahdi/server/public-reading.ts");
    expect(server).toMatch(/if \(error \|\| !privacy\?\.share_reading\) return null/);
    // pages read before («قرأتها قبل») are not counted as reading done
    expect(server).toContain("filter((s) => !s.earlier)");
  });
  it("shows on the public page of the link and on the person's page in the app", () => {
    expect(read("src/app/mahdi/join/[username]/page.tsx")).toContain("{reading && <PublicReadingCard reading={reading} />}");
    expect(read("src/app/mahdi/(app)/u/[username]/page.tsx")).toContain("<PublicReadingCard reading={profile.reading} />");
  });
  it("is switched from «شارك إنجازي» and from the privacy page", () => {
    expect(read("src/app/mahdi/(app)/share/page.tsx")).toContain("json: { shareReading: on }");
    expect(read("src/app/mahdi/(app)/more/privacy/page.tsx")).toContain('row("shareReading"');
  });
});
