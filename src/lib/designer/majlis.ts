// «المصمم الذكي كاظم» — a ready majlis design made for the person: for «حيدرا ماكس», the design's own scene program (the
// template as it was picked, with the person's photos in its frames and their words on its plates and boxes — the
// faces untouched); for GPT Image 2.6 / 2, the prompt that rebuilds the picked design with them. Pure (server and page).

import { baseUrl, maskUrl, ROLE_LABEL, wordText, type MajlisOrder, type MajlisTemplate } from "@config/designer-majlis";

/** The fonts the programs use (ids of the site's font catalogue): head, body, and the big numerals. */
export const MAJLIS_FONTS = { head: "el-messiri", body: "readex-pro", lalezar: "lalezar", ruqaa: "aref-ruqaa" } as const;

const GRAD: Record<string, [string, string]> = { gold: ["#fff1c2", "#b07c2c"], silver: ["#ffffff", "#8d8d8d"], red: ["#ff6a5a", "#7a070c"] };

/** The pictures the program places, in order: photo1 the empty design, photo2 its frames' mask (GPT designs), then
 * the people in the order of the frames, then the logo. Each is a link the page loads. */
export function majlisPhotos(t: MajlisTemplate, o: MajlisOrder, link: (uploadId: string) => string | null, origin = ""): { urls: string[]; ids: { base: string; mask: string | null; people: (string | null)[]; logo: string | null } } {
  const urls = [origin + baseUrl(t.id)];
  let mask: string | null = null;
  if (t.mask) {
    urls.push(origin + maskUrl(t.id));
    mask = `photo${urls.length}`;
  }
  const people = o.people.map((p) => {
    const u = p.photo ? link(p.photo) : null;
    if (!u) return null;
    urls.push(u);
    return `photo${urls.length}`;
  });
  let logo: string | null = null;
  const lu = o.logo && t.logo ? link(o.logo) : null;
  if (lu) {
    urls.push(lu);
    logo = `photo${urls.length}`;
  }
  return { urls, ids: { base: "photo1", mask, people, logo } };
}

