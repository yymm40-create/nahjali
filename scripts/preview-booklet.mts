// DEV: builds a booklet from an existing order's pose images without touching the order.
// Missing poses are filled with the closest available one (useful for orders made before new poses existed).
// Usage: npx tsx --env-file=.env.local scripts/preview-booklet.mts <orderId> <style> <name>
//   → tmp/preview-booklet.pdf and tmp/preview-page-NN.png (via macOS sips)
import { execFileSync } from "child_process";
import { mkdir, writeFile } from "fs/promises";
import { PDFDocument } from "pdf-lib";
import { BUCKETS, createAdminClient } from "@/lib/supabase/admin";
import { composeBooklet } from "@/lib/compose";
import { getApprovedCharacter } from "@/lib/orders";
import { getTemplate } from "@/lib/templates";

const [orderId, style = "pixar", name = "علي"] = process.argv.slice(2);
const FALLBACK: Record<string, string[]> = {
  quran: ["reading"],
  morning: ["eating", "happy"],
  salam: ["praying"],
  studying: ["reading"],
};

const db = createAdminClient();
const character = await getApprovedCharacter(orderId);
if (!character) throw new Error("order has no approved character");
const { data: rows } = await db.from("poses").select("pose_key,image_path").eq("character_id", character.id).eq("status", "done");
const available: Record<string, Buffer> = {};
for (const r of rows ?? []) {
  const f = await db.storage.from(BUCKETS.generated).download(r.image_path!);
  available[r.pose_key] = Buffer.from(await f.data!.arrayBuffer());
}

const template = (await getTemplate("nahjali-v1"))!;
const poses: Record<string, Buffer> = {};
for (const key of template.poses) {
  const src = [key, ...(FALLBACK[key] ?? [])].find((k) => available[k]);
  if (!src) throw new Error(`no image for pose ${key}`);
  poses[key] = available[src];
}

const t = Date.now();
const pdf = await composeBooklet(template, { style, childName: name, poses });
await mkdir("tmp", { recursive: true });
await writeFile("tmp/preview-booklet.pdf", pdf);
console.log(`PDF: ${template.pages.length} pages, ${(pdf.length / 1e6).toFixed(1)} MB, ${((Date.now() - t) / 1000).toFixed(1)}s`);

const doc = await PDFDocument.load(pdf);
for (let i = 0; i < doc.getPageCount(); i++) {
  const one = await PDFDocument.create();
  const [p] = await one.copyPages(doc, [i]);
  one.addPage(p);
  const n = String(i + 1).padStart(2, "0");
  await writeFile(`tmp/preview-page-${n}.pdf`, await one.save());
  execFileSync("sips", ["-s", "format", "png", "-Z", "700", `tmp/preview-page-${n}.pdf`, "--out", `tmp/preview-page-${n}.png`], { stdio: "ignore" });
}
