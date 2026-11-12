"use client";

// «الرضا فويس» — three jobs an engineer does by hand for hours, each done in one press on the selected clip:
// «موازنة المستوى» rides the voice's level phrase by phrase (the quiet words come up, the loud ones come down, with
// none of a compressor's squeeze); «حذف السكتات» cuts the clip down to where somebody actually speaks; «الموسيقى
// تحت الكلام» dips a music clip wherever a voice track speaks over it. All on the device, each one undo step.
// And «على مسارات كثيرة» (the case the engineer علي البقال raised: forty or fifty choir «آهات» tracks, each needing its
// silences cleaned and its wrong notes fixed — one by one is a day's work): the same jobs run on every clip of a
// group, or of the whole project, in one press and one undo step.

import { useState } from "react";
import { cleanVoice } from "@/lib/ridha/dsp/clean";
import { breathe } from "@/lib/ridha/dsp/fft";
import { applyGain, duckGain, findSound, gapsOf, rideLevel, type Region } from "@/lib/ridha/dsp/level";
import { psolaShift } from "@/lib/ridha/dsp/psola";
import { scaleById } from "@/lib/ridha/dsp/scales";
import { planTune } from "@/lib/ridha/dsp/tune";
import { SR, type Clip } from "@/lib/ridha/model";
import { replaceSound, stripSilence } from "@/lib/ridha/ops";
import { hear } from "../analysis";
import { putSound } from "../engine";
import { useStudio } from "../ctx";
import { Btn, Empty, Seg, Slider } from "../ui";

