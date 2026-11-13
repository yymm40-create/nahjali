"use client";

// «الرضا فويس» — the mixdown: the whole project (or the loop) rendered through the same mixer that is heard, brought
// to the loudness of where it is going, and saved — as WAV first (the studio's own format, always available), or
// MP3, M4A, FLAC or OGG; each track alone as stems in one zip; or the project itself as a file to carry to another
// device.

import { useEffect, useState } from "react";
import { limit, loudness, normalizeLoudness, peakDb } from "@/lib/ridha/dsp/loudness";
import { type WavDepth } from "@/lib/ridha/dsp/wav";
import { clockLabel, projectEnd, SR } from "@/lib/ridha/model";
import { canEncode, encodeAudio, formatById, FORMATS, type Format } from "../encode";
import { renderProject } from "../engine";
import { downloadBlob, exportProjectFile } from "../store";
import { useStudio } from "../ctx";
import { Btn, Empty, Seg } from "../ui";

const TARGETS = [
  { value: 0, label: "كما هو", title: "بدون تغيير في الجهارة" },
  { value: -14, label: "−14 منصات", title: "يوتيوب، سبوتيفاي، إنستقرام، تيك توك" },
  { value: -16, label: "−16 بودكاست", title: "آبل بودكاست وأغلب تطبيقات البودكاست" },
  { value: -23, label: "−23 بث", title: "معيار البث التلفزيوني EBU R128" },
];
const RATES = [
  { value: 128, label: "128 (أصغر)" },
  { value: 192, label: "192 (ممتاز)" },
  { value: 256, label: "256" },
  { value: 320, label: "320 (أعلى)" },
];

