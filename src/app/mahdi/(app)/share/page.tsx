"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { MILESTONES } from "@config/mahdi-rewards";
import { t } from "@/lib/mahdi/i18n";
import { bySort } from "@/lib/mahdi/client/derive";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import { buildShare, SHARE_KINDS, type ShareKind } from "@/lib/mahdi/client/share";
import Icon from "@/components/mahdi/Icon";
import { useMahdi } from "@/components/mahdi/Provider";
import { renderCardPng, renderStoryPng } from "@/components/mahdi/ShareCard";
import { useLook } from "@/components/mahdi/ThemeRoot";

const I = t.social.instagram;
const noop = () => () => {};
/** The site's address as the browser sees it (empty while rendering on the server). */
const useOrigin = () => useSyncExternalStore(noop, () => location.origin, () => "");

/**
 * «شارك إنجازي»: pick what to share and what to reveal, see the very picture that will be shared, then share it to
 * an Instagram story (with the link to one's page copied for Instagram's link sticker), save it, or post it.
 */
export default function SharePage() {
  const { state, timeline, toast } = useMahdi();
  const { shrine } = useLook();
  const { snap } = state;
  const [kind, setKind] = useState<ShareKind>("week");
  const [showName, setShowName] = useState(true);
  const [showDelta, setShowDelta] = useState(true);
  const [projectId, setProjectId] = useState(snap.projects[0]?.id ?? "");
  const [habitId, setHabitId] = useState(snap.habits[0]?.id ?? "");
  const [milestoneId, setMilestoneId] = useState(snap.rewards[0]?.milestoneId ?? "");
  const finishedBooks = snap.reading.library.filter((e) => e.state === "finished");
  const [bookId, setBookId] = useState(finishedBooks[0]?.book.id ?? "");
  const [closing, setClosing] = useState("");
  const [busy, setBusy] = useState(false);
  const [format, setFormat] = useState<"story" | "card">("story");
  const [preview, setPreview] = useState<string | null>(null);
  const payload = buildShare(timeline, snap, { kind, showDelta, projectId, habitId, milestoneId, bookId });
  const name = showName ? snap.profile.displayName : undefined;
  const image = shrine?.imageUrl ?? null;
  const origin = useOrigin();
  // The link to my page: it opens an invitation for visitors, and my page for those already in the app
  const link = snap.username && origin ? `${origin}/mahdi/join/${encodeURIComponent(snap.username)}` : "";

  const look = () => {
    const css = getComputedStyle(document.querySelector(".mahdi-root")!);
    return { fonts: { sans: css.getPropertyValue("--font-plex") || "sans-serif", display: css.getPropertyValue("--font-amiri") || "serif" }, image, site: `${location.host}/mahdi` };
  };
  const story = () => renderStoryPng(payload!, { name: snap.profile.displayName, username: snap.username, avatarUrl: snap.profile.avatarUrl, closing, ...look() });
  const card = () => renderCardPng(payload!, { name, closing, ...look() });
  const png = () => (format === "story" ? story() : card());

  // The preview is the very picture that will be shared (drawn again when a choice changes)
  const key = JSON.stringify([payload, closing, name, format, image, snap.profile.avatarUrl, snap.username]);
  useEffect(() => {
    if (!payload) return;
    let live = true;
    let url: string | null = null;
    const timer = setTimeout(() => {
      (format === "story" ? story() : card())
        .then((b) => {
          if (!live) return;
          url = URL.createObjectURL(b);
          setPreview(url);
        })
        .catch(() => null);
    }, 200);
    return () => {
      live = false;
      clearTimeout(timer);
      if (url) setTimeout(() => URL.revokeObjectURL(url!), 1000);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  async function copyLink(forStory = false) {
    if (!link) return toast(I.noUsername);
    try {
      await navigator.clipboard.writeText(link);
      toast(forStory ? I.copiedForStory : I.copied);
    } catch {
      toast(I.copyFailed);
    }
  }

  /** Instagram: the story picture through the phone's share sheet, with the link to my page copied for the sticker. */
  async function instagram() {
    setBusy(true);
    // Copied first, while the tap still counts as the person's own action
    if (link) await copyLink(true);
    try {
      const blob = await story();
      const file = new File([blob], "lajl-almahdi-story.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] }).catch(() => {});
      else {
        download(file);
        toast(t.social.instagram.fallback);
      }
    } catch (e) {
      toast((e as Error).message);
    }
    setBusy(false);
  }

  async function nativeShare() {
    const file = new File([await png()], format === "story" ? "lajl-almahdi-story.png" : "lajl-almahdi.png", { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: t.brand }).catch(() => {});
    else download(file);
  }
  function download(blob: Blob) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "lajl-almahdi.png";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  async function post() {
    setBusy(true);
    try {
      await mahdiFetch("/api/mahdi/community/posts", { method: "POST", json: { kind, showDelta, projectId, habitId, milestoneId, bookId, closing } });
      toast(t.share.posted);
    } catch (e) {
      toast((e as Error).message);
    }
    setBusy(false);
  }

  const kinds = SHARE_KINDS.filter((k) =>
    k === "milestone" ? snap.rewards.length > 0 : k === "project" ? snap.projects.length > 0 : k === "habit" ? snap.habits.length > 0 : k === "reading" ? snap.reading.sessions.length > 0 : k === "book" ? finishedBooks.length > 0 : true,
  );

  return (
    <div className="space-y-6">
      <h1 className="m-display text-3xl">{t.share.title}</h1>
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <section className="m-card space-y-5 p-5">
          <fieldset>
            <legend className="m-label">{t.share.what}</legend>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t.share.what}>
              {kinds.map((k) => (
                <button key={k} type="button" role="radio" aria-checked={kind === k} className="m-option min-h-11 px-3 text-sm font-semibold" onClick={() => setKind(k)}>
                  {t.share.kinds[k]}
                </button>
              ))}
            </div>
          </fieldset>
          {kind === "project" && (
            <label className="block">
              <span className="m-label">{t.share.pickProject}</span>
              <select className="m-field" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                {snap.projects.sort(bySort).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
          )}
          {kind === "habit" && (
            <label className="block">
              <span className="m-label">{t.share.pickHabit}</span>
              <select className="m-field" value={habitId} onChange={(e) => setHabitId(e.target.value)}>
                {snap.habits.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </label>
          )}
          {kind === "milestone" && (
            <label className="block">
              <span className="m-label">{t.share.pickMilestone}</span>
              <select className="m-field" value={milestoneId} onChange={(e) => setMilestoneId(e.target.value)}>
                {snap.rewards.map((r) => <option key={r.milestoneId} value={r.milestoneId}>{MILESTONES.find((m) => m.id === r.milestoneId)?.title}</option>)}
              </select>
            </label>
          )}
          {kind === "book" && (
            <label className="block">
              <span className="m-label">{t.share.pickBook}</span>
              <select className="m-field" value={bookId} onChange={(e) => setBookId(e.target.value)}>
                {finishedBooks.map((e) => <option key={e.book.id} value={e.book.id}>{e.book.title}</option>)}
              </select>
            </label>
          )}
          <fieldset className="space-y-2">
            <legend className="m-label">{t.share.reveal}</legend>
            <label className="flex items-center justify-between gap-3"><span>{t.share.showName}</span><input type="checkbox" className="size-5 accent-[var(--m-gold)]" checked={showName} onChange={(e) => setShowName(e.target.checked)} /></label>
            {kind === "week" && <label className="flex items-center justify-between gap-3"><span>{t.share.showDelta}</span><input type="checkbox" className="size-5 accent-[var(--m-gold)]" checked={showDelta} onChange={(e) => setShowDelta(e.target.checked)} /></label>}
          </fieldset>
          <label className="block">
            <span className="m-label">{t.share.closing}</span>
            <select className="m-field" value={closing} onChange={(e) => setClosing(e.target.value)}>
              {t.share.closings.map((c) => <option key={c} value={c}>{c || t.share.noClosing}</option>)}
            </select>
          </label>
        </section>

        <section className="space-y-3">
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={I.format}>
            {(["story", "card"] as const).map((f) => (
              <button key={f} type="button" role="radio" aria-checked={format === f} className="m-option min-h-10 px-3 text-sm font-semibold" onClick={() => setFormat(f)}>
                {f === "story" ? I.story : I.card}
              </button>
            ))}
          </div>
          {payload ? (
            <div className={`mx-auto overflow-hidden rounded-3xl bg-[#0d0c0b] shadow-xl ${format === "story" ? "aspect-[9/16] max-w-[min(100%,340px)]" : "aspect-[4/5] max-w-[min(100%,420px)]"}`}>
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt={I.preview} className="size-full object-contain" />
              ) : (
                <div className="grid size-full place-items-center text-sm text-[#efcd7e]" role="status">{I.preview}…</div>
              )}
            </div>
          ) : (
            <p className="m-card p-6 text-center m-muted">{t.reports.noData}</p>
          )}
          {/* Instagram and the link to my page, side by side */}
          <div className="m-btn-pair grid grid-cols-2 gap-2">
            <button type="button" className="m-btn m-btn-primary" disabled={!payload || busy} onClick={instagram}>
              <Icon name="camera" size={18} /> {I.button}
            </button>
            <button type="button" className="m-btn m-btn-ghost" disabled={!link} onClick={() => copyLink()}>
              <Icon name="link" size={18} /> {I.copyLink}
            </button>
          </div>
          {link ? (
            <div className="m-card space-y-2 p-3 text-sm">
              <p className="m-label !mb-0">{I.yourLink}</p>
              <p className="select-all break-all rounded-lg bg-[var(--m-surface-2)] px-2 py-1.5 text-xs" dir="ltr">{link}</p>
              <p className="font-semibold">{I.stepsTitle}</p>
              <ol className="list-inside list-decimal space-y-1 m-muted">
                {I.steps.map((s) => <li key={s}>{s}</li>)}
              </ol>
            </div>
          ) : (
            <p className="m-hint">{I.noUsername}</p>
          )}
          <div className="grid gap-2 sm:grid-cols-3">
            <button type="button" className="m-btn m-btn-ghost" disabled={!payload} onClick={nativeShare}><Icon name="globe" size={18} /> {t.share.nativeShare}</button>
            <button type="button" className="m-btn m-btn-ghost" disabled={!payload} onClick={async () => download(await png())}><Icon name="arrowDown" size={18} /> {t.share.download}</button>
            <button type="button" className="m-btn m-btn-ghost" disabled={!payload || busy || !snap.privacy.community} onClick={post}><Icon name="sparkle" size={18} /> {t.share.toCommunity}</button>
          </div>
          {!snap.privacy.community && <p className="text-sm m-muted">{t.share.needCommunity}</p>}
          {!showName && kind && <p className="sr-only">{t.share.showName}</p>}
        </section>
      </div>
    </div>
  );
}
