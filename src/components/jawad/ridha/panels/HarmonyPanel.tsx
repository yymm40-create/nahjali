"use client";

// «الرضا فويس» — the 3D harmony generator: for the selected sung clip and the project's key it proposes sets of
// extra voices (best first, with the reason), grows a stack to order with «مستوى الجنون» and , shows where each
// voice stands around the listener on a stage seen from above, opens every voice to its interval, its way of moving,
// its moment to sing and its place — and plays the whole idea in headphones before any of it is kept. Kept voices
// arrive as tracks inside ONE group that already carries a harmony's usual mix.

import { useEffect, useMemo, useRef, useState } from "react";
import { detectKey, scaleById } from "@/lib/ridha/dsp/scales";
import { pitchStats } from "@/lib/ridha/dsp/pitch";
import { harmonyTips, INTERVALS, MOTIONS, singHarmony, suggestHarmony, voice as newVoice, WHENS, wildHarmony, WILD_LEVELS, type HarmonyIdea, type HarmonyVoice } from "@/lib/ridha/harmony";
import { makeFx, makeProject, makeTrack, SR, type Clip, type Project } from "@/lib/ridha/model";
import { addClip, addGroup, addTrack, patchTrack } from "@/lib/ridha/ops";
import { hear, type Heard } from "../analysis";
import { dropSound, putSound, renderProject } from "../engine";
import { useStudio } from "../ctx";
import { Btn, Empty, Seg, Slider } from "../ui";

const COLORS = ["#8f8cff", "#ff8a6b", "#5db8ff", "#b6e35a", "#f27fc4", "#c9a37a", "#2fd6c3", "#e9b949"];
const STAGE = 250, MAXD = 5;

/** What a group of harmony voices usually wears: its low end cut, its hiss softened, held together by one compressor. */
const harmonyChain = () => [
  makeFx("eq", {}, [{ on: true, freq: 170 }, { gain: -2, freq: 220 }, { freq: 400, gain: -2.5, q: 0.9 }, {}, { freq: 3000, gain: -1, q: 0.8 }, {}, { gain: 2, freq: 10000 }]),
  makeFx("deess", { freq: 6000, threshold: -34, amount: 0.7 }),
  makeFx("comp", { threshold: -26, ratio: 4, attack: 18, release: 180, knee: 12, makeup: 3 }),
];

