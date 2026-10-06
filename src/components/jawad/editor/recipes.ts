// «أساليب جاهزة»: the one-tap styles adapted from majed-video (Majed Alzaabi, MIT), as plug-ins. The rules are pure
// (src/lib/editor/recipes.ts); here they get what the page knows (the files' loudness) or go to Claude when they need
// to understand what is said.

import { mainTrack } from "@/lib/editor/model";
import { beatMontage, calmExplainer, jumpZoom, onTimeline, reelCaptions, silentSpans } from "@/lib/editor/recipes";
import { PEAK_RATE, peaksOf } from "./peaks";
import type { EditorPlugin } from "./plugins";

const CREDIT = "مستوحاة من majed-video لماجد الزعابي (MIT)";

export const RECIPES: EditorPlugin[] = [
  {
    id: "tight-cut",
    icon: "✂️",
    label: "قص السكتات (ريلز)",
    hint: "يشيل كل سكتة ٠٫٣٥ ث أو أطول ويخلّي نفَس ٠٫١٣ ث حول الكلام.",
    credit: CREDIT,
    run: async ({ tl, assets }) => {
      const main = mainTrack(tl);
      // the voice: the main track's clips that have sound, else the sound tracks
      const voiced = (main?.clips ?? []).filter((c) => assets.get(c.assetId ?? "")?.hasAudio && c.volume > 0);
      const clips = voiced.length ? voiced : tl.tracks.filter((t) => t.kind === "audio" && !t.duck).flatMap((t) => t.clips);
      const ranges: [number, number][] = [];
      for (const c of clips) {
        const a = assets.get(c.assetId ?? "");
        if (!a?.url) continue;
        const peaks = await peaksOf(a.id, a.url);
        if (peaks) ranges.push(...onTimeline(c, silentSpans(peaks, PEAK_RATE, c.in, c.out)));
      }
      if (!ranges.length) throw new Error("ما لقينا سكتات طويلة تنشال.");
      return [{ type: "remove_ranges", ranges }];
    },
  },
  {
    id: "jump-zoom",
    icon: "🔍",
    label: "جمب كت بزوم",
    hint: "كل قطعة بتكبير مختلف (١٠٠–١١٤٪) والوجه ثابت فوق؛ أحلى بعد «قص السكتات».",
    credit: CREDIT,
    enabled: ({ tl }) => (mainTrack(tl)?.clips.length ?? 0) > 1,
    run: ({ tl }) => jumpZoom(tl),
  },
  {
    id: "reel-captions",
    icon: "💬",
    label: "كابشن ريلز",
    hint: "عريض، الكلمة المنطوقة بالأصفر، تحت بس بعيد عن أزرار التطبيق.",
    credit: CREDIT,
    run: ({ tl }) => {
      const cmds = reelCaptions(tl);
      if (!cmds.length) throw new Error("سوّ الكابشن أول من زر «كابشن»، بعدين طبّق هذا.");
      return cmds;
    },
  },
  {
    id: "hook",
    icon: "🪝",
    label: "هوك افتتاحي",
    hint: "Claude يكتب جملة افتتاحية من أقوى كلامك ويحطها أول ثانيتين مع زووم.",
    credit: CREDIT,
    run: ({ ask }) => {
      ask("اكتب هوك افتتاحي (٣–٨ كلمات) من أقوى جملة في الكلام، وحطه نص كبير في البداية مع زووم خفيف أول ثانية.");
      return [];
    },
  },
  {
    id: "beat-montage",
    icon: "🥁",
    label: "مونتاج على الإيقاع",
    hint: "يقص كل لقطة على ضربة الإيقاع بأطوال متنوعة. اكشف الإيقاع أول من مقطع الموسيقى.",
    credit: CREDIT,
    run: ({ tl, infos }) => {
      if (tl.markers.length < 4) throw new Error("حط الموسيقى واضغط «اكشف الإيقاع» من تبويب الصوت أول.");
      const cmds = beatMontage(tl, infos);
      if (!cmds.length) throw new Error("ما فيه لقطات كفاية في المسار الرئيسي.");
      return cmds;
    },
  },
  {
    id: "podcast",
    icon: "🎙️",
    label: "مقطع بودكاست",
    hint: "Claude يختار أقوى مقطع ويقصه، ينظّف الصوت، ويحط هوك.",
    credit: CREDIT,
    run: ({ ask }) => {
      ask("هذا بودكاست: اختر أقوى مقطع (٣٠–٦٠ ثانية) وقص الباقي، نظّف الصوت (عزل الضوضاء + محسّن الصوت)، وحط هوك افتتاحي.");
      return [];
    },
  },
  {
    id: "calm",
    icon: "🍃",
    label: "شرح هادي",
    hint: "انتقالات ناعمة وزووم خفيف بطيء، للشرح والكلام الهادي.",
    credit: CREDIT,
    run: ({ tl }) => {
      const cmds = calmExplainer(tl);
      if (!cmds.length) throw new Error("أضف مقاطع للمسار الرئيسي أول.");
      return cmds;
    },
  },
];
