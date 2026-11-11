"use client";

// «الرضا فويس» — the conversation with «الرضا ماكس», the studio's sound engineer. With each message the page sends
// him the studio written out (and the measurements of the selected clip, taken here first); his commands come back,
// are checked and applied as one undo step, the clip work he asked for runs on the device, and what was done is
// listed under his reply. The conversation is kept on this device with the project.

import { useEffect, useRef, useState } from "react";
import Coined from "@/components/Coined";
import { useClaudeModel } from "@/components/robots/claude-model";
import { postJson } from "@/lib/fetch";
import { applyActions, describeStudio, readActions, type ClipJob } from "@/lib/ridha/actions";
import { advise } from "@/lib/ridha/advise";
import { cleanVoice } from "@/lib/ridha/dsp/clean";
import { listenTo, type Listening } from "@/lib/ridha/dsp/listen";
import { normalizeLoudness } from "@/lib/ridha/dsp/loudness";
import { psolaShift } from "@/lib/ridha/dsp/psola";
import { scaleById } from "@/lib/ridha/dsp/scales";
import { planTune } from "@/lib/ridha/dsp/tune";
import { SR, type Clip } from "@/lib/ridha/model";
import { clipOf } from "@/lib/ridha/ops";
import { coinStr } from "@config/coins";
import { RIDHA_MAX } from "@config/ridha-max";
import { hear } from "../analysis";
import { useStudio } from "../ctx";
import { Btn } from "../ui";

interface Msg {
  role: "user" | "assistant";
  text: string;
  done?: string[];
  skipped?: string[];
  coins?: number;
  suggestions?: string[];
  error?: boolean;
}

