"use client";

// «زهراء فوتو ماستر» — the front page: start from a picture, from a blank canvas of a platform's size, or from a design of
// «كاظم»; and the person's projects.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { PHOTO, SIZE_PRESETS } from "@config/photo";
import { postJson } from "@/lib/fetch";
import { uploadImage } from "@/components/jawad/studio/upload";

export interface ProjectItem {
  id: string;
  title: string;
  from: string | null;
  updatedAt: string;
}

const FROM_LABEL: Record<string, string> = { designer: "من كاظم", upload: "صورة مرفوعة", work: "من أعمالي", blank: "لوحة" };

export default function PhotoHome({ projects: initial, persona, canDesigner }: { projects: ProjectItem[]; persona: string; canDesigner: boolean }) {
  const router = useRouter();
  const [projects, setProjects] = useState(initial);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [preset, setPreset] = useState("ig_post");
  const [bg, setBg] = useState("#FFFFFF");
  const picker = useRef<HTMLInputElement>(null);

  async function open(body: Record<string, unknown>) {
    setError("");
    try {
      const r = await postJson<{ id: string }>("/api/photo/projects", body);
      router.push(`${PHOTO.base}/${r.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy("");
    }
  }
  async function fromFile(file: File | undefined) {
    if (!file) return;
    setBusy("أرفع الصورة…");
    try {
      const up = await uploadImage(file);
      setBusy("أفتح المشروع…");
      await open({ from: "upload", uploadId: up.id });
    } catch (e) {
      setError((e as Error).message);
      setBusy("");
    }
  }
  async function remove(id: string) {
    if (!window.confirm("نحذف هذا المشروع وصوره؟")) return;
    const res = await fetch(`/api/photo/projects?id=${id}`, { method: "DELETE" });
    if (res.ok) setProjects((p) => p.filter((x) => x.id !== id));
  }
  const size = SIZE_PRESETS.find((s) => s.id === preset) ?? SIZE_PRESETS[0];

  return (
    <div className="ph-home" dir="rtl">
      <header>
        <h1>📸 {PHOTO.name}</h1>
        <p className="sub">برنامج تحرير الصور والتصميم. {persona} تعدّل معك بالكلام: ألوان، قص، مقاسات، نصوص عربية، قص خلفية. وتنتقل التصاميم بينها وبين كاظم بذهاب وعودة.</p>
      </header>
      {error && <p className="ph-error" role="alert">{error}</p>}
      {busy && <p className="ph-loading">⏳ {busy}</p>}

      <section className="ph-start">
        <div className="ph-card">
          <h3>📷 افتح صورة</h3>
          <p>من جوالك أو جهازك، وتبدأ التحرير مباشرة.</p>
          <button type="button" className="ph-btn ph-primary" disabled={!!busy} onClick={() => picker.current?.click()}>اختر صورة</button>
          <input ref={picker} type="file" accept="image/*" hidden onChange={(e) => { void fromFile(e.target.files?.[0]); e.target.value = ""; }} />
        </div>
        <div className="ph-card">
          <h3>🎨 لوحة فاضية</h3>
          <p>ابدأ من الصفر بمقاس المنصة اللي تبيها.</p>
          <select className="ph-input" value={preset} onChange={(e) => setPreset(e.target.value)} aria-label="المقاس">
            {SIZE_PRESETS.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.w}×{s.h}</option>)}
          </select>
          <label className="ph-color">اللون<input type="color" value={bg} onChange={(e) => setBg(e.target.value)} /></label>
          <button type="button" className="ph-btn" disabled={!!busy} onClick={() => { setBusy("أجهّز اللوحة…"); void open({ from: "blank", width: size.w, height: size.h, bg }); }}>أنشئ اللوحة</button>
        </div>
        {canDesigner && (
          <div className="ph-card">
            <h3>🪄 من كاظم</h3>
            <p>افتح محادثتك مع كاظم، وبعد ما يجهّز التصميم اضغط «عدّل في زهراء». وتقدر ترجّعه له بعد التعديل.</p>
            <Link href="/jawad-ai/designer" className="ph-btn">افتح المصمم الذكي</Link>
          </div>
        )}
      </section>

      <section>
        <h2 style={{ fontSize: 18, margin: "0 0 10px" }}>مشاريعي</h2>
        {projects.length ? (
          <ul className="ph-projects">
            {projects.map((p) => (
              <li key={p.id}>
                <Link href={`${PHOTO.base}/${p.id}`}>{p.title}</Link>
                <small>{p.from ? FROM_LABEL[p.from] ?? "" : ""}</small>
                <small>{new Date(p.updatedAt).toLocaleDateString("ar-SA-u-ca-gregory")}</small>
                <button type="button" className="ph-btn" aria-label={`احذف ${p.title}`} onClick={() => void remove(p.id)}>🗑️</button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="ph-hint">ما عندك مشاريع بعد. ابدأ بصورة أو لوحة.</p>
        )}
      </section>
    </div>
  );
}
