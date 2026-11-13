"use client";

// «قوالب المصممين» — a designer uploads his design with its photo frames EMPTY and its words left out, then marks with
// the mouse where each photo and each word goes. It waits for the owner's approval, then everyone can use it in
// «دعوة مجلس» (only the names, photos and details change — the design itself is locked). The owner approves here too.

import { useEffect, useRef, useState } from "react";
import { api, postJson } from "@/lib/fetch";
import { probeFile, putWithProgress } from "@/components/jawad/studio/upload";
import { USER_ASPECTS, viewUrl, type MajlisTemplate } from "@config/designer-majlis";

const KINDS = [
  { k: "slot1", label: "📷 صورة الشخص ١", slot: 0 },
  { k: "slot2", label: "📷 صورة الشخص ٢", slot: 1 },
  { k: "kh", label: "اسم الشخص ١" },
  { k: "rd", label: "اسم الشخص ٢" },
  { k: "khLbl", label: "صفة الشخص ١ (الخطيب)" },
  { k: "rdLbl", label: "صفة الشخص ٢ (الرادود)" },
  { k: "hostLine", label: "سطر الدعوة واسم المأتم" },
  { k: "dateLine", label: "الليلة والتاريخ" },
  { k: "timeLine", label: "الوقت" },
  { k: "place", label: "المكان" },
  { k: "women", label: "سطر النساء" },
] as const;
type Kind = (typeof KINDS)[number]["k"];
type Box = { k: Kind; r: number[] };

const ratio: Record<string, number> = { "3:4": 3 / 4, "4:5": 4 / 5, "1:1": 1, "9:16": 9 / 16, "2:3": 2 / 3 };

