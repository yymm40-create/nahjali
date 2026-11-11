"use client";

// «المصمم الذكي كاظم» — دعوة مجلس من تصميم جاهز: كم خطيب وكم رادود ← التصاميم اللي تناسب ← البيانات والصور ← مين يسويه
// (حيدرا ماكس بالكود نفس التصميم بالضبط، أو GPT Image 2.6 Sunburst / Flare، أو GPT Image 2 مع تنبيه الملامح).

import { useMemo, useRef, useState } from "react";
import { postJson } from "@/lib/fetch";
import { probeFile, putWithProgress } from "@/components/jawad/studio/upload";
import { MAJLIS, MAJLIS_BG, MAJLIS_FIELDS, MAJLIS_MAKERS, ROLE_LABEL, templatesFor, viewUrl, type MajlisFieldKey, type MajlisMaker, type MajlisOrder, type MajlisTemplate } from "@config/designer-majlis";

type Photo = { id: string; url: string | null } | null;
export type MajlisDone = { chatId: string; mode: "code" | "gpt"; design?: unknown };

async function upload(file: File): Promise<{ id: string; url: string | null }> {
  const probe = await probeFile(file, "image");
  const signed = await postJson<{ id: string; signedUrl: string }>("/api/jawad/uploads", { kind: probe.kind, mime: probe.mime, bytes: file.size, fileName: file.name });
  await putWithProgress(signed.signedUrl, file, probe.mime, () => {});
  const conf = await postJson<{ upload: { id: string; status: string; error: string | null; url: string | null } }>("/api/jawad/uploads/confirm", { id: signed.id });
  if (conf.upload?.status !== "ready") throw new Error(conf.upload?.error ?? "تعذّر فحص الصورة.");
  return { id: conf.upload.id, url: conf.upload.url };
}

function Stepper({ label, value, set }: { label: string; value: number; set: (n: number) => void }) {
  return (
    <div className="mj-step">
      <span>{label}</span>
      <div className="mj-step-ctl">
        <button type="button" onClick={() => set(Math.min(4, value + 1))} aria-label={`زِد ${label}`}>+</button>
        <b>{value.toLocaleString("ar-EG")}</b>
        <button type="button" onClick={() => set(Math.max(0, value - 1))} aria-label={`نقّص ${label}`}>−</button>
      </div>
    </div>
  );
}

