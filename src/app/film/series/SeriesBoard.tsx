"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { postJson } from "@/lib/fetch";
import { useFilmBase } from "../FilmBase";
import ScenePrep from "./ScenePrep";

type Scene = { id: string; title: string; number: number; stage: string; icon: string; stageLabel: string; saved: boolean; assignedTo: string | null; prepared: boolean };
type Mate = { userId: string; username: string | null; leader: boolean };
type Episode = { id: string; number: number; title: string; scenes: Scene[] };

/**
 * The series' episodes. Each: its scenes as small squares on top (a tap opens the scene; «+» adds one), the scenes'
 * cards below (order with ↑ ↓), and «ركّب الحلقة»: the scenes' saved montages in order in «حيدرة كت», where حيدرة adds
 * the sound effects and music.
 */
export default function SeriesBoard({ seriesId, owner, canAssign, team, episodes }: { seriesId: string; owner: boolean; canAssign: boolean; team: Mate[]; episodes: Episode[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const send = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError("");
    try {
      await postJson(`/api/film/series/${seriesId}`, body);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-6">
      {episodes.map((ep) => (
        <EpisodeBlock key={ep.id} seriesId={seriesId} ep={ep} busy={busy} send={send} canAssign={canAssign} team={team} />
      ))}
      {error && <p className="error-box">{error}</p>}
      {(owner || canAssign) && (
        <button type="button" className="btn btn-secondary w-full" disabled={busy} onClick={() => send({ action: "add_episode" })}>
          ➕ حلقة جديدة (الحلقة {(episodes.at(-1)?.number ?? 0) + 1})
        </button>
      )}
    </div>
  );
}

function EpisodeBlock({ seriesId, ep, busy, send, canAssign, team }: { seriesId: string; ep: Episode; busy: boolean; send: (b: Record<string, unknown>) => Promise<void>; canAssign: boolean; team: Mate[] }) {
  const router = useRouter();
  const base = useFilmBase();
  // «+» (a new scene) or a scene of the plan, prepared with سجاد
  const [prep, setPrep] = useState<{ sceneId?: string; title?: string } | null>(null);
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const saved = ep.scenes.filter((s) => s.saved).length;
  const nameOf = (id: string | null) => (id ? (team.find((m) => m.userId === id)?.username ?? "؟") : null);
  const assemble = async () => {
    setWorking("assemble");
    setError("");
    try {
      const r = await postJson<{ id: string; waiting: { number: number; title: string }[] }>(`/api/film/series/${seriesId}`, { action: "assemble", episodeId: ep.id });
      if (r.waiting.length && !window.confirm(`هذي المشاهد ما حُفظ مونتاجها بعد، فما راح تدخل الحلقة الحين: ${r.waiting.map((w) => `${w.number} «${w.title}»`).join("، ")}. تكمّل؟`)) {
        setWorking("");
        return;
      }
      const ask = [
        `هذي الحلقة ${ep.number}${ep.title ? ` «${ep.title}»` : ""}: مشاهدها مركّبة بالترتيب على المسار الرئيسي (كل مقطع مشهد كامل بمونتاجه).`,
        "اسمع وشوف كل مشهد، وأضف مؤثرات صوتية مناسبة (خطوات، أبواب، ريح، جمهور…) في أماكنها على مسار صوت، وموسيقى تصويرية تناسب جو كل مشهد على مسار ثاني، منخفضة تحت الحوار، مع دخول وخروج ناعم بين المشاهد.",
        "وقل لي باختصار وش أضفت ووين.",
      ].join("\n");
      router.push(`/jawad-ai/editor/${r.id}?haydara=${encodeURIComponent(ask)}`);
    } catch (e) {
      setError((e as Error).message);
      setWorking("");
    }
  };

  return (
    <section className="card space-y-4 p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="display text-2xl">الحلقة {ep.number}{ep.title ? ` · ${ep.title}` : ""}</h2>
        <span className="chip text-xs">🏆 {saved} من {ep.scenes.length} مشهد محفوظ</span>
      </header>

      {/* the scenes as small squares (open one with a tap), and «+» to add one */}
      <ol className="flex gap-2 overflow-x-auto pb-1" aria-label="مشاهد الحلقة">
        {ep.scenes.map((s) => (
          <li key={s.id} className="shrink-0">
            <Link
              href={`${base}/${s.id}`}
              title={`المشهد ${s.number} · ${s.title} · ${s.stageLabel}`}
              className={`grid h-16 w-16 place-items-center rounded-2xl text-center text-xs font-extrabold shadow-sm transition-transform hover:-translate-y-0.5 ${s.saved ? "bg-gradient-to-b from-[#f6cf6e] to-[#e2a72c] text-[#0b1d47]" : "bg-[#0b1d47] text-white"}`}
            >
              <span className="text-xl leading-none" aria-hidden>{s.saved ? "🏆" : s.icon}</span>
              <span>{s.number}</span>
            </Link>
          </li>
        ))}
        <li className="shrink-0">
          <button type="button" className="grid h-16 w-16 place-items-center rounded-2xl border-2 border-dashed border-[#1f63f0] text-2xl font-extrabold text-[#1f63f0]" onClick={() => setPrep({})} aria-label="أضف مشهد">
            +
          </button>
        </li>
      </ol>

      {prep && <ScenePrep key={prep.sceneId ?? "new"} seriesId={seriesId} episodeId={ep.id} sceneId={prep.sceneId} initialTitle={prep.title} canAddCast={canAssign} onClose={() => setPrep(null)} />}

      {ep.scenes.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {ep.scenes.map((s, i) => (
            <article key={s.id} className="flex items-center gap-3 rounded-2xl border border-line bg-white/70 p-3">
              <span className="text-3xl" aria-hidden>{s.icon}</span>
              <Link href={`${base}/${s.id}`} className="min-w-0 flex-1">
                <p className="truncate font-extrabold">{s.number}. {s.title}</p>
                <p className="text-xs font-bold text-muted">{s.saved ? "🏆 المشهد الناجح محفوظ" : `في مرحلة: ${s.stageLabel}`}</p>
                {nameOf(s.assignedTo) && !canAssign && <p className="text-xs font-extrabold text-[#1f63f0]">👤 <bdi dir="ltr">@{nameOf(s.assignedTo)}</bdi></p>}
              </Link>
              {canAssign && team.length > 0 && (
                <select className="field !h-9 !w-28 !px-2 !py-0 text-xs" value={s.assignedTo ?? ""} aria-label="مين يسويه" disabled={busy} onChange={(e) => send({ action: "assign_scene", sceneId: s.id, userId: e.target.value })}>
                  <option value="">👤 لأحد؟</option>
                  {team.map((m) => (
                    <option key={m.userId} value={m.userId}>@{m.username ?? "؟"}{m.leader ? " (القائد)" : ""}</option>
                  ))}
                </select>
              )}
              {!s.prepared && s.stage === "screenwriter" && (
                <button type="button" className="rounded-full bg-[#e2a72c]/25 px-2 py-1 text-[11px] font-extrabold" onClick={() => setPrep({ sceneId: s.id, title: s.title })} title="سجاد يفهم المشهد ويحدد شخصياته وبيئاته">
                  🧑‍🏫 جهّزه
                </button>
              )}
              <span className="flex flex-col">
                <button type="button" className="px-2 text-sm disabled:opacity-30" disabled={busy || i === 0} onClick={() => send({ action: "move_scene", sceneId: s.id, by: -1 })} aria-label="قدّمه">▲</button>
                <button type="button" className="px-2 text-sm disabled:opacity-30" disabled={busy || i === ep.scenes.length - 1} onClick={() => send({ action: "move_scene", sceneId: s.id, by: 1 })} aria-label="أخّره">▼</button>
              </span>
            </article>
          ))}
        </div>
      ) : (
        <p className="text-sm font-bold text-muted">ما فيه مشاهد بعد. اضغط «+» وابدأ أول مشهد.</p>
      )}

      <button type="button" className="btn btn-primary min-h-12 w-full" disabled={!!working || busy || !saved} onClick={assemble}>
        {working === "assemble" ? "نركّب الحلقة…" : "🎞️ ركّب الحلقة من مشاهدها (وحيدرة يضيف المؤثرات والموسيقى)"}
      </button>
      {!saved && ep.scenes.length > 0 && <p className="text-xs font-bold text-muted">الحلقة تتركب من «🏆 المشهد الناجح» لكل مشهد: بعد مونتاج المشهد احفظه من صفحة المونتاج.</p>}
      {error && <p className="error-box text-sm">{error}</p>}
    </section>
  );
}
