"use client";

import { creditsRange } from "@/lib/film/credits";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useCallback, useTransition } from "react";
import { api, postJson } from "@/lib/fetch";
import Markdown from "@/components/Markdown";
import Spinner from "@/components/Spinner";
import QuestionsForm from "../../QuestionsForm";
import StepCard from "../../StepCard";
import { EditsLeftContext, type SendMode } from "../../ActionBar";
import type { DirectorVersion } from "@/lib/film/director";
import { VIDEO_MODELS } from "@config/film";
import { useFilmBase } from "../../FilmBase";

interface Video {
  id: string;
  ref_key: string;
  status: string;
  error: string | null;
  meta: Record<string, unknown>;
  url: string;
}
interface Props {
  projectId: string;
  stage: string;
  versions: DirectorVersion[];
  superDirector: boolean;
  videos: Video[];
  library: { name: string; sheetId: string; url: string }[];
  job: { status: string; error: string | null } | null;
  videosRunning: number;
  /** Edits left in this stage (the owner's limits); null = no limit. */
  editsLeft: number | null;
}

const SUPER_HINT = "قواعد إخراج وكاميرا أعمق من الدورة، ويكتب البرومبت بصيغتها (إنجليزي + صيني). كل رد من المخرج يكلّف أكثر لأن المهارة طويلة.";

