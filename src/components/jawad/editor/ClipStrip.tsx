"use client";

// «شريط اللقطات» at the top of the colour room: every picture and video of the cut as a thumbnail with its number, its
// track, its start timecode and a ◆ when it already has a grade. A press selects the clip (and puts the playhead in it),
// so grading one shot after another is a row of presses.

import { clipLength, formatTime, type Timeline } from "@/lib/editor/model";
import type { Player } from "./player";

export default function ClipStrip({ tl, assets, thumbs, selected, onPick, player }: { tl: Timeline; assets: Map<string, { id: string; kind: string }>; thumbs: Record<string, string | null>; selected: string[]; onPick: (ids: string[]) => void; player: Player | null }) {
  const labels = new Map<string, string>();
  tl.tracks.filter((t) => t.kind === "video").forEach((t, i) => labels.set(t.id, `V${i + 1}`));
  const clips = tl.tracks
    .filter((t) => t.kind === "video")
    .flatMap((t) => t.clips.filter((c) => !c.text && assets.get(c.assetId ?? "")?.kind !== "audio").map((c) => ({ c, label: labels.get(t.id) ?? "V" })))
    .sort((a, b) => a.c.start - b.c.start);
  return (
    <div className="room-strip" role="listbox" aria-label="لقطات المشروع">
      <div className="room-strip-head">
        <b>اللقطات</b>
        <span className="num">{clips.length} CLIPS</span>
      </div>
      {clips.map(({ c, label }, i) => {
        const thumb = c.assetId ? thumbs[c.assetId] : null;
        const on = selected.includes(c.id);
        const graded = c.grades.some((g) => g.on);
        return (
          <button
            key={c.id}
            type="button"
            role="option"
            aria-selected={on}
            className={`room-clip ${on ? "on" : ""}`}
            onClick={() => {
              onPick([c.id]);
              player?.seek(c.start + Math.min(400, clipLength(c) / 2));
            }}
            title={`لقطة ${i + 1} · ${formatTime(c.start)}`}
          >
            <span className="pic" style={thumb ? { backgroundImage: `url(${thumb})` } : undefined} />
            <span className="meta num">
              <span>{String(i + 1).padStart(2, "0")}</span>
              <span>
                {graded ? "◆ " : ""}
                {label}
              </span>
              <span>{formatTime(c.start)}</span>
            </span>
          </button>
        );
      })}
      {clips.length === 0 && <span className="room-empty">ما فيه لقطات على التايملاين بعد.</span>}
    </div>
  );
}
