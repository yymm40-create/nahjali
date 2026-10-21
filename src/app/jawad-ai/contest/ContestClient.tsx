"use client";

// «مسابقة الفيلم السينمائي» in the browser: the person's videos with «أضف إلى المنصة», the owner's judges list, and
// the places picker on the entries page.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "@/lib/fetch";

export interface Vid {
  id: string;
  projectTitle: string;
  title: string;
  url: string | null;
  entered: boolean;
  place?: number | null;
}

const PLACE = ["", "🥇 الأول", "🥈 الثاني", "🥉 الثالث"];

export function VideoCard({ v, children }: { v: Vid; children?: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-jw-line bg-jw-surface">
      {v.url ? <video src={v.url} controls preload="metadata" playsInline className="aspect-video w-full bg-black" /> : <div className="aspect-video w-full bg-black/40" />}
      <div className="space-y-2 p-3">
        <p className="m-0 text-sm font-bold">{v.projectTitle || "مشهد"}</p>
        <p className="m-0 text-xs text-jw-muted">{v.title}</p>
        {children}
      </div>
    </div>
  );
}

/** The person's own videos, each with «أضف إلى المنصة» (or «✓ مضاف · اسحبه»). */
export function MyVideos({ videos }: { videos: Vid[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const toggle = async (v: Vid) => {
    setBusy(v.id);
    setErr("");
    try {
      await postJson("/api/contest", { action: v.entered ? "remove" : "add", assetId: v.id });
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "تعذّر الحفظ.");
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="space-y-3">
      {err && <p className="m-0 font-bold text-red-500">{err}</p>}
      <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {videos.map((v) => (
          <li key={v.id}>
            <VideoCard v={v}>
              <button type="button" className={`jw-btn w-full !min-h-11 ${v.entered ? "" : "jw-btn-primary"}`} disabled={busy === v.id} onClick={() => void toggle(v)}>
                {busy === v.id ? "…" : v.entered ? "✓ مضاف للمنصة · اسحبه" : "➕ أضف إلى المنصة"}
              </button>
            </VideoCard>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The owner's judges: who else may open the judging pages. */
export function Judges({ emails }: { emails: string[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const send = async (action: "judge_add" | "judge_remove", e: string) => {
    setErr("");
    try {
      await postJson("/api/contest", { action, email: e });
      setEmail("");
      router.refresh();
    } catch (x) {
      setErr(x instanceof Error ? x.message : "تعذّر الحفظ.");
    }
  };
  return (
    <div className="space-y-2 rounded-2xl border border-jw-line p-3">
      <p className="m-0 font-bold">👥 اللجنة (يشوفون صفحات التحكيم ويختارون المراكز)</p>
      <div className="flex gap-2">
        <input className="jw-input flex-1" dir="ltr" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button type="button" className="jw-btn jw-btn-primary" disabled={!email.trim()} onClick={() => void send("judge_add", email)}>
          أضف
        </button>
      </div>
      {err && <p className="m-0 text-sm text-red-500">{err}</p>}
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
        {emails.map((e) => (
          <li key={e} className="jw-chip flex items-center gap-2" dir="ltr">
            {e}
            <button type="button" aria-label="شيله" onClick={() => void send("judge_remove", e)}>
              ✕
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The places picker under an entered video: 1st, 2nd, 3rd (pressing the one it holds clears it). */
export function PlacePicker({ v }: { v: Vid }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const pick = async (place: number) => {
    setBusy(true);
    try {
      await postJson("/api/contest", { action: "place", place, assetId: v.place === place ? "" : v.id });
      router.refresh();
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="grid grid-cols-3 gap-1">
      {[1, 2, 3].map((p) => (
        <button key={p} type="button" disabled={busy} className={`jw-btn !min-h-9 !px-1 text-xs ${v.place === p ? "jw-btn-primary" : ""}`} onClick={() => void pick(p)}>
          {PLACE[p]}
        </button>
      ))}
    </div>
  );
}