export default function MajlisPicker({ chatId, onDone, onClose }: { chatId: string | null; onDone: (r: MajlisDone) => void; onClose: () => void }) {
  const [stage, setStage] = useState<"count" | "pick" | "fill">("count");
  const [kh, setKh] = useState(1);
  const [rd, setRd] = useState(1);
  const [tpl, setTpl] = useState<MajlisTemplate | null>(null);
  const [fields, setFields] = useState<Partial<Record<MajlisFieldKey, string>>>({});
  const [names, setNames] = useState<string[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [logo, setLogo] = useState<Photo>(null);
  const [maker, setMaker] = useState<MajlisMaker>("code");
  // the person's own choice, always asked: remove the photos' background, or keep it
  const [cut, setCut] = useState<boolean | null>(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const total = kh + rd;
  const list = useMemo(() => templatesFor(kh, rd), [kh, rd]);
  // the people in the order of the frames: the khateebs first (the bigger frame), then the radoods
  const roles = useMemo(() => [...Array(kh).fill("kh"), ...Array(rd).fill("rd")] as ("kh" | "rd")[], [kh, rd]);
  const files = useRef<(HTMLInputElement | null)[]>([]);
  const logoFile = useRef<HTMLInputElement>(null);

  async function pickPhoto(i: number, f: File | undefined) {
    if (!f) return;
    setBusy(`أرفع الصورة ${i + 1}…`);
    setErr("");
    try {
      const p = await upload(f);
      setPhotos((a) => { const c = [...a]; c[i] = p; return c; });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "تعذّر رفع الصورة.");
    } finally {
      setBusy("");
    }
  }
  async function pickLogo(f: File | undefined) {
    if (!f) return;
    setBusy("أرفع الشعار…");
    try { setLogo(await upload(f)); } catch (e) { setErr(e instanceof Error ? e.message : "تعذّر رفع الشعار."); } finally { setBusy(""); }
  }

  async function submit() {
    if (!tpl) return;
    if (cut === null) { setErr("اختر: تفرّغ خلفية الصور أو تخليها بخلفيتها."); return; }
    const order: MajlisOrder = { templateId: tpl.id, fields, people: roles.map((role, i) => ({ role, name: (names[i] ?? "").trim(), photo: photos[i]?.id ?? "" })), cut, ...(logo ? { logo: logo.id } : {}) };
    setErr("");
    setBusy(maker === "code" ? "أرسل الطلب لحيدرا ماكس…" : "جواد يسوي التصميم (دقيقة إلى دقيقتين)…");
    try {
      const r = await postJson<MajlisDone>("/api/designer/majlis", { chatId, order, maker });
      onDone(r);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "تعذّر الطلب.");
    } finally {
      setBusy("");
    }
  }

  const warn = MAJLIS_MAKERS.find((m) => m.id === maker)?.warn;
  return (
    <div className="mj">
      <div className="mj-head">
        <b>🕯️ دعوة مجلس من تصميم جاهز</b>
        <button type="button" className="dz-mini" onClick={onClose}>✕ إغلاق</button>
      </div>

      {stage === "count" && (
        <div className="mj-body">
          <p>كم خطيب وكم رادود بيكونون في الدعوة؟</p>
          <Stepper label="الخطباء" value={kh} set={setKh} />
          <Stepper label="الرواديد" value={rd} set={setRd} />
          {total > MAJLIS.maxPeople && <p className="mj-note">التصاميم الحالية تتسع لشخصين بالكثير؛ المربعات الزيادة قريبًا إن شاء الله.</p>}
          {total === 1 && !list.length && <p className="mj-note">ما فيه تصاميم لشخص واحد حاليًا. اختر شخصين.</p>}
          <button type="button" className="dz-send" disabled={!list.length} onClick={() => setStage("pick")}>اعرض التصاميم المناسبة ({list.length.toLocaleString("ar-EG")})</button>
        </div>
      )}

      {stage === "pick" && (
        <div className="mj-body">
          <p>اختر التصميم اللي يعجبك:</p>
          <div className="mj-grid">
            {list.map((t) => (
              <button type="button" key={t.id} className={`mj-card ${tpl?.id === t.id ? "on" : ""}`} onClick={() => setTpl(t)} title={t.title}>
                <img src={viewUrl(t.id)} alt={t.title} loading="lazy" />
                <span>{t.kind === "people" ? "بأشخاص · " : ""}{t.id.slice(1)} · {t.title}</span>
              </button>
            ))}
          </div>
          <div className="mj-row">
            <button type="button" className="dz-mini" onClick={() => setStage("count")}>→ رجوع</button>
            <button type="button" className="dz-send" disabled={!tpl} onClick={() => setStage("fill")}>التالي: البيانات</button>
          </div>
        </div>
      )}

      {stage === "fill" && tpl && (
        <div className="mj-body">
          <div className="mj-chosen"><img src={viewUrl(tpl.id)} alt="" /><span>التصميم {tpl.id.slice(1)} «{tpl.title}»</span></div>
          {roles.map((role, i) => (
            <div key={i} className="mj-person">
              <label>{ROLE_LABEL[role]} {roles.filter((r) => r === role).length > 1 ? (roles.slice(0, i + 1).filter((r) => r === role).length).toLocaleString("ar-EG") : ""}
                <input value={names[i] ?? ""} placeholder={role === "kh" ? "الشيخ حسن الكاظمي" : "الملا علي الحسيني"} onChange={(e) => setNames((a) => { const c = [...a]; c[i] = e.target.value; return c; })} />
              </label>
              <input ref={(el) => { files.current[i] = el; }} type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={(e) => void pickPhoto(i, e.target.files?.[0])} />
              <button type="button" className="mj-photo" onClick={() => files.current[i]?.click()}>{photos[i]?.url ? <img src={photos[i]!.url!} alt="" /> : "📷 صورته"}</button>
            </div>
          ))}
          <div className="mj-fields">
            {MAJLIS_FIELDS.map((d) => (
              <label key={d.key}>{d.label}{"required" in d && d.required ? " *" : ""}
                <input value={fields[d.key] ?? ""} placeholder={d.placeholder} onChange={(e) => setFields((f) => ({ ...f, [d.key]: e.target.value }))} />
              </label>
            ))}
          </div>
          {tpl.logo && (
            <div className="mj-row">
              <input ref={logoFile} type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={(e) => void pickLogo(e.target.files?.[0])} />
              <button type="button" className="dz-mini" onClick={() => logoFile.current?.click()}>{logo ? "✓ الشعار مرفوع" : "＋ شعار المأتم (اختياري)"}</button>
            </div>
          )}
          <p>صور الأشخاص: تبي نفرّغ الخلفية أو نخليها بخلفيتها؟</p>
          <div className="mj-makers">
            {MAJLIS_BG.map((b) => (
              <button type="button" key={String(b.cut)} className={`mj-maker ${cut === b.cut ? "on" : ""}`} onClick={() => setCut(b.cut)}>
                <b>{b.name}</b><span>{b.hint}</span>
              </button>
            ))}
          </div>
          <p>مين يسوي التصميم؟</p>
          <div className="mj-makers">
            {MAJLIS_MAKERS.map((m) => (
              <button type="button" key={m.id} className={`mj-maker ${maker === m.id ? "on" : ""}`} onClick={() => setMaker(m.id)}>
                <b>{m.name}</b>{m.hint && <span>{m.hint}</span>}
              </button>
            ))}
          </div>
          {warn && <p className="mj-warn">{warn}</p>}
          <div className="mj-row">
            <button type="button" className="dz-mini" onClick={() => setStage("pick")}>→ غيّر التصميم</button>
            <button type="button" className="dz-send" disabled={!!busy} onClick={() => void submit()}>{busy ? "…" : "سوّ تصميمي"}</button>
          </div>
        </div>
      )}
      {busy && <p className="mj-note" role="status">{busy}</p>}
      {err && <p className="mj-warn" role="alert">{err}</p>}
    </div>
  );
}
