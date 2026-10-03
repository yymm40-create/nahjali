"use client";

import { useState } from "react";
import { MILESTONES } from "@config/mahdi-rewards";
import { t } from "@/lib/mahdi/i18n";
import { bySort } from "@/lib/mahdi/client/derive";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import { buildShare, SHARE_KINDS, type ShareKind } from "@/lib/mahdi/client/share";
import Icon from "@/components/mahdi/Icon";
import { useMahdi } from "@/components/mahdi/Provider";
import { renderCardPng, ShareCardView } from "@/components/mahdi/ShareCard";
import { useLook } from "@/components/mahdi/ThemeRoot";

/** «شارك إنجازي»: pick what to share and what to reveal, then save, share or post to the community. */
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
  const [closing, setClosing] = useState("");
  const [busy, setBusy] = useState(false);
  const payload = buildShare(timeline, snap, { kind, showDelta, projectId, habitId, milestoneId });
  const name = showName ? snap.profile.displayName : undefined;
  const image = shrine?.imageUrl ?? null;

  async function png() {
    const css = getComputedStyle(document.querySelector(".mahdi-root")!);
    return renderCardPng(payload!, { name, closing, image, fonts: { sans: css.getPropertyValue("--font-plex") || "sans-serif", display: css.getPropertyValue("--font-amiri") || "serif" } });
  }

  async function nativeShare() {
    const file = new File([await png()], "lajl-almahdi.png", { type: "image/png" });
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
      await mahdiFetch("/api/mahdi/community/posts", { method: "POST", json: { kind, showDelta, projectId, habitId, milestoneId, closing } });
      toast(t.share.posted);
    } catch (e) {
      toast((e as Error).message);
    }
    setBusy(false);
  }

  const kinds = SHARE_KINDS.filter((k) => (k === "milestone" ? snap.rewards.length > 0 : k === "project" ? snap.projects.length > 0 : k === "habit" ? snap.habits.length > 0 : true));

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
          {payload ? <ShareCardView payload={payload} name={name} closing={closing} image={image} /> : <p className="m-card p-6 text-center m-muted">{t.reports.noData}</p>}
          <div className="grid gap-2 sm:grid-cols-3">
            <button type="button" className="m-btn m-btn-primary" disabled={!payload} onClick={nativeShare}><Icon name="globe" size={18} /> {t.share.nativeShare}</button>
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
