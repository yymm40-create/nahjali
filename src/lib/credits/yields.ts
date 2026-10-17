// «تقدر تسوي فيها»: what one standard picture and one 5-second 720p video cost NOW — the studio's own price check on
// the owner's live price table and margins (pictures 60٪, videos 40٪) — so every package shows what its balance makes.
// Server only.

import { SCENE_PACK_SAR, type UnitPrices } from "@config/credits";
import { generatorById } from "@config/jawad/generators";
import { evaluate, priceTable } from "@/lib/jawad/engine";
import { loadRuntime } from "@/lib/jawad/server/runtime";
import { loadPricing } from "@/lib/coins";

const IMAGE = "openai-gpt-image-2";
const VIDEO = "byteplus-seedance-2-0";

export async function unitPrices(): Promise<UnitPrices> {
  await loadPricing();
  const rt = await loadRuntime().catch(() => null);
  const price = (id: string, settings: Record<string, string | number | boolean>) => {
    const def = generatorById(id);
    if (!def) return 0;
    const table = rt?.prices[id] ?? priceTable(def, undefined);
    const e = evaluate(def, { settings, prompt: "x".repeat(400), instructions: "", refStyle: "none", refs: [] }, table);
    return e.price.ok ? e.price.coins : 0;
  };
  return {
    // a standard square picture, medium quality (the studio's defaults)
    image: price(IMAGE, {}),
    video5: price(VIDEO, { resolution: "720p", duration: 5, ratio: "16:9" }),
    scene: SCENE_PACK_SAR * 100,
  };
}