export default function DirectorWorkspace({ projectId, stage, versions, superDirector, videos, library, job, videosRunning, editsLeft }: Props) {
  const router = useRouter();
  const filmBase = useFilmBase();
  const [writing, setWriting] = useState(job?.status === "running");
  const [rendering, setRendering] = useState(videosRunning > 0);
  const [sending, setBusy] = useState(false);
  // Busy until the new page data has arrived: the old screen's buttons can't be pressed a second time
  const [refreshing, startRefresh] = useTransition();
  const refresh = useCallback(() => startRefresh(() => router.refresh()), [router]);
  const busy = sending || refreshing;
  const [error, setError] = useState("");
  const [useSuper, setUseSuper] = useState(true);

  // Poll while the director writes or videos are generated (the poll also saves finished videos)
  useEffect(() => {
    if (!writing && !rendering) return;
    const timer = setInterval(async () => {
      try {
        const s = await api<{ status: string | null; videosRunning: number }>(`/api/film/projects/${projectId}/director`);
        const w = s.status === "running";
        const r = s.videosRunning > 0;
        if (w !== writing || r !== rendering) refresh();
        setWriting(w);
        setRendering(r);
      } catch {
        // keep polling
      }
    }, 6000);
    return () => clearInterval(timer);
  }, [writing, rendering, projectId, router, refresh]);

  async function send(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const { jobId } = await postJson<{ jobId: string | null }>(`/api/film/projects/${projectId}/director`, body);
      if (jobId) setWriting(true);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const latestOf = (kind: string, ref = "") => versions.filter((v) => v.kind === kind && v.ref_key === ref).at(-1);
  const understanding = latestOf("dir_understanding");
  const questions = versions.filter((v) => v.kind === "dir_questions");
  const mapV = latestOf("dir_map");
  const approvedMap = versions.filter((v) => v.kind === "dir_map" && v.status === "approved").at(-1) ?? mapV;
  const map = approvedMap?.data.generation_map ?? [];
  const genIds = [...new Set(versions.filter((v) => v.kind === "dir_generation").map((v) => v.ref_key))];
  const ordered = [...map.map((g) => g.id).filter((id) => genIds.includes(id)), ...genIds.filter((id) => !map.some((g) => g.id === id))];
  const note = latestOf("dir_note");
  const current = [...versions].filter((v) => v.kind !== "dir_setup").sort((a, b) => a.created_at.localeCompare(b.created_at)).at(-1);
  const failed = job?.status === "failed" && !writing;
  const started = versions.some((v) => v.kind !== "dir_setup") || writing || failed;
  const revise = (v: DirectorVersion) => (mode: SendMode, text: string) => send({ action: "revise", text, versionId: v.id, mode });
  const nameOf = (id: string) => map.find((g) => g.id === id)?.name ?? "";
  const laterThan = (id: string) => ordered.slice(ordered.indexOf(id) + 1).filter((g) => versions.some((v) => v.kind === "dir_generation" && v.ref_key === g && v.status === "approved"));
  // Once every generation of the approved map is approved, go straight to the generation page (only when it happens here)
  const allApproved = map.length > 0 && map.every((g) => versions.some((v) => v.kind === "dir_generation" && v.ref_key === g.id && v.status === "approved"));
  const wasDone = useRef(allApproved);
  useEffect(() => {
    if (!wasDone.current && allApproved) router.push(`${filmBase}/${projectId}/videos`);
  }, [allApproved, projectId, router, filmBase]);
  // After the directing questions: see each generation's visual analysis before making, or make directly (the map
  // and every generation then approved in the background, straight to the generation page). Kept on this device.
  const modeKey = `film-direct-${projectId}`;
  const [mode, setModeState] = useState<"show" | "direct" | null>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const v = localStorage.getItem(modeKey);
        if (v === "show" || v === "direct") setModeState(v);
      } catch {}
    }, 0);
    return () => clearTimeout(t);
  }, [modeKey]);
  const setMode = (m: "show" | "direct") => {
    setModeState(m);
    try {
      localStorage.setItem(modeKey, m);
    } catch {}
  };
  // the directing questions were answered at the very start (the screenwriter's one round): the choice comes after the understanding
  const answered = questions.some((q) => q.status === "approved") || (understanding?.status === "approved" && !questions.some((q) => q.status === "awaiting_approval"));
  const direct = mode === "direct";
  // The director starts by itself and its understanding is approved in the background: the person meets its questions
  const autoStart = stage === "director" && !failed;
  const startedOnce = useRef(false);
  const approvedOnce = useRef<string | null>(null);
  useEffect(() => {
    if (busy || writing) return;
    if (!started && autoStart && !startedOnce.current) {
      startedOnce.current = true;
      const t = setTimeout(() => void send({ action: "start", superDirector: true }), 0);
      return () => clearTimeout(t);
    }
    if (understanding?.status === "awaiting_approval" && approvedOnce.current !== understanding.id) {
      approvedOnce.current = understanding.id;
      const t = setTimeout(() => void send({ action: "approve", versionId: understanding.id }), 0);
      return () => clearTimeout(t);
    }
    if (!direct) return;
    // «اصنع مباشرة»: the map, then each generation as it arrives, approved here; a note asks for the next one
    const waiting = [mapV, ...ordered.map((gid) => versions.filter((x) => x.kind === "dir_generation" && x.ref_key === gid).at(-1))].find((x) => x?.status === "awaiting_approval" && approvedOnce.current !== x.id);
    if (waiting) {
      approvedOnce.current = waiting.id;
      const t = setTimeout(() => void send({ action: "approve", versionId: waiting.id }), 0);
      return () => clearTimeout(t);
    }
    if (note && note.created_at === current?.created_at && map.some((g) => !genIds.includes(g.id)) && approvedOnce.current !== note.id) {
      approvedOnce.current = note.id;
      const t = setTimeout(() => void send({ action: "continue" }), 0);
      return () => clearTimeout(t);
    }
  });
  const affects = (id: string) => {
    const later = laterThan(id);
    return later.length ? ` التوليدات المعتمدة بعده (${later.join("، ")}) ممكن تتأثر بالاستمرارية، والمخرج يوضح وش يحتاج تحديث.` : "";
  };

  return (
    <EditsLeftContext value={editsLeft}>
    <div className="space-y-4">
      {library.length > 0 && (
        <section className="card space-y-2 p-4">
          <h2 className="text-lg font-extrabold">المراجع المعتمدة ({library.length})</h2>
          <p className="text-xs font-bold text-muted">المخرج يختار منها لكل توليد، والموقع يرفق صورها تلقائيًا مع طلب الفيديو.</p>
          <div className="grid grid-cols-4 gap-2">
            {library.map((r) => (
              <div key={r.name} className="space-y-1">
                {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
                <img src={r.url} alt={r.name} className="aspect-square w-full rounded-xl object-cover" />
                <p className="truncate text-xs font-extrabold" title={r.name}>{r.name}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {!started && autoStart ? (
        <div className="card flex items-center justify-center gap-3 p-6 font-bold">
          <Spinner /> المخرج يقرأ السيناريو والشيتات والصور المعتمدة ويجهّز أسئلته…
        </div>
      ) : !started ? (
        <div className="card space-y-4 p-6">
          <p className="text-center text-5xl">🎥</p>
          <p className="text-center font-bold">المخرج يستلم السيناريو والشيتات والصور المعتمدة، ويعرض فهمه أول.</p>
          <label className="flex items-start gap-3 rounded-2xl border border-line p-4">
            <input type="checkbox" className="mt-1 size-5" checked={useSuper} onChange={(e) => setUseSuper(e.target.checked)} />
            <span className="space-y-1">
              <span className="block font-extrabold">فعّل «المخرج الخارق» (يكلّف أكثر)</span>
              <span className="block text-sm font-bold text-muted">{SUPER_HINT}</span>
            </span>
          </label>
          <p className="text-center text-sm font-bold text-muted">💡 مو متأكد؟ خلّه مثل ما هو واضغط «ابدأ».</p>
          <button className="btn btn-primary w-full text-xl" disabled={busy} onClick={() => send({ action: "start", superDirector: useSuper })}>
            {busy ? "نرسل…" : "ابدأ مع المخرج"}
          </button>
          <p className="text-center text-xs font-bold text-muted">كل رد {creditsRange(0.05, 1)}</p>
        </div>
      ) : (
        <section className="card flex flex-wrap items-center justify-between gap-2 p-4">
          <p className="font-extrabold">«المخرج الخارق»: {superDirector ? "مفعّل ✅" : "غير مفعّل"}</p>
          {!busy && !writing && (
            <button
              className="btn btn-ghost min-h-10 px-4 text-sm"
              onClick={() =>
                window.confirm(
                  superDirector
                    ? "تبي توقف «المخرج الخارق»؟ يطبّق من الرد الجاي، والبرومبتات القادمة تنكتب بصيغة إنجليزية عادية. اللي اعتمدته قبل يظل مثل ما هو."
                    : `تبي تفعّل «المخرج الخارق»؟ ${SUPER_HINT} يطبّق من الرد الجاي، واللي اعتمدته قبل يظل مثل ما هو.`,
                ) && send({ action: "set_super", superDirector: !superDirector })
              }
            >
              {superDirector ? "أوقفه" : "فعّله"}
            </button>
          )}
        </section>
      )}

      {/* 1. Understanding: worked out in the background (approved by the page itself), kept here folded */}
      {understanding && understanding.status === "approved" && (
        <details className="card p-4 text-sm">
          <summary className="cursor-pointer font-extrabold text-muted">فهم المخرج (اشتغل في الخلفية) — اعرضه أو عدّل عليه</summary>
          <Markdown text={understanding.body} hideCode />
        </details>
      )}

      {/* 2. Directing questions and conflict choices */}
      {questions.map((q) => (
        <StepCard
          key={q.id}
          title="أسئلة الإخراج"
          v={q}
          current={false}
          busy={busy || writing}
          hideBody={q.status === "awaiting_approval"}
          onSend={q.status === "approved" ? revise(q) : undefined}
          warning="غيّرت إجابة؟ اكتبها هنا. الخريطة والتوليدات بعدها ما تتغيّر تلقائيًا، والمخرج يوضح وش يتأثر."
        >
          {q.status === "awaiting_approval" ? (
            <>
              <details className="text-sm">
                <summary className="cursor-pointer font-extrabold text-muted">اعرض رسالة المخرج كاملة</summary>
                <Markdown text={q.body} hideCode />
              </details>
              <QuestionsForm questions={q.data.questions ?? []} busy={busy || writing} onSubmit={(answers) => send({ action: "answers", versionId: q.id, answers })} />
            </>
          ) : q.status === "approved" ? (
            <p className="text-sm font-bold text-muted">تمت الإجابة.</p>
          ) : null}
        </StepCard>
      )).filter((_, i, all) => i === all.length - 1 || questions[i].status === "approved")}

      {answered && mode === null && (
        <section className="card space-y-3 border-2 border-gold p-5">
          <p className="text-lg font-extrabold">🎬 قبل التصنيع: تبي تشوف التحليل البصري لكل لقطة؟</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <button className="btn btn-secondary min-h-14" onClick={() => setMode("show")}>🔍 اعرض لي التحليل قبل كل توليد</button>
            <button className="btn btn-primary min-h-14" onClick={() => setMode("direct")}>⚡ اصنع مباشرة (ينتقل للتوليد لحاله)</button>
          </div>
        </section>
      )}
      {direct && !allApproved && (writing || mapV) && (
        <p className="card flex items-center gap-2 p-4 text-sm font-bold"><Spinner /> المخرج يجهّز اللقطات ويعتمدها لك، وبعدها ننقلك للتوليد…</p>
      )}

      {/* 3. Generation map */}
      {mapV && (
        <StepCard
          title="خريطة التوليدات"
          v={mapV}
          current={current?.id === mapV.id}
          busy={busy || writing}
          onApprove={mapV.status === "awaiting_approval" ? () => send({ action: "approve", versionId: mapV.id }) : undefined}
          onSend={revise(mapV)}
          warning={mapV.status === "approved" ? "الخريطة معتمدة. تعديلها ممكن يضيف أو يحذف توليدات أو يغيّر مددها؛ اللي اعتمدته يظل محفوظ، والمخرج يوضح وش يتأثر." : undefined}
        >
          {(mapV.data.generation_map ?? []).length > 0 && (
            <ul className="space-y-1 text-sm font-bold">
              {(mapV.data.generation_map ?? []).map((g) => (
                <li key={g.id} className="flex justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2">
                  <span>{g.id} · {g.name}</span>
                  <span dir="ltr">{g.duration_sec}s</span>
                </li>
              ))}
            </ul>
          )}
        </StepCard>
      )}

      {/* 4. One card per generation: analysis (the prompt stays hidden), then its videos */}
      {ordered.map((gid) => {
        const v = versions.filter((x) => x.kind === "dir_generation" && x.ref_key === gid).at(-1)!;
        const made = videos.filter((x) => x.ref_key === gid && x.status !== "rejected").length;
        return (
          <StepCard
            key={gid}
            title={`${gid}${nameOf(gid) ? ` · ${nameOf(gid)}` : ""}`}
            v={v}
            current={current?.id === v.id}
            busy={busy || writing}
            hideBody={direct}
            onApprove={v.status === "awaiting_approval" ? () => send({ action: "approve", versionId: v.id }) : undefined}
            approveLabel="اعتمد وكمّل ✅"
            onSend={revise(v)}
            warning={v.status === "approved" ? `هذا التوليد معتمد. بعد التعديل يوصلك تحليل وبرومبت جديد تعتمده، وبعدها تولّد فيديو جديد من صفحة التوليد.${made ? " الفيديوهات اللي تولدت قبل تظل مثل ما هي." : ""}${affects(gid)}` : undefined}
          >
            <div className="flex flex-wrap gap-1 text-xs font-bold">
              <span className="chip">{VIDEO_MODELS[v.data.video_model ?? "seedance-2.5"].label}</span>
              <span className="chip" dir="ltr">{v.data.duration_sec}s · {v.data.ratio}</span>
              <span className="chip">{v.data.generate_audio ? "🔊 بصوت" : "🔇 بدون صوت"}</span>
              {(v.data.references ?? []).map((r) => <span key={r.name} className="chip" title={r.role}>{r.name}</span>)}
            </div>
            {(v.data.dialogue_ar ?? []).length > 0 && (
              <details className="rounded-2xl bg-surface-2 p-3 text-sm">
                <summary className="cursor-pointer font-extrabold">الحوار (للأصوات)</summary>
                <div className="mt-2 space-y-1 font-bold leading-8">
                  {(v.data.dialogue_ar ?? []).map((d, i) => <p key={i}><span className="text-muted">{d.speaker}:</span> {d.line}</p>)}
                </div>
              </details>
            )}
            {v.status === "approved" && (
              <Link href={`${filmBase}/${projectId}/videos`} className="btn btn-ghost w-full">🎬 معتمد · ولّد الفيديو من صفحة التوليد</Link>
            )}
          </StepCard>
        );
      })}

      {note && note.created_at === current?.created_at && (
        <StepCard title="من المخرج" v={note} current busy={busy || writing} onSend={revise(note)}>
          {!writing && map.some((g) => !genIds.includes(g.id)) && (
            <button className="btn btn-primary w-full" disabled={busy} onClick={() => send({ action: "continue" })}>كمّل للتوليد الجاي ▶ (ما ينحسب من تعديلاتك)</button>
          )}
        </StepCard>
      )}

      {writing && (
        <div className="card flex items-center gap-3 p-5" role="status">
          <Spinner />
          <div>
            <p className="font-extrabold">المخرج يكتب…</p>
            <p className="text-sm font-bold text-muted">من دقيقة إلى ٣ دقائق. لا تضغط شي، الصفحة بتتحدّث لحالها ⏳ وتقدر تسكّرها وترجع.</p>
          </div>
        </div>
      )}
      {failed && (
        <div className="card space-y-3 p-5">
          <p className="error-box">ما كمل الرد: {job?.error}. ما انحسبت عليك تكلفة.</p>
          <button className="btn btn-primary w-full" disabled={busy} onClick={() => send({ action: "retry" })}>أعد المحاولة</button>
        </div>
      )}
      {stage === "voices" || stage === "done" ? (
        <div className="card space-y-1 p-5 text-center">
          <p className="text-lg font-extrabold">✅ كل الفيديوهات معتمدة وانتقل المشروع للأصوات</p>
          <Link href={`${filmBase}/${projectId}/voices`} className="btn btn-primary w-full">🎙️ افتح الأصوات</Link>
        </div>
      ) : null}
      {error && <p className="error-box">{error}</p>}
    </div>
    </EditsLeftContext>
  );
}