/** The scene program of the design: exact, the same every time («حيدرا ماكس»'s engine draws it in the page). */
export function majlisProgram(t: MajlisTemplate, o: MajlisOrder, ids: ReturnType<typeof majlisPhotos>["ids"]): string {
  const params: Record<string, { label: string; type: "text"; value: string }> = {};
  const words = t.words
    .map((w) => {
      const value = wordText(o, w.k);
      if (!value) return null;
      params[w.k] = { label: labelOf(w.k), type: "text", value };
      const fit = roomOf(t, w);
      return { k: w.k, r: w.r, room: fit.room, ax: fit.ax, align: fit.align, size: w.size, font: w.font, color: w.color, grad: w.grad ? GRAD[w.grad] : null };
    })
    .filter(Boolean);
  const slots = t.slots.map((s, i) => ({ shape: s.shape, r: s.r, id: ids.people[i] ?? null }));
  const scale = t.size[0] / (t.aspect === "4:5" ? 1080 : t.size[0]);
  return `// «${t.title}» — التصميم ${t.id.slice(1)}: القالب كما اختاره الشخص، صوره في الإطارات وكلامه في أماكنه.
scene({
  title: ${JSON.stringify(`دعوة — ${t.title}`)},
  duration: 1,
  blur: 0,
  background: "#0b0a0c",
  params: ${JSON.stringify(params)},
  setup(K, ctx) {},
  draw(K, t, ctx) {
    var W = K.W, H = K.H, S = ${scale.toFixed(4)};
    K.picture(ctx, "${ids.base}", 0, 0, W, H, { fit: "cover" });
    var SLOTS = ${JSON.stringify(slots)};
    var MASK = ${ids.mask ? JSON.stringify(ids.mask) : "null"};
    function shape(x, c, X, Y, w, h) {
      x.beginPath();
      if (c === "circle") { x.ellipse(X + w / 2, Y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); return; }
      var r = c === "arch" || c === "mihrab" ? w / 2 : c === "round" ? 28 * S : 6 * S;
      var b = c === "arch" ? 14 * S : c === "mihrab" ? 0 : r;
      x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, b); x.arcTo(X, Y + h, X, Y, b); x.arcTo(X, Y, X + w, Y, r); x.closePath();
    }
    for (var i = 0; i < SLOTS.length; i++) {
      var s = SLOTS[i], im = s.id ? K.img(s.id) : null;
      if (!im) continue;
      var X = s.r[0] * W, Y = s.r[1] * H, w = s.r[2] * W, h = s.r[3] * H;
      var L = K.layer("slot" + i, W, H), x = L.x;
      x.save();
      if (!MASK) { shape(x, s.shape, X, Y, w, h); x.clip(); }
      // the photo covers the frame, its upper part kept (the face)
      var k = Math.max(w / im.width, h / im.height), dw = im.width * k, dh = im.height * k;
      x.drawImage(im, X + (w - dw) / 2, Y + (h - dh) * 0.18, dw, dh);
      x.restore();
      if (MASK) { x.globalCompositeOperation = "destination-in"; x.drawImage(K.img(MASK), 0, 0, W, H); x.globalCompositeOperation = "source-over"; }
      ctx.drawImage(L.c, 0, 0);
    }
    ${ids.logo && t.logo ? `var lg = K.img(${JSON.stringify(ids.logo)}); if (lg) { var LX = ${t.logo[0]} * W, LY = ${t.logo[1]} * H, LW = ${t.logo[2]} * W, LH = ${t.logo[3]} * H; ctx.save(); ctx.beginPath(); ctx.ellipse(LX + LW / 2, LY + LH / 2, LW / 2, LH / 2, 0, 0, Math.PI * 2); ctx.clip(); var q = Math.min(LW / lg.width, LH / lg.height); ctx.drawImage(lg, LX + (LW - lg.width * q) / 2, LY + (LH - lg.height * q) / 2, lg.width * q, lg.height * q); ctx.restore(); }` : ""}
    var WORDS = ${JSON.stringify(words)};
    var FAM = { head: K.fonts.head, body: K.fonts.body, lalezar: K.fonts.lalezar || K.fonts.head, ruqaa: K.fonts.ruqaa || K.fonts.head };
    for (var j = 0; j < WORDS.length; j++) {
      var d = WORDS[j], str = K.p(d.k, "");
      if (!str) continue;
      var rx = d.r[0] * W, ry = d.r[1] * H, rw = d.r[2] * W, rh = d.r[3] * H, room = d.room * W;
      var fam = FAM[d.font] || K.fonts.body, wt = d.font === "body" ? 400 : 700;
      var size = K.fit(ctx, str, Math.min(room, W * 0.94), d.size * H, wt, fam, d.size * H * 0.55);
      var ax = d.ax * W;
      var o = { size: size, weight: wt, family: fam, align: d.align, baseline: "middle" };
      if (d.grad) o.gradient = d.grad; else o.color = d.color;
      K.text(ctx, str, ax, ry + rh / 2, o);
    }
  },
});`;
}

/**
 * How wide a word may grow (a fraction of the width): up to the next word on its line or the edge of its plate or box,
 * so a longer name shrinks instead of running over its neighbour. A GPT design's boxes are the word's own box.
 */
