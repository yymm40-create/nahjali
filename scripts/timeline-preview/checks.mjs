// What run.mjs checks on the page (each check: a name and a function that throws when it fails).
import { join } from "node:path";

export default async function checks({ browser, base, out }) {
  const failed = [];
  const open = async (query = "") => {
    const page = await browser.newPage({ viewport: { width: 1500, height: 900 }, deviceScaleFactor: 1 });
    page.on("pageerror", (e) => failed.push(`pageerror: ${e.message}`));
    await page.goto(`${base}/${query}`, { waitUntil: "networkidle" });
    await page.waitForSelector("[data-clip]");
    await page.waitForTimeout(400);
    return page;
  };
  const check = async (name, fn) => {
    try {
      await fn();
      console.log(`✓ ${name}`);
    } catch (e) {
      console.log(`✗ ${name}: ${e.message}`);
      failed.push(name);
    }
  };
  const eq = (a, b, what) => {
    if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${what}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);
  };
  const tl = (page) => page.evaluate(() => window.__tl);
  const where = async (page, id) => {
    const t = await tl(page);
    for (const tr of t.tracks) for (const c of tr.clips) if (c.id === id) return { track: tr.id, start: c.start };
    return null;
  };
  const box = (page, id) => page.locator(`[data-clip="${id}"]`).first().boundingBox();
  const pps = async (page) => (await box(page, "p")).width / 240;
  const head = (page, trackId) => page.locator(`[data-track-id="${trackId}"] > div`).first();

  // ---- ⌥ on a track's eye: every track
  await check("⌥ + eye hides every picture track, and again shows them", async () => {
    const page = await open("?cams=4");
    const eye = head(page, "v1").getByRole("button", { name: "أخفِ" });
    await eye.click({ modifiers: ["Alt"] });
    let t = await tl(page);
    eq(t.tracks.filter((x) => x.kind !== "audio").map((x) => x.hidden), [true, true, true, true, true], "hidden");
    eq(t.tracks.filter((x) => x.kind === "audio").map((x) => x.hidden), [false, false, false], "sound tracks have no eye");
    await head(page, "v2").getByRole("button", { name: "أظهر" }).click({ modifiers: ["Alt"] });
    t = await tl(page);
    eq(t.tracks.map((x) => x.hidden).some(Boolean), false, "shown again");
    // the speaker: every track with sound
    await head(page, "a1").getByRole("button", { name: "اكتم" }).click({ modifiers: ["Alt"] });
    t = await tl(page);
    eq(t.tracks.every((x) => x.muted), true, "all muted");
    // a plain click is still one track
    await head(page, "a1").getByRole("button", { name: "شغّل الصوت" }).click();
    t = await tl(page);
    eq(t.tracks.filter((x) => !x.muted).map((x) => x.id), ["a1"], "one track");
    await page.close();
  });

  // ---- taller / shorter tracks
  await check("the tracks get taller and shorter (button and ⌥ + wheel)", async () => {
    const page = await open("?cams=4");
    const h = async () => (await page.locator('[data-track-id="v1"]').boundingBox()).height;
    const h0 = await h();
    await page.getByRole("button", { name: "طوّل المسارات" }).click();
    const h1 = await h();
    if (!(h1 > h0 * 1.2)) throw new Error(`taller: ${h0} → ${h1}`);
    const b = await box(page, "c1a");
    await page.mouse.move(b.x + 5, b.y + 5);
    await page.keyboard.down("Alt");
    await page.mouse.wheel(0, 300);
    await page.keyboard.up("Alt");
    await page.waitForTimeout(200);
    const h2 = await h();
    if (!(h2 < h1 * 0.8)) throw new Error(`shorter by wheel: ${h1} → ${h2}`);
    await page.screenshot({ path: join(out, "tall.png") });
    await page.close();
  });

  // ---- a zoom keeps what is under the pointer (it used to jump back to the playhead, and to drift step by step)
  await check("a long zoom far from the playhead keeps the moment under the pointer where it is", async () => {
    const page = await open("?cams=4");
    await page.evaluate(() => window.__seek(0));
    // the moment (ms) drawn at screen x, read off the sound clip s1 (10 s → 30 s) — from its styled place and width
    // (the drawn box is rounded to 1/64 px, which is milliseconds when the whole poem is on the screen)
    const momentAt = (x) =>
      page.evaluate((x) => {
        const c = document.querySelector('[data-clip="s1"]');
        return 10_000 + ((x - c.parentElement.getBoundingClientRect().left - parseFloat(c.style.left)) / parseFloat(c.style.width)) * 20_000;
      }, x);
    const pxPerMs = async () => (await box(page, "s1")).width / 20_000;
    const b = await box(page, "s1");
    const x = Math.round(b.x + b.width * 0.7);
    const y = b.y + b.height / 2;
    const m0 = await momentAt(x);
    await page.mouse.move(x, y);
    await page.keyboard.down("Control");
    // many small steps, like a pinch
    for (let i = 0; i < 28; i++) {
      await page.mouse.wheel(0, -18);
      await page.waitForTimeout(25);
    }
    await page.keyboard.up("Control");
    await page.waitForTimeout(200);
    if (!((await pxPerMs()) > (b.width / 20_000) * 100)) throw new Error("did not zoom in");
    const off = ((await momentAt(x)) - m0) * (await pxPerMs());
    if (Math.abs(off) > 3) throw new Error(`after zooming in, the moment under the pointer is ${off.toFixed(1)} px away`);
    await page.keyboard.down("Control");
    for (let i = 0; i < 28; i++) {
      await page.mouse.wheel(0, 18);
      await page.waitForTimeout(25);
    }
    await page.keyboard.up("Control");
    await page.waitForTimeout(200);
    const back = ((await momentAt(x)) - m0) * (await pxPerMs());
    if (Math.abs(back) > 3) throw new Error(`after zooming back out, the moment under the pointer is ${back.toFixed(1)} px away`);
    await page.close();
  });

  // ---- a selection dragged to another track
  await check("several selected clips cross tracks together", async () => {
    const page = await open("?cams=4");
    const a = await box(page, "c0a");
    const b = await box(page, "c1a");
    await page.mouse.click(a.x + a.width / 2, a.y + a.height / 2);
    await page.keyboard.down("Shift");
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    await page.keyboard.up("Shift");
    eq(await page.evaluate(() => window.__sel), ["c0a", "c1a"], "selected");
    // v0 is under v1 on the screen (pictures stack upward): drag c0a up one row
    const row = (await page.locator('[data-track-id="v1"]').boundingBox());
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    await page.mouse.move(a.x + a.width / 2, row.y + row.height / 2, { steps: 6 });
    await page.screenshot({ path: join(out, "group-drag.png") });
    await page.mouse.up();
    await page.waitForTimeout(150);
    eq(await where(page, "c0a"), { track: "v1", start: 5000 }, "c0a");
    eq(await where(page, "c1a"), { track: "v2", start: 14000 }, "c1a");
    // at the top edge the selection stops together: c1a is on v2, one more row is all there is (v3)
    const top = await page.locator('[data-track-id="v3"]').boundingBox();
    const a2 = await box(page, "c0a");
    await page.mouse.move(a2.x + a2.width / 2, a2.y + a2.height / 2);
    await page.mouse.down();
    await page.mouse.move(a2.x + a2.width / 2, top.y + 4, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(150);
    eq(await where(page, "c0a"), { track: "v2", start: 5000 }, "c0a held back by c1a");
    eq(await where(page, "c1a"), { track: "v3", start: 14000 }, "c1a at the top");
    await page.close();
  });

  // ---- the magnet works by any clip of the selection
  await check("the magnet catches the far clip of a selection (held by the other one)", async () => {
    const page = await open("?cams=2");
    await page.evaluate(() => window.__seek(100_000));
    const k = await pps(page);
    const a = await box(page, "c0a");
    const b = await box(page, "c1a");
    await page.mouse.click(a.x + a.width / 2, a.y + a.height / 2);
    await page.keyboard.down("Shift");
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    await page.keyboard.up("Shift");
    // c1a ends at 26 s; the playhead is at 100 s: held by c0a, dragged so c1a's end comes 6 px short of it
    const dx = 74 * k - 6;
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    await page.mouse.move(a.x + a.width / 2 + dx, a.y + a.height / 2, { steps: 10 });
    await page.screenshot({ path: join(out, "group-magnet.png") });
    const stuck = await page.getByText("ملتصق").count();
    await page.mouse.up();
    await page.waitForTimeout(150);
    if (!stuck) throw new Error("the «ملتصق» line did not show");
    eq(await where(page, "c1a"), { track: "v1", start: 88000 }, "c1a ends on the playhead");
    eq(await where(page, "c0a"), { track: "v0", start: 79000 }, "c0a went with it");
    await page.close();
  });

  // ---- folders
  await check("tracks go in a folder that folds and opens", async () => {
    const page = await open("?cams=8");
    const total = async () => (await page.locator("[data-track-id]").count());
    const n0 = await total();
    await page.getByRole("button", { name: "مجلدات المسارات" }).click();
    await page.getByRole("menuitem", { name: /مسارات الفيديو في مجلد/ }).click();
    await page.waitForTimeout(150);
    let t = await tl(page);
    eq(t.folders?.length, 1, "one folder");
    eq(t.tracks.filter((x) => x.folder).map((x) => x.id), ["v0", "v1", "v2", "v3", "v4", "v5", "v6", "v7"], "the camera tracks (not the main one)");
    await page.screenshot({ path: join(out, "folder-open.png") });
    await page.getByRole("button", { name: /اطوِ المجلد/ }).click();
    await page.waitForTimeout(150);
    eq(await total(), n0 - 8, "its tracks are folded away");
    await page.screenshot({ path: join(out, "folder-closed.png") });
    // the folder's eye: all its tracks
    await page.getByRole("button", { name: "أخفِ المجلد" }).click();
    t = await tl(page);
    eq(t.tracks.filter((x) => x.hidden).length, 8, "hidden by the folder's eye");
    await page.getByRole("button", { name: /افتح المجلد/ }).click();
    await page.waitForTimeout(150);
    eq(await total(), n0, "open again");
    // a track out of the folder by a right-click on its head
    await head(page, "v3").click({ button: "right" });
    await page.getByRole("menuitem", { name: /طلّعه من المجلد/ }).click();
    t = await tl(page);
    eq(t.tracks.filter((x) => x.folder).length, 7, "one out");
    await page.getByRole("button", { name: "فك المجلد" }).click();
    t = await tl(page);
    eq(t.folders, undefined, "no folder left");
    await page.close();
  });

  // ---- the clips «زامن الصوت» left behind
  await check("clips that did not sync are red, and one press selects them", async () => {
    const page = await open("?cams=4");
    await page.evaluate(() => window.__flags({ c0a: { level: "bad", why: "صوته ما يشبه" }, c2b: { level: "bad", why: "صوته ما يشبه" }, c1a: { level: "weak", why: "متوسط" } }));
    await page.waitForTimeout(150);
    eq(await page.getByText("✕ ما تزامن").count(), 2, "red badges");
    eq(await page.getByText("؟ راجعه").count(), 1, "amber badge");
    await page.screenshot({ path: join(out, "flags.png") });
    await page.getByRole("button", { name: /ما تزامنت · حدّدها/ }).click();
    eq(await page.evaluate(() => window.__sel), ["c0a", "c2b"], "selected");
    await page.close();
  });

  // ---- S and H on every track
  await check("«S» solos a track among its sort and «H» switches one off", async () => {
    const page = await open("?cams=4");
    await head(page, "v2").getByRole("button", { name: /^سولو/ }).click();
    let t = await tl(page);
    eq(t.tracks.filter((x) => x.solo).map((x) => x.id), ["v2"], "soloed");
    // a second one plays with it; ⌥ leaves only the pressed one
    await head(page, "v0").getByRole("button", { name: /^سولو/ }).click();
    eq((await tl(page)).tracks.filter((x) => x.solo).map((x) => x.id), ["v0", "v2"], "two soloed");
    await head(page, "v1").getByRole("button", { name: /^سولو/ }).click({ modifiers: ["Alt"] });
    eq((await tl(page)).tracks.filter((x) => x.solo).map((x) => x.id), ["v1"], "only this one");
    // sound is soloed apart from pictures
    await head(page, "a0").getByRole("button", { name: /^سولو/ }).click();
    eq((await tl(page)).tracks.filter((x) => x.solo).map((x) => x.id), ["v1", "a0"], "a camera and a sound");
    await head(page, "v3").getByRole("button", { name: /^طفّي/ }).click();
    t = await tl(page);
    eq(t.tracks.filter((x) => x.off).map((x) => x.id), ["v3"], "off");
    await page.screenshot({ path: join(out, "solo-off.png") });
    await head(page, "v3").getByRole("button", { name: /^شغّل كاميرا/ }).click({ modifiers: ["Alt"] });
    eq((await tl(page)).tracks.some((x) => x.off), false, "⌥: all on");
    await page.close();
  });

  // ---- H, S and the colour on the selected clip; the map; no main track; packing
  await check("the selected clip has its own «S» «H» and colour, for all the selected", async () => {
    const page = await open("?cams=4");
    const a = await box(page, "c0a");
    const b = await box(page, "c1a");
    await page.mouse.click(a.x + 8, a.y + a.height - 6);
    await page.keyboard.down("Shift");
    await page.mouse.click(b.x + 8, b.y + b.height - 6);
    await page.keyboard.up("Shift");
    const clip = (id) => page.locator(`[data-clip="${id}"]`).first();
    await clip("c0a").getByRole("button", { name: "طفّي المقطع مؤقتًا" }).click();
    const marks = async (k) => (await tl(page)).tracks.flatMap((x) => x.clips.filter((c) => c[k]).map((c) => c.id));
    eq(await marks("off"), ["c0a", "c1a"], "both off");
    await clip("c1a").getByRole("button", { name: "شغّل المقطع" }).click();
    eq(await marks("off"), [], "both on again");
    await clip("c0a").getByRole("button", { name: "سولو المقطع" }).click();
    eq(await marks("solo"), ["c0a", "c1a"], "soloed");
    await clip("c0a").getByRole("button", { name: "لون المقطع" }).click();
    eq((await marks("label")).length, 2, "coloured");
    await page.screenshot({ path: join(out, "clip-marks.png") });
    await page.close();
  });
  await check("the map under the timeline goes where it is pressed", async () => {
    const page = await open("?cams=4");
    // zoom in so the timeline is wider than the screen
    for (let i = 0; i < 5; i++) await page.getByRole("button", { name: "تكبير", exact: true }).click();
    await page.waitForTimeout(150);
    const map = await page.getByRole("slider", { name: /خريطة التايملاين/ }).boundingBox();
    await page.mouse.click(map.x + map.width * 0.75, map.y + map.height / 2);
    await page.waitForTimeout(150);
    const st = await page.evaluate(() => {
      const el = document.querySelector(".jw-scroll");
      return { left: el.scrollLeft, max: el.scrollWidth - el.clientWidth };
    });
    if (!(st.left > st.max * 0.55 && st.left < st.max * 0.95)) throw new Error(`scrolled to ${Math.round(st.left)} of ${Math.round(st.max)}`);
    await page.screenshot({ path: join(out, "map.png") });
    await page.close();
  });
  await check("without a main track the first track is like the others; packing gathers the cameras", async () => {
    const page = await open("?cams=8&apart=1");
    const h = async (id) => (await page.locator(`[data-track-id="${id}"]`).boundingBox()).height;
    if (!((await h("main")) > (await h("v1")))) throw new Error("the main track should be taller to begin with");
    await page.evaluate(() => window.__run({ type: "set_main_track", on: false }));
    await page.waitForTimeout(150);
    eq(await h("main"), await h("v1"), "same height");
    eq(await head(page, "main").getByText("الرئيسي").count(), 0, "not named the main one");
    // the cameras' two rounds of clips (each over the next camera's) fold into fewer tracks
    await page.getByRole("button", { name: "مجلدات المسارات" }).click();
    await page.getByRole("menuitem", { name: /لمّ مسارات الفيديو/ }).click();
    await page.waitForTimeout(150);
    const t = await tl(page);
    const n = t.tracks.filter((x) => x.kind === "video").length;
    // (the first track is a plain one now, so it is gathered with the rest)
    if (n > 3) throw new Error(`still ${n} picture tracks`);
    await page.screenshot({ path: join(out, "packed.png") });
    await page.close();
  });

  // ---- a folder made by ticking the tracks; a track up and down
  await check("a new folder takes the tracks that are ticked, and a track moves up", async () => {
    const page = await open("?cams=6");
    await page.getByRole("button", { name: "مجلدات المسارات" }).click();
    await page.getByRole("menuitem", { name: /اختر المسارات بعلامة صح/ }).click();
    for (const id of ["v1", "v3", "v4"]) await head(page, id).getByRole("checkbox").check();
    await page.getByRole("textbox", { name: "اسم المجلد" }).fill("الشباب");
    await page.screenshot({ path: join(out, "pick.png") });
    await page.getByRole("button", { name: "سوّ المجلد" }).click();
    await page.waitForTimeout(150);
    let t = await tl(page);
    eq(t.folders?.map((f) => f.name), ["الشباب"], "the folder");
    eq(t.tracks.filter((x) => x.folder).map((x) => x.id), ["v1", "v3", "v4"], "only the ticked tracks");
    eq(await page.getByRole("checkbox").count(), 0, "the ticks are gone");
    // v0 one place up: over v1
    const before = (await tl(page)).tracks.filter((x) => x.kind === "video").map((x) => x.id);
    await head(page, "v0").hover();
    await head(page, "v0").getByRole("button", { name: /^ارفع/ }).click();
    t = await tl(page);
    const after = t.tracks.filter((x) => x.kind === "video").map((x) => x.id);
    eq([after.indexOf("v0"), after.indexOf("v1")], [before.indexOf("v1"), before.indexOf("v0")], "swapped");
    await page.close();
  });

  // ---- the whole screen
  await check("the timeline takes the whole screen and gives it back", async () => {
    const page = await open("?cams=8");
    const h0 = (await page.locator("[data-no-press]").first().boundingBox()).height;
    await page.getByRole("button", { name: "التايملاين على الشاشة كاملة" }).click();
    await page.waitForTimeout(150);
    const h1 = (await page.locator("[data-no-press]").first().boundingBox()).height;
    if (!(h1 > 880 && h0 < 600)) throw new Error(`heights ${h0} → ${h1}`);
    await page.screenshot({ path: join(out, "full.png") });
    await page.getByRole("button", { name: "رجّع التايملاين لحجمه" }).click();
    await page.close();
  });

  return failed;
}
