// DEV: tries the current CHARACTER_PROMPT + style reference on an order's uploaded photo,
// without touching the order. Saves the result to tmp/style-test.png.
// Usage: npx tsx --env-file=.env.local scripts/try-style.mts <orderId> [low|medium|high]
import { mkdir, writeFile } from "fs/promises";
import { createAdminClient, BUCKETS } from "@/lib/supabase/admin";
import { generateFromReference } from "@/lib/openai";
import { sourcePath } from "@/lib/orders";
import { CHARACTER_PROMPT, STYLE_REFERENCE } from "@config/prompts";
import { isQuality } from "@config/pricing";

const [orderId, q = "medium"] = process.argv.slice(2);
if (!orderId || !isQuality(q)) throw new Error("Usage: scripts/try-style.mts <orderId> [low|medium|high]");

const db = createAdminClient();
const { data: order } = await db.from("orders").select("id,user_id").eq("id", orderId).single();
const src = await db.storage.from(BUCKETS.sources).download(sourcePath(order!));
if (src.error) throw src.error;

const t = Date.now();
const image = await generateFromReference(Buffer.from(await src.data.arrayBuffer()), CHARACTER_PROMPT, q, {
  cutout: false,
  withStyleRef: STYLE_REFERENCE.useForCharacter,
});
await mkdir("tmp", { recursive: true });
await writeFile("tmp/style-test.png", image);
console.log(`saved tmp/style-test.png (${q}, ${((Date.now() - t) / 1000).toFixed(0)}s)`);
