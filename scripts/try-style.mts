// DEV: tries the character prompt for a style/gender on an order's uploaded photo,
// without touching the order. Saves the result to tmp/style-test-<style>.png.
// Usage: npx tsx --env-file=.env.local scripts/try-style.mts <orderId> <style> <boy|girl> [low|medium|high]
import { mkdir, writeFile } from "fs/promises";
import { createAdminClient, BUCKETS } from "@/lib/supabase/admin";
import { generateFromReference } from "@/lib/openai";
import { sourcePath } from "@/lib/orders";
import { characterPrompt } from "@config/prompts";
import { isQuality } from "@config/pricing";
import { isStyle, STYLES } from "@config/styles";

const [orderId, style, gender, q = "medium"] = process.argv.slice(2);
if (!orderId || !isStyle(style) || (gender !== "boy" && gender !== "girl") || !isQuality(q)) {
  throw new Error("Usage: scripts/try-style.mts <orderId> <style> <boy|girl> [low|medium|high]");
}

const db = createAdminClient();
const { data: order } = await db.from("orders").select("id,user_id").eq("id", orderId).single();
const src = await db.storage.from(BUCKETS.sources).download(sourcePath(order!));
if (src.error) throw new Error("No source photo for this order (it may already be deleted)");

const t = Date.now();
const image = await generateFromReference(Buffer.from(await src.data.arrayBuffer()), characterPrompt(style, gender), q, {
  cutout: false,
  styleReference: STYLES[style].referenceImage,
});
await mkdir("tmp", { recursive: true });
await writeFile(`tmp/style-test-${style}.png`, image);
console.log(`saved tmp/style-test-${style}.png (${q}, ${((Date.now() - t) / 1000).toFixed(0)}s)`);