export default function TemplateMaker({ onClose }: { onClose: () => void }) {
  const [file, setFile] = useState<{ id: string; url: string; w: number; h: number } | null>(null);
  const [kind, setKind] = useState<Kind>("slot1");
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [shape, setShape] = useState<"round" | "circle" | "arch">("round");
  const [color, setColor] = useState<"#ffffff" | "gold">("#ffffff");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [waiting, setWaiting] = useState<{ template: MajlisTemplate; byEmail: string }[]>([]);
  const [owner, setOwner] = useState(false);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [live, setLive] = useState<number[] | null>(null);
  const area = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  const loadWaiting = () => api<{ waiting: { template: MajlisTemplate; byEmail: string }[]; owner: boolean }>("/api/designer/templates").then((r) => (setWaiting(r.waiting), setOwner(r.owner))).catch(() => null);
  useEffect(() => void loadWaiting(), []);

  async function upload(f: File | undefined) {
    if (!f) return;
    setBusy("أرفع التصميم…");
    try {
      const probe = await probeFile(f, "image");
      const signed = await postJson<{ id: string; signedUrl: string }>("/api/jawad/uploads", { kind: probe.kind, mime: probe.mime, bytes: f.size, fileName: f.name });
      await putWithProgress(signed.signedUrl, f, probe.mime, () => {});
      const conf = await postJson<{ upload: { id: string; status: string; error: string | null; url: string | null } }>("/api/jawad/uploads/confirm", { id: signed.id });
      if (conf.upload?.status !== "ready" || !conf.upload.url) throw new Error(conf.upload?.error ?? "تعذّر فحص الصورة.");
      const bm = await createImageBitmap(f);
      setFile({ id: conf.upload.id, url: conf.upload.url, w: bm.width, h: bm.height });
      bm.close();
      setBoxes([]);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "تعذّر الرفع.");
    } finally {
      setBusy("");
    }
  }

  const at = (e: React.PointerEvent) => {
    const r = area.current!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };
  const down = (e: React.PointerEvent) => {
    drag.current = at(e);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const p = at(e), s = drag.current;
    setLive([Math.min(s.x, p.x), Math.min(s.y, p.y), Math.abs(p.x - s.x), Math.abs(p.y - s.y)]);
  };
  const up = () => {
    if (live && live[2] > 0.02 && live[3] > 0.01) setBoxes((b) => [...b.filter((x) => x.k !== kind), { k: kind, r: live.map((v) => Math.round(v * 10000) / 10000) }]);
    drag.current = null;
    setLive(null);
  };

  async function send() {
    if (!file) return;
    const slots = (["slot1", "slot2"] as const).map((k) => boxes.find((b) => b.k === k)).filter(Boolean).map((b) => ({ r: b!.r, shape }));
    const words = boxes.filter((b) => !b.k.startsWith("slot")).map((b) => ({ k: b.k, r: b.r, font: b.k === "kh" || b.k === "rd" ? "head" : "body", color: color === "gold" ? "#e8c77a" : "#ffffff", ...(color === "gold" ? { grad: "gold" } : {}) }));
    const aspect = USER_ASPECTS.slice().sort((a, b) => Math.abs(ratio[a] - file.w / file.h) - Math.abs(ratio[b] - file.w / file.h))[0];
    setBusy("أرسل القالب…");
    try {
      await postJson("/api/designer/templates", { upload: file.id, template: { aspect, title, slots, words } });
      setMsg("✅ وصل قالبك — يظهر للجميع في «دعوة مجلس» بعد اعتماد الإدارة.");
      setFile(null);
      setBoxes([]);
      void loadWaiting();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "تعذّر الإرسال.");
    } finally {
      setBusy("");
    }
  }

  async function decide(id: string, decision: "approve" | "remove") {
    await postJson("/api/designer/templates", { id, decision }).catch((e) => setMsg(e instanceof Error ? e.message : "تعذّر."));
    void loadWaiting();
  }

  return (
    <div className="mj">
      <div className="mj-head">
        <b>🧩 ارفع قالبك (للمصممين)</b>
        <button type="button" className="dz-mini" onClick={onClose}>✕ إغلاق</button>
      </div>
      <div className="mj-body">
        <p className="mj-note">ارفع تصميمك وإطارات الصور فيه <b>فاضية</b> وبدون أسماء أو تواريخ، وبعدين ارسم بالماوس مكان كل صورة وكل كلمة. بعد اعتماد الإدارة يقدر أي أحد يستخدمه ويغيّر الأسماء والصور بس — باقي التصميم مقفول.</p>
        <input ref={input} type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={(e) => void upload(e.target.files?.[0])} />
        <div className="mj-row">
          <button type="button" className="dz-mini" onClick={() => input.current?.click()}>{file ? "🔁 صورة ثانية" : "📤 ارفع التصميم"}</button>
          <input value={title} placeholder="اسم القالب (مثل: عظّم الله أجوركم)" onChange={(e) => setTitle(e.target.value)} style={{ flex: 1, height: 36, borderRadius: 10, border: "1px solid #d8dbe8", padding: "0 10px" }} />
        </div>
        {file && (
          <>
            <div className="mj-makers">
              {KINDS.map((x) => (
                <button key={x.k} type="button" className={`mj-maker ${kind === x.k ? "on" : ""}`} onClick={() => setKind(x.k)}>
                  <b style={{ fontSize: 12 }}>{x.label}</b>
                  <span>{boxes.some((b) => b.k === x.k) ? "✓ محدّد" : "ارسمه على التصميم"}</span>
                </button>
              ))}
            </div>
            <div className="mj-row">
              <span className="mj-note">شكل الإطار:</span>
              {(["round", "circle", "arch"] as const).map((s) => <button key={s} type="button" className={`dz-mini ${shape === s ? "on" : ""}`} onClick={() => setShape(s)}>{s === "round" ? "مستطيل" : s === "circle" ? "دائرة" : "قوس"}</button>)}
              <span className="mj-note">لون الكلام:</span>
              {(["#ffffff", "gold"] as const).map((c) => <button key={c} type="button" className={`dz-mini ${color === c ? "on" : ""}`} onClick={() => setColor(c)}>{c === "gold" ? "ذهبي" : "أبيض"}</button>)}
            </div>
            <div ref={area} onPointerDown={down} onPointerMove={move} onPointerUp={up} style={{ position: "relative", touchAction: "none", userSelect: "none", maxWidth: 420, margin: "0 auto" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={file.url} alt="" draggable={false} style={{ width: "100%", display: "block", borderRadius: 10 }} />
              {[...boxes, ...(live ? [{ k: kind, r: live }] : [])].map((b, i) => (
                <div key={i} style={{ position: "absolute", left: `${b.r[0] * 100}%`, top: `${b.r[1] * 100}%`, width: `${b.r[2] * 100}%`, height: `${b.r[3] * 100}%`, border: `2px solid ${b.k.startsWith("slot") ? "#22c55e" : "#facc15"}`, background: "rgba(0,0,0,0.25)", color: "#fff", fontSize: 10, display: "grid", placeItems: "center", pointerEvents: "none" }}>
                  {KINDS.find((x) => x.k === b.k)?.label}
                </div>
              ))}
            </div>
            <div className="mj-row">
              <button type="button" className="dz-mini" onClick={() => setBoxes((b) => b.filter((x) => x.k !== kind))}>🗑️ امسح المحدّد</button>
              <button type="button" className="dz-send" disabled={!!busy || !boxes.some((b) => b.k === "slot1") || !boxes.some((b) => b.k === "kh")} onClick={() => void send()}>{busy ? "…" : "أرسل للاعتماد"}</button>
            </div>
          </>
        )}
        {busy && <p className="mj-note">{busy}</p>}
        {msg && <p className="mj-note">{msg}</p>}
        {waiting.length > 0 && (
          <>
            <p><b>{owner ? "قوالب تنتظر اعتمادك" : "قوالبك اللي تنتظر الاعتماد"}</b></p>
            <div className="mj-grid">
              {waiting.map(({ template: t, byEmail }) => (
                <div key={t.id} className="mj-card">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={viewUrl(t.id)} alt={t.title} loading="lazy" />
                  <span>{t.title}{byEmail ? ` · ${byEmail}` : ""}</span>
                  {owner && (
                    <div className="mj-row">
                      <button type="button" className="dz-mini" onClick={() => void decide(t.id, "approve")}>✅ اعتمد</button>
                      <button type="button" className="dz-mini" onClick={() => void decide(t.id, "remove")}>🗑️ احذف</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