const STARTERS = ["نظّف المقطع المحدد وجهّزه للبودكاست", "اضبط إكولايزر صوتي على هذا المسار", "جهّز المسار كصوت رادود عزاء", "ليش الصوت مكتوم؟ شوف القياسات", "اضبط الكورال خلف الصوت الرئيسي"];
const measured = new Map<string, Listening>();
const keyOf = (c: Clip) => `${c.assetId}:${c.offset.toFixed(3)}:${c.dur.toFixed(3)}`;
const load = (id: string): Msg[] => {
  try {
    const v = JSON.parse(localStorage.getItem(`ridha:chat:${id}`) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

export default function MaxPanel() {
  const st = useStudio();
  const { project, store, clip } = st;
  const [claude] = useClaudeModel();
  const [msgs, setMsgs] = useState<Msg[]>(() => load(project.id));
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(`ridha:chat:${project.id}`, JSON.stringify(msgs.slice(-60)));
    } catch {}
    end.current?.scrollIntoView({ block: "end" });
  }, [msgs, project.id]);

  /** The clip work he asked for, run here on the selected clip, in order. */
  const runJobs = async (jobs: ClipJob[], clipId: string | null, heard: Listening | null): Promise<string[]> => {
    const did: string[] = [];
    for (const job of jobs) {
      const c = clipId ? clipOf(store.get(), clipId) : null;
      const sound = c ? st.clipSound(c) : null;
      if (!c || !sound) {
        did.push("ما في مقطع محدد لتنفيذ العمل عليه");
        break;
      }
      if (job.do === "clean") {
        const m = heard ?? (await listenTo(sound, SR));
        const adv = advise(m, job.use);
        const o = { ...adv.clean, ...job.options };
        const out = await st.work("الرضا ماكس ينظّف المقطع", async (say) => {
          const res: Float32Array[] = [];
          for (let ch = 0; ch < sound.length; ch++) res.push((await cleanVoice(sound[ch], SR, o, (p, what) => say((ch + p) / sound.length, what))).out);
          return normalizeLoudness(res, SR, job.level ?? adv.level).channels;
        });
        if (out) {
          st.applyToClip(c, out, "تنظيف (الرضا ماكس)");
          did.push(`تنظيف المقطع (ضجيج ${Math.round(o.noise * 100)}٪${o.hum ? "، طنين" : ""}${o.deEss ? "، سين" : ""}${o.reverb ? "، صدى غرفة" : ""}${o.gate ? "، فراغات" : ""}) وضبطه على ${job.level ?? adv.level} LUFS`);
        }
      } else if (job.do === "tune") {
        const key = store.get().key;
        if (!key) {
          did.push("الأوتوتيون يحتاج نغمة المشروع: اكتشفها من لوحة «الأوتوتيون والنغمة» أولًا");
          continue;
        }
        const out = await st.work("الرضا ماكس يضبط النغمة", async (say) => {
          const base = await hear(c, sound, (p) => say(p * 0.8, "تتبّع النغمة"));
          const plan = planTune(base.track, { tonic: key.tonic, scale: scaleById(key.scale), strength: job.strength, speedMs: job.speedMs, transpose: job.transpose });
          return sound.map((ch) => psolaShift(ch, base.track, (f) => plan.ratio[f], 1, base.marks));
        });
        if (out) {
          st.applyToClip(c, out, "أوتوتيون (الرضا ماكس)");
          did.push(`أوتوتيون بقوة ${Math.round(job.strength * 100)}٪`);
        }
      } else {
        st.applyToClip(c, normalizeLoudness(sound, SR, job.lufs).channels, `جهارة ${job.lufs} LUFS`);
        did.push(`ضبط جهارة المقطع على ${job.lufs} LUFS`);
      }
    }
    return did;
  };

  const send = async (message: string) => {
    const said = message.trim();
    if (!said || busy) return;
    setBusy(true);
    setText("");
    const before = msgs;
    setMsgs([...before, { role: "user", text: said }]);
    try {
      // he reads measurements: the selected clip is measured first (once; kept while the studio is open)
      let heard: Listening | null = null;
      const sound = clip ? st.clipSound(clip) : null;
      if (clip && sound) {
        heard = measured.get(keyOf(clip)) ?? null;
        if (!heard) {
          heard = await st.work("قياس المقطع للرضا ماكس", async (say) => {
            say(0.3, "ضجيج، غرفة، نغمة، توازن");
            return listenTo(sound, SR);
          });
          if (heard) measured.set(keyOf(clip), heard);
        }
      }
      const state = describeStudio(store.get(), st.selTrack, clip, heard);
      const turns = before.filter((m) => !m.error).slice(-RIDHA_MAX.historyTurns).map((m) => ({ role: m.role, text: m.text }));
      const r = await postJson<{ reply: string; actions: string[]; suggestions: string[]; coins: number }>("/api/jawad/ridha/chat", { message: said, state, turns, model: claude.id });
      const res = applyActions(store.get(), readActions(r.actions), st.selTrack);
      if (res.project !== store.get()) store.set(res.project);
      const jobsDone = await runJobs(res.jobs, clip?.id ?? null, heard);
      setMsgs((m) => [...m, { role: "assistant", text: r.reply, done: [...res.done, ...jobsDone], skipped: res.skipped, coins: r.coins, suggestions: r.suggestions }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", text: e instanceof Error ? e.message : "تعذّر الرد.", error: true }]);
      setText(said);
    } finally {
      setBusy(false);
    }
  };

  const last = msgs[msgs.length - 1];
  return (
    <div className="rv-max">
      <div className="rv-max-log">
        {!msgs.length ? (
          <div className="rv-max-hello">
            <b>الرضا ماكس — مهندس الصوت</b>
            <p>اكتب له وش تبي، وهو يضبط الاستوديو بنفسه: ينظّف المقطع المحدد، يركّب الإكولايزر والكمبريسور، يضبط الريفيرب والمستويات — وكل تغيير يرجع بـ ⌘Z. يقرأ قياسات المقطع المحدد (ما يسمع). الاستوديو كله مجاني؛ المحادثة معه فقط من رصيدك.</p>
            <div className="rv-pills">{STARTERS.map((s) => <button key={s} type="button" onClick={() => void send(s)}>{s}</button>)}</div>
          </div>
        ) : null}
        {msgs.map((m, i) => (
          <div key={i} className={`rv-max-msg ${m.role}${m.error ? " error" : ""}`}>
            <p>{m.text}</p>
            {m.done?.length ? <ul className="rv-max-done">{m.done.map((d, k) => <li key={k}>{d}</li>)}</ul> : null}
            {m.skipped?.length ? <ul className="rv-max-skip">{m.skipped.map((d, k) => <li key={k}>{d}</li>)}</ul> : null}
            {m.coins ? <small className="rv-muted"><Coined text={coinStr(m.coins)} size={11} /></small> : null}
          </div>
        ))}
        {busy ? <div className="rv-max-msg assistant"><p className="rv-muted">يقرأ القياسات ويقرر…</p></div> : null}
        <div ref={end} />
      </div>
      {last?.role === "assistant" && last.suggestions?.length && !busy ? (
        <div className="rv-pills">{last.suggestions.map((s) => <button key={s} type="button" onClick={() => void send(s)}>{s}</button>)}</div>
      ) : null}
      <form className="rv-max-form" onSubmit={(e) => {
        e.preventDefault();
        void send(text);
      }}>
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={RIDHA_MAX.messageMax} placeholder={clip ? `اكتب للرضا ماكس… (المقطع المحدد: ${clip.name})` : "اكتب للرضا ماكس… (اختر مقطعًا ليقرأ قياساته)"} aria-label="رسالة للرضا ماكس" />
        <Btn kind="main" disabled={busy || !text.trim()} onClick={() => void send(text)}>أرسل</Btn>
        {msgs.length ? <Btn kind="ghost" onClick={() => setMsgs([])} title="مسح المحادثة من هذا الجهاز">مسح</Btn> : null}
      </form>
    </div>
  );
}
