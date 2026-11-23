"use client";

// «صانع المحتوى» · «🗄️ خزان المراجع والثوابت» of a project (the owner, 23 Nov 2026): what the site fixed from the
// choices (the look, the approved pictures), what the person fixed, what they removed, their written recommendations
// and the references they liked. «محمد باقر» reads it before every answer, «حيدرا ماكس» with every slide.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api, postJson } from "@/lib/fetch";
import { probeFile, putWithProgress } from "@/components/jawad/studio/upload";

interface Ref { id: string; name: string; note: string; url?: string | null }
interface Store { approved: string[]; removed: string[]; notes: string[]; refs: Ref[] }
type ListKey = "approved" | "removed" | "notes";

const LISTS: { key: ListKey; title: string; hint: string; add: string }[] = [
  { key: "approved", title: "✅ المعتمد (ثابت)", hint: "أشياء ثبّتها وتبيها في كل الشرائح: لون، شخصية، عبارة، أسلوب.", add: "مثلًا: الشخصية دائمًا بثوب أزرق" },
  { key: "removed", title: "🚫 المشال (لا ترجع له)", hint: "أشياء ما تبيها أبدًا في المشروع.", add: "مثلًا: بدون خلفيات سوداء" },
  { key: "notes", title: "📝 توصيات مكتوبة", hint: "ملاحظاتك العامة للمشروع.", add: "مثلًا: الكتابة كبيرة وقليلة" },
];

