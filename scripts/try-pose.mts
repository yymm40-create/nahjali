// DEV: generates one pose for an order's approved character with the current prompts,
// without touching the order. Saves tmp/pose-<pose>.png (transparent), used by preview-booklet.mts.
// Usage: npx tsx --env-file=.env.local scripts/try-pose.mts <orderId> <pose> [style] [boy|girl] [quality]
import { mkdir, writeFile } from "fs/promises";
import { BUCKETS, createAdminClient } from "@/lib/supabase/admin";
import { generateFromReference } from "@/lib/openai";
import { getApprovedCharacter } from "@/lib/orders";
import { posePrompt, type Gender } from "@config/prompts";
import { isQuality } from "@config/pricing";
import { isStyle, STYLES } from "@config/styles";

const [orderId, pose, style = "pixar", gender = "boy", q = "high"] = process.argv.slice(2);
if (!orderId || !pose || !isStyle(style) || !isQuality(q)) throw new Error("Usage: try-pose.mts <orderId> <pose> [style] [boy|girl] [quality]");

const character = await getApprovedCharacter(orderId);
if (!character?.base_image_path) throw new Error("order has no approved character");
const ref = await createAdminClient().storage.from(BUCKETS.generated).download(character.base_image_path);
if (ref.error) throw ref.error;

const t = Date.now();
const image = await generateFromReference(Buffer.from(await ref.data.arrayBuffer()), posePrompt(pose, style, gender as Gender), q, {
  cutout: true,
  styleReference: STYLES[style].referenceImage,
});
await mkdir("tmp", { recursive: true });
await writeFile(`tmp/pose-${pose}.png`, image);
console.log(`saved tmp/pose-${pose}.png (${((Date.now() - t) / 1000).toFixed(0)}s)`);
