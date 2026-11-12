import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { can, permForGenerator } from "@/lib/access";
import { coinBalance, holdCoins, logCost, releaseCoins } from "@/lib/coins";
import { createAdminClient } from "@/lib/supabase/admin";
import { storage } from "@/lib/storage";
import { coinsOf, generatorById, priceKindOf, SMART_SELECT_KEY } from "@config/jawad/generators";
import { IMAGE_TOOL_USD, IMG_INPAINT_ID } from "@config/jawad/image-tools";
import { requireJawadApiUser } from "@/lib/jawad/server/access";
import { smartSelect } from "@/lib/jawad/server/image-tools";
import { ProviderError } from "@/lib/jawad/server/providers/common";
import { JAWAD_BUCKET, loadRuntime } from "@/lib/jawad/server/runtime";
import { isUuid, type UploadRow } from "@/lib/jawad/server/uploads";

export const maxDuration = 120;

/**
 * JAWAD AI · «✨ تحديد ذكي» in «امسح بالفرشاة»: the person names what to select («الكوب», «الشخص اللي يمين») and SAM 3
 * outlines it on their picture; the mask comes back to the page, which adds it to what was painted (and can still be
 * corrected with the brush). Its small price (the generator's «select» line) is shown first, held, and given back if
 * nothing could be selected.
 */
export const POST = handle(async (req: Request) => {
  const { user, owner } = await requireJawadApiUser();
  const b = (await req.json().catch(() => ({}))) as { uploadId?: unknown; words?: unknown; expectedCoins?: unknown };
  const def = generatorById(IMG_INPAINT_ID)!;
  if (!(await can(user.email, permForGenerator(def)))) throw new UserError("صناعة الصور مقفلة لحسابك حاليًا.", 403);
  const rt = await loadRuntime();
  const rg = rt.generators.find((g) => g.id === def.id);
  if (!rg || !(rg.live || (owner && rg.keyConfigured))) throw new UserError("التحديد الذكي غير متاح حاليًا.", 403);
  const words = String(b.words ?? "").trim().slice(0, 200);
  if (!words) throw new UserError("اكتب وش تبي تحدد (مثلًا: الكوب).", 400);
  if (!isUuid(b.uploadId)) throw new UserError("الصورة غير صحيحة.", 400);
  const { data } = await createAdminClient().from("jawad_uploads").select("*").eq("id", b.uploadId).eq("user_id", user.id).eq("status", "ready").maybeSingle();
  const row = data as UploadRow | null;
  if (!row || row.kind !== "image") throw new UserError("ما لقينا الصورة.", 404);

  const centi = rt.prices[def.id]?.[SMART_SELECT_KEY];
  if (centi == null) throw new UserError("سعر التحديد الذكي غير محدد بعد.", 409);
  const coins = owner ? 0 : coinsOf(centi, priceKindOf(def));
  if (Number(b.expectedCoins) !== coins) return NextResponse.json({ error: "تغيّر سعر التحديد الذكي. أكّد المبلغ الجديد.", code: "price_changed", coins }, { status: 409 });

  const ref = `image-select:${crypto.randomUUID()}`;
  const label = "JAWAD AI · ✨ تحديد ذكي";
  await holdCoins(user.id, coins, ref, label);
  try {
    const dl = await storage.from(JAWAD_BUCKET).download(row.storage_path);
    if (dl.error || !dl.data) throw new ProviderError("rejected", "تعذّر قراءة الصورة.", `select download: ${dl.error?.message}`);
    const found = await smartSelect(Buffer.from(await dl.data.arrayBuffer()), words);
    if (!found) {
      await releaseCoins(user.id, coins, ref, label);
      return NextResponse.json({ mask: null, concept: null, coins: 0, balance: owner ? null : await coinBalance(user.id) });
    }
    await logCost(user.id, ref, label, IMAGE_TOOL_USD.sam + IMAGE_TOOL_USD.translate).catch(() => {});
    return NextResponse.json({ mask: `data:image/png;base64,${found.png.toString("base64")}`, concept: found.concept, coins, balance: owner ? null : await coinBalance(user.id) });
  } catch (e) {
    await releaseCoins(user.id, coins, ref, label).catch(() => {});
    if (e instanceof ProviderError) throw new UserError(`${e.userMessage} ما انخصم منك شي.`, 502);
    throw e;
  }
});
