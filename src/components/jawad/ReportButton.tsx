"use client";

// «بلّغ عن مشكلة» — the owner's button at the top of JAWAD AI: it keeps a short log of what went wrong on the page
// (script errors, failed requests with the server's words), and when pressed gathers it with the page's address, a
// screenshot of the screen (or a picture the owner attaches), a written note and a voice note (written out by
// Scribe), then hands it over as ONE text to paste here in the conversation (+ the picture, copied or saved).
// Owner only (the header shows it only to the owner).

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type Entry = { t: string; kind: string; text: string };
const MAX = 30;
const log: Entry[] = [];
const push = (kind: string, text: string) => {
  log.push({ t: new Date().toISOString().slice(11, 19), kind, text: text.replace(/\s+/g, " ").slice(0, 600) });
  if (log.length > MAX) log.shift();
};

export default function ReportButton() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [shot, setShot] = useState<Blob | null>(null);
  const [shotUrl, setShotUrl] = useState<string | null>(null);
  const [rec, setRec] = useState<"" | "on" | "busy">("");
  const [msg, setMsg] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const picker = useRef<HTMLInputElement>(null);

  // the log of what goes wrong, from the moment the page opens
  useEffect(() => {
    const onError = (e: ErrorEvent) => push("خطأ في الصفحة", `${e.message} (${e.filename?.split("/").pop() ?? ""}:${e.lineno})`);
    const onRej = (e: PromiseRejectionEvent) => push("وعد مرفوض", String((e.reason as Error)?.stack ?? e.reason));
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRej);
    const origErr = console.error;
    console.error = (...a: unknown[]) => { push("console.error", a.map((x) => (x instanceof Error ? x.message : typeof x === "string" ? x : JSON.stringify(x))).join(" ")); origErr(...a); };
    const origFetch = window.fetch;
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const url = typeof args[0] === "string" ? args[0] : args[0] instanceof URL ? args[0].href : (args[0] as Request).url;
      try {
        const res = await origFetch(...args);
        if (!res.ok && !url.includes("/api/report")) {
          const body = await res.clone().text().catch(() => "");
          push(`طلب فشل ${res.status}`, `${(args[1]?.method ?? "GET")} ${url.replace(location.origin, "")} → ${body.slice(0, 400)}`);
        }
        return res;
      } catch (e) {
        push("طلب انقطع", `${url.replace(location.origin, "")} → ${(e as Error).message}`);
        throw e;
      }
    };
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRej);
      console.error = origErr;
      window.fetch = origFetch;
    };
  }, []);

  const setPicture = useCallback((b: Blob | null) => {
    setShot(b);
    setShotUrl((old) => { if (old) URL.revokeObjectURL(old); return b ? URL.createObjectURL(b) : null; });
  }, []);

  /** A picture of the screen (the browser asks which one to share; one frame is taken, then sharing stops). */
  async function screenshot() {
    setMsg("");
    try {
      setOpen(false);
      await new Promise((r) => setTimeout(r, 150));
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, preferCurrentTab: true } as DisplayMediaStreamOptions);
      const v = document.createElement("video");
      v.srcObject = stream;
      v.muted = true;
      await v.play();
      await new Promise((r) => setTimeout(r, 350));
      const c = document.createElement("canvas");
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      c.getContext("2d")!.drawImage(v, 0, 0);
      stream.getTracks().forEach((t) => t.stop());
      const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/png"));
      setPicture(blob);
    } catch {
      setMsg("ما قدرت أصوّر الشاشة من هذا المتصفح (الجوال ما يدعمها): صوّرها بزر الجوال وارفقها بزر «🖼️ أرفق صورة».");
    } finally {
      setOpen(true);
    }
  }

  async function toggleVoice() {
    setMsg("");
    if (rec === "on") { recorder.current?.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(stream);
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRec("busy");
        try {
          const fd = new FormData();
          fd.append("file", new Blob(chunks.current, { type: r.mimeType || "audio/webm" }), "report.webm");
          const res = await fetch("/api/report/voice", { method: "POST", body: fd });
          const j = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
          if (!res.ok || !j.text) throw new Error(j.error ?? "تعذّر كتابة التسجيل.");
          setNote((n) => (n ? `${n}\n${j.text}` : j.text!));
        } catch (e) {
          setMsg((e as Error).message);
        } finally {
          setRec("");
        }
      };
      recorder.current = r;
      r.start();
      setRec("on");
    } catch {
      setMsg("ما قدرت أفتح المايك؛ اسمح للمتصفح بالمايك.");
    }
  }

  const bundle = () =>
    [
      `🐞 بلاغ مشكلة — ${new Date().toLocaleString("ar-SA")}`,
      `الصفحة: ${location.href}`,
      `الشاشة: ${window.innerWidth}×${window.innerHeight} · ${navigator.userAgent}`,
      note.trim() ? `\nوصف المشكلة:\n${note.trim()}` : "",
      log.length ? `\nآخر الأخطاء في الصفحة:\n${log.map((e) => `[${e.t}] ${e.kind}: ${e.text}`).join("\n")}` : "\n(ما سُجّل أي خطأ في الصفحة)",
      shot ? "\n(الصورة مرفقة: الصقها هنا بعد النص)" : "",
    ].filter(Boolean).join("\n");

  async function copyText() {
    try { await navigator.clipboard.writeText(bundle()); setMsg("✅ انسخ النص. روح للمحادثة مع Claude والصقه (Ctrl+V)."); } catch { setMsg("تعذّر النسخ؛ حدّد النص في الصندوق وانسخه يدويًا."); }
  }
  async function copyPicture() {
    if (!shot) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": shot })]);
      setMsg("✅ انسخت الصورة. الصقها في المحادثة (Ctrl+V) بعد النص.");
    } catch {
      const a = document.createElement("a");
      a.href = shotUrl!;
      a.download = "problem.png";
      a.click();
      setMsg("نزّلت الصورة عندك؛ ارفقها في المحادثة.");
    }
  }

  return (
    <>
      <button type="button" className="jw-btn h-9 min-h-9 px-2.5" aria-label="بلّغ عن مشكلة" title="بلّغ عن مشكلة (للرئيس)" onClick={() => setOpen((o) => !o)}>🐞</button>
      {open && (
        <div role="dialog" aria-label="بلاغ مشكلة" dir="rtl" style={{ position: "fixed", top: 64, insetInlineStart: 12, zIndex: 90, width: "min(440px, calc(100vw - 24px))", maxHeight: "calc(100dvh - 80px)", overflowY: "auto", padding: 14, borderRadius: 16, background: "var(--jw-bg, #0b0c0f)", color: "var(--jw-text, #fff)", border: "1px solid var(--jw-line, #333)", boxShadow: "0 24px 60px rgba(0,0,0,.5)", display: "grid", gap: 10 }}>
          <b>🐞 بلّغ عن مشكلة</b>
          <small style={{ opacity: 0.8 }}>الصفحة: {path} · أخطاء مسجّلة: {log.length}</small>
          <textarea dir="auto" rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder="اكتب وش صار (أو سجّل صوتك)…" style={{ width: "100%", padding: 8, borderRadius: 10, border: "1px solid var(--jw-line, #444)", background: "transparent", color: "inherit" }} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            <button type="button" className="jw-btn" onClick={() => void screenshot()}>📸 صوّر الشاشة</button>
            <button type="button" className="jw-btn" onClick={() => picker.current?.click()}>🖼️ أرفق صورة</button>
            <button type="button" className="jw-btn" disabled={rec === "busy"} onClick={() => void toggleVoice()}>{rec === "on" ? "⏹️ أوقف التسجيل" : rec === "busy" ? "…أكتب كلامك" : "🎙️ سجّل صوتك"}</button>
            <input ref={picker} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) setPicture(f); e.target.value = ""; }} />
          </div>
          {shotUrl && (
            <div style={{ display: "grid", gap: 6 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={shotUrl} alt="لقطة" style={{ maxWidth: "100%", maxHeight: 180, objectFit: "contain", borderRadius: 10, border: "1px solid var(--jw-line, #444)" }} />
              <button type="button" className="jw-btn" onClick={() => setPicture(null)}>احذف الصورة</button>
            </div>
          )}
          <textarea readOnly dir="auto" rows={5} value={bundle()} style={{ width: "100%", padding: 8, borderRadius: 10, border: "1px dashed var(--jw-line, #444)", background: "transparent", color: "inherit", fontSize: 11 }} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            <button type="button" className="jw-btn jw-btn-primary" onClick={() => void copyText()}>📋 انسخ النص</button>
            {shot && <button type="button" className="jw-btn jw-btn-primary" onClick={() => void copyPicture()}>🖼️ انسخ الصورة</button>}
            <button type="button" className="jw-btn" onClick={() => setOpen(false)}>إغلاق</button>
          </div>
          {msg && <small>{msg}</small>}
        </div>
      )}
    </>
  );
}