export default function ExportPanel() {
  const st = useStudio();
  const { project } = st;
  const [range, setRange] = useState<"all" | "loop">("all");
  const [format, setFormat] = useState<Format>("wav");
  const [depth, setDepth] = useState<WavDepth>(24);
  const [kbps, setKbps] = useState(192);
  const [target, setTarget] = useState(-14);
  const [mono, setMono] = useState(false);
  const [last, setLast] = useState<{ lufs: number; peak: number; seconds: number; mb: number; name: string } | null>(null);
  const [cannot, setCannot] = useState<Format[]>([]);
  // which formats this browser can actually write (asked once; WAV always can)
  useEffect(() => {
    let live = true;
    void Promise.all(FORMATS.map(async (x) => ((await canEncode(x.id, SR, 192).catch(() => false)) ? null : x.id))).then((r) => live && setCannot(r.filter((x): x is Format => !!x)));
    return () => {
      live = false;
    };
  }, []);
  const end = projectEnd(project);
  const safe = (project.name || "الرضا فويس").replace(/[\\/:*?"<>|]/g, " ").trim();
  const f = formatById(format);

  if (!project.clips.length) return <Empty icon="" title="ما في شيء للتصدير بعد">سجّل أو استورد صوتًا أولًا.</Empty>;
  const from = range === "loop" ? project.loop.start : 0;
  const to = range === "loop" ? project.loop.end : end;

  // «كما هو» leaves the mix alone unless it would clip in the file: then only the peaks are held
  const finish = (stereo: Float32Array[]) => {
    // a mono file is the two sides summed (what a phone speaker or a single-speaker hall plays)
    const chs = mono ? [stereo[0].map((v, i) => (v + stereo[1][i]) / 2)] : stereo;
    return target ? normalizeLoudness(chs, SR, target, -1).channels : peakDb(chs) > -0.1 ? limit(chs, SR, -0.1) : chs;
  };

  const mixdown = async () => {
    const res = await st.work(`تصدير ${f.name}`, async (say) => {
      say(0.1, "تشغيل الميكسر على كل المسارات");
      const mix = await renderProject(project, { from, to });
      say(0.6, "ضبط الجهارة والقمم");
      await new Promise((r) => setTimeout(r, 0));
      const out = finish(mix);
      say(0.7, `كتابة ملف ${f.name}`);
      const blob = await encodeAudio(out, SR, format, { kbps, depth, onProgress: (p) => say(0.7 + 0.3 * p) });
      return { out, blob };
    });
    if (!res) return;
    const name = `${safe}.${f.ext}`;
    setLast({ lufs: loudness(res.out, SR), peak: peakDb(res.out), seconds: res.out[0].length / SR, mb: res.blob.size / 1e6, name });
    downloadBlob(res.blob, name);
  };

  const stems = async () => {
    const zip = await st.work("تصدير المسارات منفصلة", async (say) => {
      const { default: JSZip } = await import("jszip");
      const z = new JSZip();
      const tracks = project.tracks.filter((t) => project.clips.some((c) => c.trackId === t.id));
      for (let i = 0; i < tracks.length; i++) {
        say(i / tracks.length, tracks[i].name);
        const st2 = await renderProject(project, { from, to, onlyTrack: tracks[i].id });
        // a mono track's stem is a mono file (unless its effects or its place made it stereo on purpose)
        const one = mono || (tracks[i].stereo === false && !tracks[i].space.on && tracks[i].pan === 0 && !tracks[i].fx.some((f) => f.on && ["reverb", "delay", "chorus", "width"].includes(f.kind)) && tracks[i].sendReverb === 0 && tracks[i].sendDelay === 0) ? [st2[0].map((v, k) => (v + st2[1][k]) / 2)] : st2;
        const blob = await encodeAudio(one, SR, format, { kbps, depth });
        z.file(`${String(i + 1).padStart(2, "0")} ${tracks[i].name.replace(/[\\/:*?"<>|]/g, " ")}.${f.ext}`, await blob.arrayBuffer());
      }
      say(0.97, "جمع الملفات");
      return z.generateAsync({ type: "blob", compression: "STORE" });
    });
    if (zip) downloadBlob(zip, `${safe} - مسارات.zip`);
  };

  const file = async () => {
    const blob = await st.work("حفظ ملف المشروع", () => exportProjectFile(project));
    if (blob) downloadBlob(blob, `${safe}.ridha`);
  };

  return (
    <div className="rv-export">
      <div className="rv-export-main">
        <div className="rv-panel-head"><b>تصدير المكس</b><span className="rv-muted" dir="ltr">{clockLabel(to - from, false)} · 48 kHz · {mono ? "mono" : "stereo"}</span></div>
        <div className="rv-formats">
          {FORMATS.map((x) => (
            <button key={x.id} type="button" className={`rv-card${format === x.id ? " on" : ""}`} disabled={cannot.includes(x.id)} onClick={() => setFormat(x.id)}>
              <b dir="ltr">{x.name}</b>
              <small>{cannot.includes(x.id) ? "هذا المتصفح لا يكتبها — جرّب Chrome على الكمبيوتر" : x.hint}</small>
            </button>
          ))}
        </div>
        {format === "wav" ? (
          <label className="rv-slider"><span className="rv-slider-top"><span>دقة الـ WAV</span></span>
            <Seg value={depth} options={[{ value: 16, label: "16 بت (أصغر)" }, { value: 24, label: "24 بت (استوديو)" }, { value: 32, label: "32 بت عائم (للمكس لاحقًا)" }]} onChange={(d) => setDepth(d as WavDepth)} />
          </label>
        ) : f.lossy ? (
          <label className="rv-slider"><span className="rv-slider-top"><span>الجودة (كيلوبت في الثانية)</span></span>
            <Seg value={kbps} options={RATES} onChange={setKbps} />
          </label>
        ) : null}
        <label className="rv-slider"><span className="rv-slider-top"><span>القنوات</span></span>
          <Seg value={mono ? "mono" : "stereo"} options={[{ value: "stereo", label: "ستيريو" }, { value: "mono", label: "مونو (قناة واحدة)" }]} onChange={(v) => setMono(v === "mono")} />
        </label>
        <label className="rv-slider"><span className="rv-slider-top"><span>المدى</span></span>
          <Seg value={range} options={[{ value: "all", label: "المشروع كله" }, { value: "loop", label: "منطقة التكرار فقط" }]} onChange={setRange} />
        </label>
        <label className="rv-slider"><span className="rv-slider-top"><span>الجهارة النهائية</span></span>
          <Seg value={target} options={TARGETS} onChange={setTarget} />
        </label>
        <div className="rv-row">
          <Btn kind="gold" onClick={() => void mixdown()}>صدّر {f.name}</Btn>
          {last ? <span className="rv-muted" dir="ltr">{last.name} · {last.mb.toFixed(1)} MB · {last.lufs.toFixed(1)} LUFS · {last.peak.toFixed(1)} dB peak · {clockLabel(last.seconds, false)}</span> : null}
        </div>
      </div>
      <aside className="rv-export-side">
        <div className="rv-panel-head"><b>غير ذلك</b></div>
        <Btn onClick={() => void stems()}>كل مسار في ملف (Stems)</Btn>
        <span className="rv-muted">كل مسار بمؤثراته وبالصيغة المختارة ({f.name})، لتسليمه لمونتير أو مهندس آخر.</span>
        <Btn onClick={() => void file()}>ملف المشروع (.ridha)</Btn>
        <span className="rv-muted">المشروع كاملًا بتسجيلاته، لتفتحه على جهاز ثانٍ أو تحفظ نسخة منه. مشاريعك تُحفظ تلقائيًا على هذا الجهاز فقط.</span>
      </aside>
    </div>
  );
}