export function roomOf(t: MajlisTemplate, w: MajlisTemplate["words"][number]): { room: number; ax: number; align: "center" | "right" | "left" } {
  const GAP = 0.012;
  const [x, y, ww, h] = w.r;
  const r4 = (v: number) => Math.round(v * 10000) / 10000;
  // a GPT design's plate keeps clear of its end ornaments, and a box's words keep clear of its icon (on the left)
  if (t.source === "gpt") {
    if (["dateLine", "timeLine", "place", "women"].includes(w.k)) return { room: r4(ww * 0.76), ax: r4(x + ww * 0.56), align: "center" };
    if (w.k !== "hostLine") return { room: r4(ww * 0.84), ax: r4(x + ww / 2), align: "center" };
  }
  const box = t.source === "gpt" ? w.r : w.box && w.box[2] < 0.75 ? w.box : null;
  let lo = box ? box[0] : 0.03, hi = box ? box[0] + box[2] : 0.97;
  const cx = x + ww / 2;
  for (const n of t.words) {
    if (n === w) continue;
    const [nx, ny, nw, nh] = n.r;
    const overlap = Math.min(y + h, ny + nh) - Math.max(y, ny);
    if (overlap < 0.5 * Math.min(h, nh)) continue;
    if (nx + nw <= cx) lo = Math.max(lo, nx + nw);
    else if (nx >= cx) hi = Math.min(hi, nx);
  }
  if (w.align === "right") return { room: r4(Math.max(ww, x + ww - lo - GAP)), ax: r4(x + ww), align: "right" };
  if (w.align === "left") return { room: r4(Math.max(ww, hi - x - GAP)), ax: r4(x), align: "left" };
  // centred: grows both ways, unless a neighbour sits close on one side — then it keeps to that side and grows away
  const left = cx - lo, right = hi - cx;
  if (Math.min(left, right) < ww * 0.75 && Math.max(left, right) > ww * 1.2) {
    return right < left ? { room: r4(Math.max(ww, x + ww - lo - GAP)), ax: r4(x + ww), align: "right" } : { room: r4(Math.max(ww, hi - x - GAP)), ax: r4(x), align: "left" };
  }
  return { room: r4(Math.max(ww, 2 * Math.min(left, right) - 2 * GAP)), ax: r4(cx), align: "center" };
}

const LABELS: Record<string, string> = { kh: "الاسم الأول", rd: "الاسم الثاني", khLbl: "صفة الأول", rdLbl: "صفة الثاني", invite: "كلمة الدعوة", host: "اسم المأتم", hostShort: "اسم المأتم", pre: "المناسبة", night: "الليلة", date: "التاريخ", time: "الوقت", ampm: "صباحًا/مساءً", place: "المكان", women: "سطر النساء", live: "البث", dateLine: "الليلة والتاريخ", timeLine: "الوقت", hostLine: "سطر الدعوة" };
const labelOf = (k: string) => LABELS[k] ?? k;

/** What GPT Image 2.6 / 2 is told: rebuild the picked design (ref1) with the people (ref2…) and the exact words. */
export function majlisGptPrompt(t: MajlisTemplate, o: MajlisOrder): string {
  const frames = t.slots.map((s, i) => {
    const p = o.people[i];
    const where = t.slots.length === 2 ? (i === 0 ? "the FIRST photo frame (the bigger one, or the right one, or the top one)" : "the OTHER photo frame") : "the photo frame";
    return `- Put the person of ref${i + 2} (${p.role === "kh" ? "a khateeb" : "a radood"}) inside ${where}: head and shoulders, centred, filling the frame. Keep his face, beard, glasses and features EXACTLY as in his photo; only the background around him may follow the design. The name under that frame: «${p.name}»${t.words.some((w) => w.k === "khLbl") ? ` with the small label «${ROLE_LABEL[p.role]}» above it` : ""}.`;
  });
  const lines = [
    ["the name of the majlis at the top (or as a small line at the bottom if there is no room)", `${wordText(o, "invite")} ${wordText(o, "host")} ${wordText(o, "pre")}`],
    ["the date box (calendar icon)", wordText(o, "dateLine")],
    ["the time box (clock icon)", wordText(o, "timeLine")],
    ["the place box (location pin icon)", wordText(o, "place")],
    ["the women's box", wordText(o, "women")],
  ].filter(([, v]) => v.trim());
  return [
    `Recreate the attached design ref1 EXACTLY: the same layout, background, title calligraphy «${t.title}», colours, ornaments, frames, name plates and boxes, in the same places. It is a mourning invitation to a Husseini majlis for the martyrdom of Lady Fatima al-Zahra; keep its sorrowful, dignified look.`,
    "Fill it in:",
    ...frames,
    ...lines.map(([where, v]) => `- In ${where}, write exactly: «${v}».`),
    "Every Arabic word is written exactly as given, letters joined right to left, crisp and readable; no other new words, numbers, logos or watermarks. No women anywhere. The title calligraphy stays as it is in ref1.",
  ].join("\n");
}