export default function HarmonyPanel() {
  const st = useStudio();
  const { clip, project, store } = st;
  const [heard, setHeard] = useState<{ id: string; h: Heard } | null>(null);
  const [pick, setPick] = useState(0);
  const [voices, setVoices] = useState<HarmonyVoice[] | null>(null);
  const [sel, setSel] = useState(0);
  const [level, setLevel] = useState(3);
  const [wild, setWild] = useState<HarmonyIdea | null>(null);
  const [seed, setSeed] = useState(1);
  const stage = useRef<HTMLCanvasElement>(null);
  const sung = useRef(new Map<string, Float32Array>());
  const id = clip ? `${clip.assetId}:${clip.offset}:${clip.dur}` : "";
  const h = heard?.id === id ? heard.h : null;
  const key = project.key;
  const scale = scaleById(key?.scale ?? "chromatic");
  const range = useMemo(() => (h ? pitchStats(h.track) : null), [h]);
  const ideas = useMemo(() => (range ? [...(wild ? [wild] : []), ...suggestHarmony(range, scale)] : []), [range, scale, wild]);
  const idea = ideas[pick] ?? null;
  const vs = useMemo(() => voices ?? idea?.voices ?? [], [voices, idea]);
  const tips = useMemo(() => (idea ? harmonyTips({ ...idea, voices: vs }, scale) : []), [idea, vs, scale]);

  useEffect(() => {
    const c = stage.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = c.height = Math.round(STAGE * dpr);
    const g = c.getContext("2d")!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, STAGE, STAGE);
    const cx = STAGE / 2, R = STAGE / 2 - 14;
    for (let d = 1; d <= MAXD; d++) {
      g.beginPath();
      g.arc(cx, cx, (d / MAXD) * R, 0, 7);
      g.strokeStyle = d === MAXD ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.07)";
      g.stroke();
    }
    g.fillStyle = "rgba(255,255,255,0.07)";
    g.fillRect(cx, cx - R, 1, R * 2);
    g.fillRect(cx - R, cx, R * 2, 1);
    g.fillStyle = "rgba(163,171,185,0.8)";
    g.font = "10px system-ui";
    g.textAlign = "center";
    g.fillText("أمام", cx, 11);
    g.fillText("خلف", cx, STAGE - 4);
    g.fillText("يسار", 14, cx - 4);
    g.fillText("يمين", STAGE - 14, cx - 4);
    // the listener, and the lead a metre in front
    g.beginPath();
    g.arc(cx, cx, 9, 0, 7);
    g.fillStyle = "#eef1f6";
    g.fill();
    g.beginPath();
    g.arc(cx, cx - (1 / MAXD) * R, 7, 0, 7);
    g.fillStyle = "#e9b949";
    g.fill();
    vs.forEach((v, i) => {
      const a = (v.az * Math.PI) / 180, r = (Math.min(MAXD, v.dist) / MAXD) * R;
      const x = cx + r * Math.sin(a), y = cx - r * Math.cos(a);
      g.beginPath();
      // higher voices are drawn larger: «above the head»
      g.arc(x, y, 7.5 + Math.max(0, v.el) / 12, 0, 7);
      g.fillStyle = COLORS[i % COLORS.length];
      g.globalAlpha = v.when === "always" ? 0.92 : 0.6;
      g.fill();
      g.globalAlpha = 1;
      if (i === sel) {
        g.lineWidth = 2;
        g.strokeStyle = "#fff";
        g.stroke();
      }
      g.fillStyle = "#0b1016";
      g.font = "700 9.5px system-ui";
      g.fillText(String(i + 1), x, y + 3.5);
    });
  }, [vs, sel]);

  if (!clip) return <Empty icon="" title="اختر مقطع الصوت الرئيسي">الهارموني يُبنى من صوتك نفسه: نفس الكلمات والتوقيت، على نغمات أخرى وفي أماكن حولك.</Empty>;

  const start = async () => {
    const sound = st.clipSound(clip);
    if (!sound) return;
    const res = await st.work("سماع اللحن", (say) => hear(clip, sound, (p) => say(p, "تتبّع النغمة")));
    if (!res) return;
    if (pitchStats(res.track).voiced < 0.15) return st.toast("ما لقيت لحنًا مغنّى في هذا المقطع. الهارموني يحتاج صوتًا واحدًا واضحًا.");
    if (!project.key) {
      const g = detectKey(res.track)[0];
      if (g) store.set((p) => ({ ...p, key: { tonic: g.tonic, scale: g.scale.id } }), { undo: false });
    }
    setHeard({ id, h: res });
    setPick(0);
    setVoices(null);
    setWild(null);
  };

  const generate = (lv: number, sd: number) => {
    if (!range) return;
    setLevel(lv);
    setSeed(sd);
    setWild(wildHarmony(lv, range, scale, sd));
    setPick(0);
    setVoices(null);
    setSel(0);
  };

  /** Each voice of the idea, sung (kept: only a changed part is sung again; moving a voice in space costs nothing). */
  const sing = async (): Promise<Float32Array[] | null> => {
    if (!h) return null;
    return st.work("غناء الهارموني", async (say) => {
      const out: Float32Array[] = [];
      for (let i = 0; i < vs.length; i++) {
        const v = vs[i];
        const k = [id, key?.tonic, scale.id, v.steps, v.octaves, v.detune, v.formant, v.motion, v.pedalStep, v.tight, v.when].join("|");
        let y = sung.current.get(k);
        if (!y) {
          say(i / vs.length, `${i + 1} / ${vs.length} · ${v.name}`);
          await new Promise((r) => setTimeout(r, 0));
          y = singHarmony(h.mono, h.track, h.marks, { tonic: key?.tonic ?? 0, scale }, v);
          if (sung.current.size > 40) sung.current.delete(sung.current.keys().next().value!);
          sung.current.set(k, y);
        }
        out.push(y);
      }
      return out;
    });
  };

  /** A big stack is turned down as a whole: every doubling adds 3 dB. */
  const groupGain = Math.round(Math.min(0, -4.5 * Math.log2(Math.max(1, vs.length) / 3)) * 10) / 10;

  /** A small project of the lead and the voices in their places, through the harmony group's own mix. */
  const build = (parts: Float32Array[], lead: Clip): { project: Project; ids: string[] } => {
    const ids: string[] = [];
    let p = makeProject("هارموني");
    p = { ...p, tracks: [makeTrack("الرئيسي", 0)], reverb: project.reverb };
    p = addClip(p, { trackId: p.tracks[0].id, assetId: lead.assetId, start: 0, offset: lead.offset, dur: lead.dur, name: "lead" }).project;
    const tids: string[] = [];
    vs.forEach((v, i) => {
      const s = putSound([parts[i]], v.name);
      ids.push(s.id);
      const made = addTrack(p, v.name, { gain: v.gain, space: { on: true, az: v.az, el: v.el, dist: v.dist }, sendReverb: v.motion === "pedal" ? 0.45 : 0.3 });
      tids.push(made.track.id);
      p = addClip(made.project, { trackId: made.track.id, assetId: s.id, start: v.delayMs / 1000, dur: parts[i].length / SR, name: v.name }).project;
    });
    const g = addGroup(p, tids, "هارموني");
    return { project: patchTrack(g.project, g.track.id, { fx: harmonyChain(), gain: groupGain }), ids };
  };

  const preview = async () => {
    const parts = await sing();
    if (!parts) return;
    const tmp = build(parts, clip);
    const mix = await st.work("تجهيز المعاينة", () => renderProject(tmp.project));
    tmp.ids.forEach(dropSound);
    if (mix) st.engine.listen(mix);
  };

  const keep = async () => {
    const parts = await sing();
    if (!parts) return;
    store.set((p) => {
      let q = p;
      const tids: string[] = [];
      vs.forEach((v, i) => {
        const s = putSound([parts[i]], `هارموني · ${v.name}`);
        const made = addTrack(q, v.name, { color: COLORS[i % COLORS.length], gain: v.gain, space: { on: true, az: v.az, el: v.el, dist: v.dist }, sendReverb: v.motion === "pedal" ? 0.45 : 0.3 });
        tids.push(made.track.id);
        q = addClip(made.project, { trackId: made.track.id, assetId: s.id, start: clip.start + v.delayMs / 1000, dur: parts[i].length / SR, name: v.name }).project;
      });
      // the voices arrive inside one group wearing a harmony's usual mix: one fader, one equalizer, one compressor for all
      const g = addGroup(q, tids, `هارموني · ${idea?.name ?? ""}`.trim());
      return patchTrack(g.project, g.track.id, { fx: harmonyChain(), gain: groupGain });
    });
    st.toast(`أضفت ${vs.length} ${vs.length > 10 ? "صوتًا" : "أصوات"} داخل قروب واحد بمكسه — فيدر القروب يحكمها كلها، وكل صوت يتعدّل لحاله`);
  };

  const patch = (i: number, p: Partial<HarmonyVoice>) => setVoices(vs.map((v, k) => (k === i ? { ...v, ...p } : v)));
  const onStage = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const cx = STAGE / 2, R = STAGE / 2 - 14;
    const at = (ev: { clientX: number; clientY: number }) => ({ x: ev.clientX - r.left - cx, y: ev.clientY - r.top - cx });
    const p0 = at(e);
    let best = -1, bd = 20;
    vs.forEach((v, i) => {
      const a = (v.az * Math.PI) / 180, rr = (Math.min(MAXD, v.dist) / MAXD) * R;
      const d = Math.hypot(rr * Math.sin(a) - p0.x, -rr * Math.cos(a) - p0.y);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    if (best < 0) return;
    setSel(best);
    el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const p = at(ev);
      patch(best, { az: Math.round((Math.atan2(p.x, -p.y) * 180) / Math.PI), dist: Math.round(Math.max(0.6, Math.min(MAXD, (Math.hypot(p.x, p.y) / R) * MAXD)) * 10) / 10 });
    };
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  };

  if (!h) {
    return (
      <div className="rv-eq-empty">
        <Empty icon="" title="مولّد الهارموني ثلاثي الأبعاد">يسمع لحنك ونغمته، ويبني أصواتًا ترافقه على كل درجات السلّم — من صوت واحد إلى جدار من ستة عشر — موزعة حولك في الفراغ. الأفضل بالسماعات.</Empty>
        <Btn kind="main" onClick={() => void start()}>ولّد هارموني لهذا المقطع</Btn>
      </div>
    );
  }
  const v = vs[sel];
  return (
    <div className="rv-harmony">
      <div className="rv-harmony-ideas">
        <div className="rv-wild">
          <div className="rv-panel-head">
            <b>مستوى الجنون</b>
            <span className="rv-muted">{WILD_LEVELS[level - 1]}</span>
            <span className="rv-grow" />
            <Btn small kind="gold" onClick={() => generate(level, seed + 1)} title="توليفة ثانية بنفس المستوى">ولّد توليفة</Btn>
          </div>
          <Seg value={level} options={WILD_LEVELS.map((n, i) => ({ value: i + 1, label: String(i + 1), title: n }))} onChange={(lv) => generate(lv, seed)} />
        </div>
        <div className="rv-panel-head">
          <b>توزيعات جاهزة</b>
          <span className="rv-muted">{key ? `مرتّبة لـ ${scale.name}` : ""}</span>
        </div>
        <div className="rv-harmony-list">
          {ideas.map((it, i) => (
            <button key={it.id} type="button" className={`rv-card rv-card-row${i === pick ? " on" : ""}${it.experimental ? " warn" : ""}`} onClick={() => (setPick(i), setVoices(null), setSel(0))}>
              <i>{it.icon}</i>
              <span>
                <b>{it.name}{it.id.startsWith("wild") ? "" : <small> · {it.voices.length}</small>}</b>
                <small>{it.why}</small>
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className="rv-harmony-stage">
        <canvas ref={stage} style={{ width: STAGE, height: STAGE }} onPointerDown={onStage} />
        <span className="rv-muted">اسحب أي صوت لمكانه · الذهبي صوتك · بالسماعات</span>
        <div className="rv-row">
          <Btn onClick={() => void preview()}>▶ اسمع</Btn>
          <Btn kind="ghost" onClick={() => st.engine.hush()}>■</Btn>
          <Btn kind="main" onClick={() => void keep()}>＋ أضفه للمسارات</Btn>
        </div>
        {tips.length ? (
          <details className="rv-tips" open>
            <summary>نصايح لهذا التوزيع</summary>
            <ul>{tips.map((t) => <li key={t}>{t}</li>)}</ul>
          </details>
        ) : null}
      </div>
      <div className="rv-harmony-voices">
        <div className="rv-panel-head">
          <b>الأصوات ({vs.length})</b>
          <span className="rv-grow" />
          <Btn small disabled={vs.length >= 16} onClick={() => (setVoices([...vs, newVoice("صوت جديد", 0, 0, Math.round(Math.random() * 360 - 180), { detune: Math.round(Math.random() * 20 - 10), gain: -10 })]), setSel(vs.length))}>＋ صوت</Btn>
          <Btn small kind="ghost" disabled={vs.length <= 1} onClick={() => (setVoices(vs.filter((_, k) => k !== sel)), setSel(0))}>حذف</Btn>
        </div>
        <div className="rv-pills">
          {vs.map((x, i) => (
            <button key={i} type="button" className={i === sel ? "on" : ""} onClick={() => setSel(i)} style={{ ["--dot" as string]: COLORS[i % COLORS.length] }} title={x.name}>
              <i className="rv-dot" />
              {i + 1}
            </button>
          ))}
        </div>
        {v ? (
          <div className="rv-params">
            <label className="rv-slider">
              <span className="rv-slider-top"><span>الدرجة</span><b>{v.name}</b></span>
              <select value={`${v.steps}:${v.octaves}`} disabled={v.motion === "pedal"} onChange={(e) => {
                const [s, o] = e.target.value.split(":").map(Number);
                patch(sel, { steps: s, octaves: o, name: INTERVALS.find((n) => n.steps === s && n.octaves === o)?.label ?? v.name });
              }}>
                {INTERVALS.map((n) => <option key={n.label} value={`${n.steps}:${n.octaves}`}>{n.label}</option>)}
              </select>
            </label>
            <label className="rv-slider">
              <span className="rv-slider-top"><span>الحركة</span></span>
              <select value={v.motion} onChange={(e) => patch(sel, { motion: e.target.value as HarmonyVoice["motion"] })} title={MOTIONS.find((m) => m.id === v.motion)?.hint}>
                {MOTIONS.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </label>
            {v.motion === "pedal" ? (
              <label className="rv-slider">
                <span className="rv-slider-top"><span>النغمة الممسوكة</span></span>
                <Seg small value={v.pedalStep} options={[{ value: 0, label: "القرار" }, { value: 3, label: "الرابعة" }, { value: 4, label: "الخامسة" }]} onChange={(s) => patch(sel, { pedalStep: s })} />
              </label>
            ) : null}
            <label className="rv-slider">
              <span className="rv-slider-top"><span>متى يغني</span></span>
              <select value={v.when} onChange={(e) => patch(sel, { when: e.target.value as HarmonyVoice["when"] })}>
                {WHENS.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </label>
            <Slider label="شدّ النغمة" value={v.tight} min={0} max={1} def={0.6} onChange={(x) => patch(sel, { tight: x })} />
            <Slider label="المستوى" value={v.gain} min={-24} max={0} step={0.5} unit="dB" onChange={(x) => patch(sel, { gain: x })} />
            <Slider label="الارتفاع فوق الرأس" value={v.el} min={-40} max={80} step={1} unit="°" def={0} onChange={(x) => patch(sel, { el: x })} />
            <Slider label="البعد" value={v.dist} min={0.6} max={MAXD} step={0.1} unit="m" onChange={(x) => patch(sel, { dist: x })} />
            <Slider label="حجم الحنجرة" value={v.formant} min={0.85} max={1.2} step={0.01} def={1} onChange={(x) => patch(sel, { formant: x })} />
            <Slider label="التأخر عنك" value={v.delayMs} min={0} max={90} step={1} unit="ms" onChange={(x) => patch(sel, { delayMs: x })} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
