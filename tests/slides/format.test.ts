import { describe, expect, it } from "vitest";
import { deckDocument, deckImages, readDeck, resolveImages, sanitizeSlide, sanitizeStyle, sigOf, slideText } from "@/lib/slides/format";
import { formatGuide, placeSlide } from "@/lib/slides/design";

describe("a slide can never run anything", () => {
  const evil = [
    '<section><script>alert(1)</script><p>نص</p></section>',
    '<section><img src="x" onerror="alert(1)"><p onclick="alert(1)">نص</p></section>',
    '<section><a href="javascript:alert(1)">رابط</a></section>',
    '<section><iframe src="https://evil.example"></iframe></section>',
    '<section style="background:url(https://evil.example/x.png)"><p style="color:red;background-image:url(javascript:alert(1))">نص</p></section>',
    '<section><svg><script>alert(1)</script><a xlink:href="javascript:alert(1)"><rect/></a><image href="https://evil.example/x.png"/><use href="#x"/><foreignObject><p>x</p></foreignObject></svg></section>',
    '<section><style>body{background:url(x)}</style><p>نص</p></section>',
    '<section><p style="position:fixed;inset:0;z-index:99999">غطاء</p></section>',
    '<section><img src="https://evil.example/track.png" alt="t"><img src="img:../../etc/passwd"></section>',
    '<section><p>"><script>alert(1)</script></p><div style="x:1;behavior:url(x.htc)">a</div></section>',
    "<section><svg><rect fill=\"url(https://evil.example/#a)\" onload=\"alert(1)\"/></svg></section>",
    '<section><p style="background:expression(alert(1))">x</p><p style="color:var(--x)">y</p></section>',
  ];
  for (const html of evil) {
    it(html.slice(0, 60), () => {
      const out = sanitizeSlide(html, "s1");
      expect(out).not.toMatch(/<script|<iframe|<style|<a[\s>]|<image|<use|foreignobject|onerror|onclick|onload|javascript:|url\(https|url\(javascript|expression\(|evil\.example|position:fixed|\.\.\/|var\(/i);
      expect(out.startsWith('<section data-slide="s1"')).toBe(true);
      expect(out.endsWith("</section>")).toBe(true);
    });
  }
  it("keeps what a designer needs", () => {
    const out = sanitizeSlide('<section style="background:linear-gradient(135deg,#1e1245,#f59e0b);padding:120px;display:flex;gap:40px"><h1 style="font-size:120px;color:#fff">عنوان</h1><p>سطر <b>مهم</b> و<span style="color:#ffd17a">ملوّن</span></p><img src="img:u/p/out/o/pic.jpg" alt="صورة" style="width:600px;height:340px;object-fit:cover;border-radius:24px;transform:rotate(-3deg)"><svg width="100" height="50" viewBox="0 0 100 50"><defs><linearGradient id="g"><stop offset="0" stop-color="#fff"/></linearGradient></defs><rect x="0" y="0" width="100" height="50" fill="url(#g)"/></svg></section>', "s1");
    expect(out).toContain('style="background:linear-gradient(135deg,#1e1245,#f59e0b);padding:120px;display:flex;gap:40px"');
    expect(out).toContain('<h1 style="font-size:120px;color:#fff">عنوان</h1>');
    expect(out).toContain("<b>مهم</b>");
    expect(out).toContain('src="img:u/p/out/o/pic.jpg"');
    expect(out).toContain("transform:rotate(-3deg)");
    expect(out).toContain('viewBox="0 0 100 50"');
    expect(out).toContain("<linearGradient");
    expect(out).toContain('fill="url(#g)"');
  });
  it("closes what was left open and drops stray closes", () => {
    const out = sanitizeSlide("<section><div><p>a<b>b</p></i></div>", "x");
    expect(out).toBe('<section data-slide="x"><div><p>a<b>b</b></p></div></section>');
  });
  it("escapes text and keeps entities as characters", () => {
    expect(sanitizeSlide("<p>1 &lt; 2 &amp; &#1605;</p>", "x")).toBe('<section data-slide="x"><p>1 &lt; 2 &amp; م</p></section>');
  });
  it("cleans styles", () => {
    expect(sanitizeStyle("color:red; position: fixed; z-index: 100000; font-size:40px !important; foo:bar")).toBe("color:red;z-index:50;font-size:40px");
  });
});

describe("the deck", () => {
  const deck = readDeck({ title: "عرض", aspect: "16:9", fonts: ["readex", "BAD FONT"], slides: [{ id: "a", html: '<section><img src="img:p/1.jpg" alt="x"></section>', notes: "ن" }, { id: "a", html: "<p>ثاني</p>", notes: "" }] })!;
  it("is read back clean: unique ids, known fonts, sanitized slides", () => {
    expect(deck.slides.map((s) => s.id)).toEqual(["a", "ax"]);
    expect(deck.fonts).toEqual(["readex"]);
    expect(deck.slides[1].html).toBe('<section data-slide="ax"><p>ثاني</p></section>');
    expect(deckImages(deck)).toEqual(["p/1.jpg"]);
    expect(slideText(deck.slides[1].html)).toBe("ثاني");
  });
  it("shows pictures only through the resolver, and marks a missing one", () => {
    expect(resolveImages(deck.slides[0].html, () => "https://cdn.example/1.jpg")).toContain('src="https://cdn.example/1.jpg" data-token="p/1.jpg"');
    expect(resolveImages(deck.slides[0].html, () => undefined)).toContain('data-missing="1"');
  });
  it("prints one page per slide at the slide's size, right to left", () => {
    const doc = deckDocument(deck, { fontCss: "", resolve: () => "data:,", print: true, csp: true });
    expect(doc).toContain("@page{size:1920px 1080px;margin:0}");
    expect(doc).toContain('dir="rtl"');
    expect(doc).toContain("default-src 'none'");
  });
  it("a designed slide lands sanitized in its place", () => {
    const d = readDeck({ title: "", aspect: "4:3", fonts: [], slides: [] })!;
    placeSlide(d, 0, '<section style="background:#fff"><h2 onclick="x()">عنوان</h2></section>', "ملاحظة", sigOf({ a: 1 }));
    expect(d.slides[0].html).not.toContain("onclick");
    expect(d.slides[0].notes).toBe("ملاحظة");
    expect(formatGuide("4:3")).toContain("1440×1080");
  });
  it("signs the same content the same way", () => {
    expect(sigOf({ a: [1, 2] })).toBe(sigOf({ a: [1, 2] }));
    expect(sigOf({ a: [1, 2] })).not.toBe(sigOf({ a: [2, 1] }));
  });
});