export default function SmartPanel() {
  const st = useStudio();
  const { clip, project, store } = st;
  const [range, setRange] = useState(8);
  const [speed, setSpeed] = useState(0.3);
  const [rode, setRode] = useState("");
  const [minSilence, setMinSilence] = useState(0.5);
  const [rel, setRel] = useState(-30);
  const [close, setClose] = useState(false);
  const [found, setFound] = useState<{ key: string; regions: Region[] } | null>(null);
  const [depth, setDepth] = useState(12);
  const [voiceId, setVoiceId] = useState("");

  if (!clip) {
    return (
      <div className="rv-smart">
        <section><Empty icon="" title="اختر مقطعًا">الأدوات الثلاث تشتغل على المقطع المحدد. وتحت: نفس الأدوات على مسارات كثيرة مرة وحدة.</Empty></section>
        <BatchTools />
      </div>
    );
  }

  // ── riding the level ──
  const ride = async (keep: boolean) => {
    const sound = st.clipSound(clip);
    if (!sound) return;
    const res = await st.work("موازنة المستوى", async (say) => {
      say(0.3, "متابعة مستوى الصوت جملة بجملة");
      return rideLevel(sound, SR, { range, speed });
    });
    if (!res) return;
    const r = res.report;
    setRode(r.before ? `الفرق بين الهادئ والعالي كان ${r.before.toFixed(1)} dB وصار ${r.after.toFixed(1)} dB (رفع حتى ${r.up.toFixed(1)} ونزّل حتى ${r.down.toFixed(1)}).` : "ما لقيت صوتًا واضحًا في المقطع.");
    if (!r.before) return;
    if (keep) st.applyToClip(clip, res.channels, "موازنة المستوى");
    else st.engine.listen(res.channels);
  };

  // ── taking the silences out ──
  const key = `${clip.id}:${clip.assetId}:${clip.offset}:${clip.dur}:${minSilence}:${rel}`;
  const scan = (): Region[] | null => {
    const sound = st.clipSound(clip);
    if (!sound) return null;
    const regions = findSound(sound, SR, { minSilence, relDb: rel });
    setFound({ key, regions });
    return regions;
  };
  const cur = found?.key === key ? found.regions : null;
  const gaps = cur ? gapsOf(cur, clip.dur) : [];
  const gone = gaps.reduce((s, g) => s + (g.b - g.a), 0);
  const strip = () => {
    const regions = cur ?? scan();
    if (!regions) return;
    if (!regions.length) return st.toast("المقطع كله سكوت بهذه الحساسية — خفّف الحساسية.");
    if (!gapsOf(regions, clip.dur).length) return st.toast("ما لقيت سكتات أطول من المدة اللي حددتها.");
    store.set((p) => {
      const r = stripSilence(p, clip.id, regions, close);
      st.select(r.ids);
      return r.project;
    });
    setFound(null);
    st.toast(`انحذفت السكتات (عددها ${gapsOf(regions, clip.dur).length}) — التراجع بـ ⌘Z`);
  };

  // ── music under the voice ──
  const voices = project.tracks.filter((t) => t.id !== clip.trackId && t.kind !== "group" && project.clips.some((c) => c.trackId === t.id && !c.muted && c.start < clip.start + clip.dur && c.start + c.dur > clip.start));
  const voice = voices.find((t) => t.id === voiceId) ?? voices[0] ?? null;
  const duck = async () => {
    const sound = st.clipSound(clip);
    if (!sound || !voice) return;
    const out = await st.work("الموسيقى تحت الكلام", async (say) => {
      say(0.2, `أسمع وين يتكلم «${voice.name}»`);
      const regions: Region[] = [];
      for (const v of project.clips) {
        if (v.trackId !== voice.id || v.muted || v.start >= clip.start + clip.dur || v.start + v.dur <= clip.start) continue;
        const s = st.clipSound(v);
        if (!s) continue;
        // the voice's phrases, moved to seconds from the music clip's own start
        for (const r of findSound(s, SR, { minSilence: 0.5 })) regions.push({ a: r.a + v.start - clip.start, b: r.b + v.start - clip.start });
      }
      if (!regions.length) throw new Error("ما لقيت كلامًا على هذا المسار فوق المقطع.");
      say(0.7, "خفض الموسيقى تحت كل جملة");
      return applyGain(sound, duckGain(sound[0].length, SR, regions, { depthDb: -depth }));
    });
    if (out) st.applyToClip(clip, out, "تحت الكلام");
  };

  return (
    <div className="rv-smart">
      <section>
        <div className="rv-panel-head"><b>موازنة المستوى</b></div>
        <p className="rv-muted">يد مهندس على الفيدر: الكلمات الواطية ترتفع والعالية تنزل، جملة بجملة، بدون ضغط الكمبريسور. للصوت البشري.</p>
        <Slider label="أقصى رفع أو خفض" value={range} min={3} max={12} step={0.5} unit="dB" def={8} onChange={setRange} />
        <label className="rv-slider"><span className="rv-slider-top"><span>يتابع</span></span>
          <Seg small value={speed} options={[{ value: 0.12, label: "كلمة بكلمة" }, { value: 0.3, label: "جملة بجملة" }, { value: 0.7, label: "بهدوء" }]} onChange={setSpeed} />
        </label>
        <div className="rv-clean-go">
          <Btn onClick={() => void ride(false)}>▶ معاينة</Btn>
          <Btn kind="ghost" onClick={() => st.engine.hush()}>■</Btn>
          <Btn kind="main" onClick={() => void ride(true)}>طبّق</Btn>
        </div>
        {rode ? <span className="rv-muted">{rode}</span> : null}
      </section>

      <section>
        <div className="rv-panel-head"><b>حذف السكتات</b></div>
        <p className="rv-muted">يقص المقطع على أماكن الكلام فقط ويشيل الفراغات — للبودكاست والدروس والتعليق.</p>
        <Slider label="السكتة الأطول من" value={minSilence} min={0.2} max={2} step={0.05} unit="s" def={0.5} onChange={setMinSilence} />
        <Slider label="الحساسية (أوطى = يعتبر أكثر كلامًا)" value={rel} min={-45} max={-18} step={1} unit="dB" def={-30} onChange={setRel} />
        <label className="rv-check"><input type="checkbox" checked={close} onChange={() => setClose(!close)} />قرّب الكلام من بعضه (يقصر المقطع)</label>
        <div className="rv-clean-go">
          <Btn onClick={() => void scan()}>افحص</Btn>
          <Btn kind="main" onClick={strip}>احذف السكتات</Btn>
        </div>
        {cur ? <span className="rv-muted">{gaps.length ? `عدد السكتات ${gaps.length}، ومجموعها ${gone.toFixed(1)} ثانية من ${clip.dur.toFixed(1)}.` : "ما في سكتات بهذه الإعدادات."}</span> : null}
      </section>

      <section>
        <div className="rv-panel-head"><b>الموسيقى تحت الكلام</b></div>
        <p className="rv-muted">اختر مقطع الموسيقى أو الأرضية: ينخفض تلقائيًا كل ما تكلم الصوت ويرجع بعده.</p>
        {voices.length ? (
          <>
            <label className="rv-pop-row"><span>الصوت اللي فوقه</span>
              <select value={voice?.id ?? ""} onChange={(e) => setVoiceId(e.target.value)}>
                {voices.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
            <Slider label="مقدار الخفض" value={depth} min={3} max={24} step={0.5} unit="dB" def={12} onChange={setDepth} />
            <div className="rv-clean-go">
              <Btn kind="main" onClick={() => void duck()}>اخفض «{clip.name.slice(0, 18)}» تحته</Btn>
            </div>
            <span className="rv-muted">إذا حرّكت الكلام بعدها: تراجع (⌘Z) وأعد الخفض.</span>
          </>
        ) : <span className="rv-muted">ما في مسار ثانٍ عليه صوت فوق هذا المقطع. حط الكلام على مسار والموسيقى على مسار، ثم اختر مقطع الموسيقى.</span>}
      </section>
      <BatchTools />
    </div>
  );
}

/** «على مسارات كثيرة»: one job on every playing clip of a group (or of the whole project), as ONE undo step. */
function BatchTools() {
  const st = useStudio();
  const { project, store } = st;
  const groups = project.tracks.filter((t) => t.kind === "group");
  const mine = project.tracks.find((t) => t.id === st.selTrack);
  const [scope, setScope] = useState<string>(mine?.kind === "group" ? mine.id : mine?.group ?? "all");
  const trackIds = (scope === "all" || !groups.some((g) => g.id === scope) ? project.tracks.filter((t) => t.kind !== "group") : project.tracks.filter((t) => t.group === scope)).map((t) => t.id);
  const clips = project.clips.filter((c) => trackIds.includes(c.trackId) && !c.muted);

  /** Runs `f` on every clip's sound and swaps each clip's sound for the result, all in one undo step. */
  const each = async (label: string, f: (c: Clip, sound: Float32Array[], say: (p: number) => void) => Promise<Float32Array[] | null>) => {
    if (!clips.length) return st.toast("ما في مقاطع على هذه المسارات.");
    const res = await st.work(`${label} على ${clips.length} مقطع`, async (say) => {
      const out: { c: Clip; y: Float32Array[] }[] = [];
      for (let i = 0; i < clips.length; i++) {
        const c = clips[i];
        say(i / clips.length, `${c.name} (${i + 1} من ${clips.length})`);
        const sound = st.clipSound(c);
        if (!sound) continue;
        const y = await f(c, sound, (p) => say((i + p) / clips.length));
        if (y) out.push({ c, y });
        await breathe();
      }
      return out;
    });
    if (!res?.length) return;
    const made = res.map((r) => ({ id: r.c.id, s: putSound(r.y, `${r.c.name} · ${label}`), dur: r.y[0].length / SR }));
    store.set((p) => made.reduce((q, m) => replaceSound(q, m.id, m.s.id, m.dur), p));
    st.toast(`تم: ${label} على ${made.length} مقطع — التراجع بـ ⌘Z مرة وحدة يرجّعها كلها`);
  };

  const clean = () => each("تنظيف", async (_c, sound) => {
    const out: Float32Array[] = [];
    for (const ch of sound) out.push((await cleanVoice(ch, SR, { noise: 0.55, ai: false, rumbleHz: 80, hum: true, clicks: true, deEss: 0.35, reverb: 0, gate: false, declip: true, guard: true })).out);
    return out;
  });
  const tune = () => {
    const key = project.key;
    if (!key || key.scale === "chromatic") return st.toast("حدّد طبقة الاستقرار والمقام أولًا من «أوتوتيون ونغمة» (اكتشف النغمة على أي مقطع)، ثم ارجع.");
    const scale = scaleById(key.scale);
    return each("أوتوتيون على المقام", async (c, sound, say) => {
      const h = await hear(c, sound, (p) => say(p * 0.8));
      const plan = planTune(h.track, { tonic: key.tonic, scale, strength: 0.8, speedMs: 110, transpose: 0 });
      return sound.map((ch) => psolaShift(ch, h.track, (f) => plan.ratio[f], 1, h.marks));
    });
  };
  const ride = () => each("موازنة المستوى", async (_c, sound) => {
    const r = rideLevel(sound, SR, { range: 6, speed: 0.3 });
    return r.report.before ? r.channels : null;
  });
  const strip = async () => {
    if (!clips.length) return st.toast("ما في مقاطع على هذه المسارات.");
    const found = await st.work(`حذف السكتات من ${clips.length} مقطع`, async (say) => {
      const out: { id: string; regions: Region[] }[] = [];
      for (let i = 0; i < clips.length; i++) {
        say(i / clips.length, clips[i].name);
        const sound = st.clipSound(clips[i]);
        if (!sound) continue;
        const regions = findSound(sound, SR, { minSilence: 0.35, relDb: -34 });
        if (regions.length && gapsOf(regions, clips[i].dur).length) out.push({ id: clips[i].id, regions });
        await breathe();
      }
      return out;
    });
    if (!found?.length) return st.toast("ما لقيت سكتات واضحة في هذه المقاطع.");
    store.set((p) => found.reduce((q, f) => stripSilence(q, f.id, f.regions).project, p));
    st.toast(`انحذفت السكتات من ${found.length} مقطع (مكان كل آهة باقي كما هو) — التراجع بـ ⌘Z`);
  };

  return (
    <section className="rv-batch">
      <div className="rv-panel-head">
        <b>على مسارات كثيرة مرة وحدة</b>
        <label className="rv-pop-row">
          <select value={scope} onChange={(e) => setScope(e.target.value)} aria-label="المسارات">
            {groups.map((g) => <option key={g.id} value={g.id}>قروب «{g.name}» ({project.tracks.filter((t) => t.group === g.id).length} مسارات)</option>)}
            <option value="all">كل المسارات ({project.tracks.filter((t) => t.kind !== "group").length})</option>
          </select>
        </label>
        <span className="rv-muted">{clips.length} مقطع</span>
      </div>
      <p className="rv-muted">لعشرات تراكات الآهات أو الكورال: صدّر كل تراك من كيوبيس كملف، واسحبها كلها مرة وحدة هنا (كل ملف يصير مسار)، وحطها في قروب، ثم اختر:</p>
      <div className="rv-pills">
        <button type="button" onClick={() => void strip()} title="يشيل الفراغات بين الآهات ويبقي كل آهة في مكانها">حذف السكتات</button>
        <button type="button" onClick={() => void clean()} title="تنظيف الضجيج والطنين والتشويش مع حماية الحروف">تنظيف</button>
        <button type="button" onClick={() => void tune()} title="يصحّح النغمات الغلط على المقام المحدد في لوحة الأوتوتيون">تصحيح النغمات على المقام</button>
        <button type="button" onClick={() => void ride()} title="يوازن مستوى كل تراك جملة بجملة">موازنة المستوى</button>
      </div>
    </section>
  );
}