export default function StorePanel({ chatId, onClose }: { chatId: string; onClose: () => void }) {
  const [store, setStore] = useState<Store | null>(null);
  const [look, setLook] = useState<string[]>([]);
  const [pictures, setPictures] = useState<{ n: number; url: string | null }[]>([]);
  const [drafts, setDrafts] = useState<Record<ListKey, string>>({ approved: "", removed: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const picker = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  useEffect(() => {
    let live = true;
    api<{ store: Store; look: string[]; pictures: { n: number; url: string | null }[] }>(`/api/content/store?chatId=${chatId}`)
      .then((r) => {
        if (!live) return;
        setStore(r.store);
        setLook(r.look);
        setPictures(r.pictures);
      })
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : "تعذّر فتح الخزان."));
    return () => {
      live = false;
    };
  }, [chatId]);

  async function save(next: Store) {
    setStore(next);
    setSaving(true);
    setError("");
    try {
      const r = await postJson<{ store: Store }>("/api/content/store", { chatId, store: next });
      setStore(r.store);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر الحفظ.");
    } finally {
      setSaving(false);
    }
  }

  function addLine(key: ListKey) {
    const text = drafts[key].replace(/\s+/g, " ").trim();
    if (!store || !text || store[key].includes(text)) return;
    setDrafts((d) => ({ ...d, [key]: "" }));
    void save({ ...store, [key]: [...store[key], text] });
  }

  async function addRefs(files: FileList | null) {
    if (!store || !files?.length) return;
    setUploading(true);
    setError("");
    const added: Ref[] = [];
    try {
      for (const file of Array.from(files).slice(0, Math.max(0, 12 - store.refs.length))) {
        const probe = await probeFile(file);
        if (probe.kind !== "image") throw new Error(`${file.name}: المراجع صور فقط.`);
        const signed = await postJson<{ id: string; signedUrl: string }>("/api/jawad/uploads", { kind: probe.kind, mime: probe.mime, bytes: file.size, fileName: file.name });
        await putWithProgress(signed.signedUrl, file, probe.mime, () => {});
        const conf = await postJson<{ upload: { id: string; status: string; error: string | null; url: string | null } }>("/api/jawad/uploads/confirm", { id: signed.id });
        if (conf.upload?.status !== "ready") throw new Error(conf.upload?.error ?? "تعذّر فحص الصورة.");
        added.push({ id: conf.upload.id, name: file.name.slice(0, 120), note: "", url: conf.upload.url });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر الرفع.");
    } finally {
      setUploading(false);
      if (picker.current) picker.current.value = "";
    }
    if (added.length) await save({ ...store, refs: [...store.refs, ...added] });
  }

  // a drawer on the side of the whole page (like the film maker's library), over everything
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="ct-drawer-wrap ct-store-wrap" onClick={onClose}>
      <aside className="ct-drawer ct-store" role="dialog" aria-modal="true" aria-label="خزان المراجع والثوابت" onClick={(e) => e.stopPropagation()}>
        <header className="ct-drawer-head">
          <span className="ic" aria-hidden>🗄️</span>
          <div>
            <b>خزان المراجع والثوابت</b>
            <small>خاص بهذا المشروع. محمد باقر يقراه قبل كل رد، وحيدرا ماكس مع كل شريحة.{saving ? " · يحفظ…" : ""}</small>
          </div>
          <button type="button" className="ct-tool" onClick={onClose} aria-label="سكّر">✕</button>
        </header>
        <div className="ct-drawer-body">
        {error && <p className="ct-store-err">{error}</p>}
        {!store ? (
          !error && <p className="ct-store-hint">يفتح الخزان…</p>
        ) : (
          <div className="ct-store-body">
            {(look.length > 0 || pictures.length > 0) && (
              <section>
                <h4>🔒 ثبّته الموقع من اختياراتك</h4>
                {look.length > 0 && <ul>{look.map((x) => <li key={x}>{x}</li>)}</ul>}
                {pictures.length > 0 && (
                  <>
                    <small className="ct-store-hint">الصور المعتمدة ({pictures.length}). تغييرها من محادثة «🖼️ الصور».</small>
                    <div className="ct-store-pics">{pictures.map((p) => (p.url ? <img key={p.n} src={p.url} alt={`صورة الشريحة ${p.n}`} /> : null))}</div>
                  </>
                )}
              </section>
            )}
            {LISTS.map((l) => (
              <section key={l.key}>
                <h4>{l.title}</h4>
                <small className="ct-store-hint">{l.hint}</small>
                {store[l.key].length > 0 && (
                  <ul>
                    {store[l.key].map((x) => (
                      <li key={x}>
                        <span>{x}</span>
                        <button type="button" className="ct-mini" aria-label={`احذف: ${x}`} disabled={saving} onClick={() => void save({ ...store, [l.key]: store[l.key].filter((y) => y !== x) })}>✕</button>
                      </li>
                    ))}
                  </ul>
                )}
                <form className="ct-store-add" onSubmit={(e) => { e.preventDefault(); addLine(l.key); }}>
                  <input className="ct-input" value={drafts[l.key]} onChange={(e) => setDrafts((d) => ({ ...d, [l.key]: e.target.value }))} placeholder={l.add} aria-label={l.title} maxLength={400} />
                  <button type="submit" className="ct-mini ct-go" disabled={saving || !drafts[l.key].trim()}>أضف</button>
                </form>
              </section>
            ))}
            <section>
              <h4>🖼️ مراجع عجبتك</h4>
              <small className="ct-store-hint">صور تعجبك في الشكل والإحساس: تنقرى كإلهام، وما ينسخ محتواها.</small>
              {store.refs.length > 0 && (
                <div className="ct-store-refs">
                  {store.refs.map((r) => (
                    <figure key={r.id}>
                      {r.url ? <img src={r.url} alt={r.name} /> : <span>🖼️</span>}
                      <input
                        className="ct-input"
                        defaultValue={r.note}
                        placeholder="وش عجبك فيها؟"
                        aria-label={`وش عجبك في ${r.name}`}
                        maxLength={400}
                        onBlur={(e) => {
                          const note = e.target.value.trim();
                          if (note !== r.note) void save({ ...store, refs: store.refs.map((x) => (x.id === r.id ? { ...x, note } : x)) });
                        }}
                      />
                      <button type="button" className="ct-mini" aria-label={`احذف المرجع ${r.name}`} disabled={saving} onClick={() => void save({ ...store, refs: store.refs.filter((x) => x.id !== r.id) })}>✕</button>
                    </figure>
                  ))}
                </div>
              )}
              <input ref={picker} type="file" hidden multiple accept="image/png,image/jpeg,image/webp" onChange={(e) => void addRefs(e.target.files)} />
              <button type="button" className="ct-mini" disabled={uploading || store.refs.length >= 12} onClick={() => picker.current?.click()}>{uploading ? "يرفع…" : "＋ أضف صورة مرجع"}</button>
            </section>
          </div>
        )}
        </div>
      </aside>
    </div>,
    document.body,
  );
}
