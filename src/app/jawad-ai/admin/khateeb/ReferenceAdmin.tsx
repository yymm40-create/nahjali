"use client";

// «الخطيب الذكي» · مرجع الأشعار: the owner uploads a scanned PDF of any number of pages (it goes straight to storage, not through
// the chat), the site reads it page by page while this page stays open (it can be left and continued), and a page can be opened
// and corrected. The sermon then takes lines from it with their page numbers.

import { useCallback, useEffect, useRef, useState } from "react";
import { putWithProgress } from "@/components/jawad/studio/upload";
import { api, postJson } from "@/lib/fetch";

interface Ref {
  id: string;
  title: string;
  kind: "poetry" | "source";
  origin: string;
  pages: number;
  done: number;
  status: "uploading" | "reading" | "ready" | "failed";
  error: string;
  usd: number;
}

const STATUS: Record<Ref["status"], string> = { uploading: "ما اكتمل الرفع", reading: "يُقرأ", ready: "جاهز", failed: "فشل" };
const KIND: Record<Ref["kind"], string> = { poetry: "أشعار", source: "مصدر (قصص وحكم وعبر…)" };

export default function ReferenceAdmin() {
  const [refs, setRefs] = useState<Ref[] | null>(null);
  const [ready, setReady] = useState(true);
  const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(null);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<Ref["kind"]>("poetry");
  const [link, setLink] = useState("");
  const [importing, setImporting] = useState(false);
  const [up, setUp] = useState<number | null>(null);
  const [driving, setDriving] = useState<string | null>(null);
  const stop = useRef(false);
  const file = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<{ id: string; page: string; text: string; label: string; found: boolean } | null>(null);

  const load = useCallback(async () => {
    const r = await api<{ refs: Ref[]; ready: boolean }>("/api/khateeb/reference").catch(() => null);
    if (r) {
      setRefs(r.refs);
      setReady(r.ready);
    }
  }, []);
  useEffect(() => {
    let live = true;
    api<{ refs: Ref[]; ready: boolean }>("/api/khateeb/reference")
      .then((r) => {
        if (!live) return;
        setRefs(r.refs);
        setReady(r.ready);
      })
      .catch(() => null);
    return () => {
      live = false;
    };
  }, []);

  const put = (r: Ref) => setRefs((l) => (l ?? []).map((x) => (x.id === r.id ? r : x)));

  // reads the next pages again and again until the reference is ready (or it is stopped, or a step failed)
  const drive = useCallback(async (id: string) => {
    if (driving) return;
    setDriving(id);
    stop.current = false;
    try {
      for (;;) {
        const r = (await postJson<{ ref: Ref }>("/api/khateeb/reference", { action: "step", id })).ref;
        put(r);
        if (r.status !== "reading" || r.error || stop.current) break;
      }
    } catch (e) {
      setMsg({ t: e instanceof Error ? e.message : "تعذّرت القراءة.", bad: true });
    } finally {
      setDriving(null);
    }
  }, [driving]);

  const upload = async (f: File) => {
    setMsg(null);
    try {
      const s = await postJson<{ id: string; signedUrl: string }>("/api/khateeb/reference", { action: "start", title: title.trim() || f.name.replace(/\.pdf$/i, ""), bytes: f.size, kind });
      await putWithProgress(s.signedUrl, f, "application/pdf", (x) => setUp(x));
      setUp(null);
      const r = (await postJson<{ ref: Ref }>("/api/khateeb/reference", { action: "confirm", id: s.id })).ref;
      setRefs((l) => [r, ...(l ?? [])]);
      setTitle("");
      void drive(r.id);
    } catch (e) {
      setUp(null);
      setMsg({ t: e instanceof Error ? e.message : "تعذّر الرفع.", bad: true });
    } finally {
      if (file.current) file.current.value = "";
    }
  };

  const importBook = async () => {
    setMsg(null);
    setImporting(true);
    try {
      const r = (await postJson<{ ref: Ref }>("/api/khateeb/reference", { action: "import", input: link, title: title.trim(), kind: "source" })).ref;
      setRefs((l) => [r, ...(l ?? [])]);
      setLink("");
      setTitle("");
      setMsg({ t: `انضاف «${r.title}» (${r.pages.toLocaleString("ar")} صفحة) وهو جاهز، ما احتاج قراءة ولا تكلفة.` });
    } catch (e) {
      setMsg({ t: e instanceof Error ? e.message : "تعذّر الاستيراد.", bad: true });
    } finally {
      setImporting(false);
    }
  };

  const open = async (id: string, page: string) => {
    setMsg(null);
    try {
      const r = await postJson<{ page: { text: string; label: string } }>("/api/khateeb/reference", { action: "page", id, page: Number(page) });
      setView({ id, page, text: r.page.text, label: r.page.label, found: true });
    } catch (e) {
      setMsg({ t: e instanceof Error ? e.message : "ما لقينا الصفحة.", bad: true });
    }
  };

  return (
    <section className="jw-panel space-y-3 p-4">
      <h2 className="font-semibold">📚 مكتبة المراجع (أشعار ومصادر)</h2>
      <p className="text-sm text-jw-muted">
        المراجع نوعان: <b>أشعار</b> (يستخرج منها الشيخ أبياتًا) و<b>مصادر</b> (قصص وحكم وعبر، مثل «من شواهد المبلغين»: يستخرج منها الشيخ ما يخدم الخطبة). الخطيب يختار منها وقت الخطبة. ارفع المرجع (PDF مصوّر) كاملًا بأي عدد صفحات: يرتفع للموقع مباشرة (مو عن طريق المحادثة)، ويقرأه الشيخ صفحة صفحة (كل ٣ صفحات مع بعض) ويحفظ نص كل صفحة ورقمها. وقت الخطبة يطلب منه أبياتًا عن موضوعها فيستخرجها من المرجع بنصها ورقم صفحتها. القراءة تكلّف حسب الصفحات (على حساب المنصة)، وتقدر تسكّر الصفحة وترجع وتكمّل.
      </p>
      {msg && <p className={`rounded-lg p-3 text-sm font-bold ${msg.bad ? "bg-jw-danger/10 text-jw-danger" : "bg-jw-ok/10 text-jw-ok"}`} role="status">{msg.t}</p>}
      {!ready && <p className="rounded-lg border border-jw-warn/40 bg-jw-warn/10 p-3 text-sm">شغّل ملف <span dir="ltr">supabase/migrations/0067_khateeb_reference.sql</span> في Supabase أول.</p>}
      <div className="space-y-2 rounded-lg border border-jw-line p-3">
        <p className="text-sm font-bold">🌐 مصدر جاهز من شبكة الإمامين الحسنين (بدون رفع ولا قراءة ولا تكلفة)</p>
        <p className="text-xs text-jw-muted">الصق رابط الكتاب من alhassanain.org أو رقمه (مثل «من شواهد المبلغين»: ٣٤٣)، ويدخل بنصه ورقم كل صفحة.</p>
        <div className="flex flex-wrap items-end gap-2">
          <input className="jw-input min-w-0 flex-1" dir="ltr" value={link} onChange={(e) => setLink(e.target.value)} placeholder="343 أو http://alhassanain.org/arabic/?com=book&id=343" aria-label="رابط الكتاب أو رقمه" />
          <button type="button" className="jw-btn jw-btn-primary" disabled={!ready || importing || !link.trim()} onClick={() => void importBook()}>{importing ? "يستورد…" : "استورد الكتاب"}</button>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="space-y-1 text-xs text-jw-muted">نوع المرجع
          <select className="jw-input" value={kind} onChange={(e) => setKind(e.target.value as Ref["kind"])} aria-label="نوع المرجع">
            <option value="poetry">أشعار</option>
            <option value="source">مصدر (قصص وحكم وعبر…)</option>
          </select>
        </label>
        <label className="space-y-1 text-xs text-jw-muted">اسم المرجع
          <input className="jw-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: ديوان …" />
        </label>
        <input ref={file} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
        <button type="button" className="jw-btn jw-btn-primary" disabled={!ready || up !== null || driving !== null} onClick={() => file.current?.click()}>
          {up !== null ? `يرفع… ${Math.round(up * 100)}٪` : "📤 ارفع ملف PDF"}
        </button>
      </div>

      {(refs ?? []).length === 0 && refs !== null && <p className="text-sm text-jw-muted">ما فيه مرجع للحين.</p>}
      <ul className="space-y-3">
        {(refs ?? []).map((r) => (
          <li key={r.id} className="rounded-lg border border-jw-line p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <b>{r.title} <span className="jw-chip text-xs font-normal">{KIND[r.kind]}</span></b>
              <span className="jw-chip text-xs">{STATUS[r.status]}{r.pages ? ` · ${r.done.toLocaleString("ar")} من ${r.pages.toLocaleString("ar")} صفحة` : ""}</span>
            </div>
            {r.pages > 0 && <progress className="my-2 h-2 w-full" value={r.done} max={r.pages} />}
            {r.error && <p className="font-bold text-jw-danger">{r.error}</p>}
            <p className="text-xs text-jw-faint">التكلفة حتى الآن: {r.usd.toFixed(2)} دولار</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {r.status === "reading" && (driving === r.id ? <button type="button" className="jw-btn" onClick={() => (stop.current = true)}>⏸ أوقف</button> : <button type="button" className="jw-btn jw-btn-primary" disabled={driving !== null} onClick={() => void drive(r.id)}>▶ كمّل القراءة</button>)}
              {r.done > 0 && (
                <form className="flex items-center gap-1" onSubmit={(e) => { e.preventDefault(); const p = String(new FormData(e.currentTarget).get("p") ?? ""); if (p) void open(r.id, p); }}>
                  <input name="p" className="jw-input !w-24" inputMode="numeric" placeholder="رقم صفحة" aria-label="رقم صفحة" />
                  <button type="submit" className="jw-btn">افتح نصها</button>
                </form>
              )}
              <button type="button" className="jw-btn !text-jw-danger" disabled={driving === r.id} onClick={async () => { if (!confirm("حذف المرجع وكل نصوصه؟")) return; await postJson("/api/khateeb/reference", { action: "delete", id: r.id }).catch(() => null); void load(); }}>حذف</button>
            </div>
          </li>
        ))}
      </ul>

      {view && (
        <div className="space-y-2 rounded-lg border border-jw-line p-3">
          <p className="text-sm font-bold">صفحة {view.page} من الملف · الرقم المطبوع: {view.label || "—"}</p>
          <textarea className="jw-textarea" rows={14} value={view.text} onChange={(e) => setView({ ...view, text: e.target.value })} aria-label="نص الصفحة" />
          <div className="flex gap-2">
            <button type="button" className="jw-btn jw-btn-primary" onClick={async () => { await postJson("/api/khateeb/reference", { action: "save_page", id: view.id, page: Number(view.page), text: view.text }).then(() => setMsg({ t: "انحفظ تصحيحك." })).catch((e) => setMsg({ t: e instanceof Error ? e.message : "تعذّر الحفظ", bad: true })); }}>احفظ التصحيح</button>
            <button type="button" className="jw-btn" onClick={() => setView(null)}>أغلق</button>
          </div>
        </div>
      )}
    </section>
  );
}
