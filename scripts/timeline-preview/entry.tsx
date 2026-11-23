// «حيدرة كت»'s timeline alone in a plain browser page, with a made-up project of many tracks (driven by run.mjs):
// the buttons and drags send real commands through `apply`, so what the page shows is what the editor would.
import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import Timeline, { type PlayerLike } from "@/components/jawad/editor/Timeline";
import type { EditorAsset } from "@/components/jawad/editor/types";
import type { SyncFlag } from "@/components/jawad/editor/sync";
import { apply, type Command } from "@/lib/editor/commands";
import { readTimeline, type Timeline as TL } from "@/lib/editor/model";
import "@/app/jawad-ai/jawad.css";
import "@/app/jawad-ai/sections.css";

declare global {
  interface Window {
    __tl: TL;
    __sel: string[];
    __labels: string[];
    __seek: (ms: number) => void;
    __flags: (f: Record<string, SyncFlag>) => void;
  }
}

const asset = (id: string, kind: "video" | "audio", sec: number): EditorAsset => ({ id, kind, name: `${id}.mp4`, durationMs: sec * 1000, width: 1920, height: 1080, hasAudio: true, status: "ready", url: "about:blank" }) as unknown as EditorAsset;
const clip = (id: string, assetId: string, start: number, sec: number) => ({ id, assetId, start, in: 0, out: sec * 1000, speed: 1 });

// a poem: one long sound, a main picture track, and N camera tracks of short clips
const cams = Number(new URLSearchParams(location.search).get("cams") ?? 8);
const assets: EditorAsset[] = [asset("poem", "audio", 240), asset("main", "video", 240)];
const tracks: unknown[] = [{ id: "main", kind: "video", name: "الرئيسي", clips: [clip("m1", "main", 0, 60), clip("m2", "main", 60_000, 60)] }];
for (let i = 0; i < cams; i++) {
  assets.push(asset(`cam${i}`, "video", 40));
  tracks.push({ id: `v${i}`, kind: "video", name: `كاميرا ${i + 1}`, clips: [clip(`c${i}a`, `cam${i}`, 5000 + i * 9000, 12), clip(`c${i}b`, `cam${i}`, 30_000 + i * 9000, 10)] });
}
tracks.push({ id: "a0", kind: "audio", name: "القصيدة", clips: [clip("p", "poem", 0, 240)] });
tracks.push({ id: "a1", kind: "audio", name: "صوت 2", clips: [clip("s1", "poem", 10_000, 20)] });
tracks.push({ id: "a2", kind: "audio", name: "صوت 3", clips: [] });
const first = readTimeline({ width: 1920, height: 1080, fps: 30, magnetic: false, tracks });

function App() {
  const [tl, setTl] = useState(first);
  const [selected, setSelected] = useState<string[]>([]);
  const [flags, setFlags] = useState<Record<string, SyncFlag>>({});
  const [full, setFull] = useState(false);
  const map = useMemo(() => new Map(assets.map((a) => [a.id, a])), []);
  const info = useMemo(() => new Map(assets.map((a) => [a.id, { kind: a.kind, durationMs: a.durationMs, hasAudio: true }])), []);
  const subs = useRef(new Set<(ms: number, playing: boolean) => void>());
  const now = useRef(0);
  const player = useMemo<PlayerLike>(
    () => ({
      get ms() {
        return now.current;
      },
      playing: false,
      seek(ms) {
        now.current = ms;
        for (const f of subs.current) f(ms, false);
      },
      pause() {},
      subscribe(fn) {
        subs.current.add(fn);
        return () => subs.current.delete(fn);
      },
    }),
    [],
  );
  // what run.mjs reads and drives
  useEffect(() => {
    window.__tl = tl;
    window.__sel = selected;
    window.__labels ??= [];
    window.__seek = (ms) => player.seek(ms);
    window.__flags = setFlags;
  }, [tl, selected, player]);
  const run = (cmd: Command | Command[], opts?: { label?: string }) => {
    let t = tl;
    try {
      for (const c of Array.isArray(cmd) ? cmd : [cmd]) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r = apply(t, c, info as any);
        t = r.timeline;
        window.__labels.push(opts?.label ?? r.label);
      }
      setTl(t);
    } catch (e) {
      window.__labels.push(`ERROR ${e instanceof Error ? e.message : e}`);
    }
  };
  return (
    <div className="jw" style={{ height: "100vh" }}>
      <div className="jw-sec relative flex h-full flex-col" data-jw-section="editor" data-ed-theme="dark">
        {!full && <div className="grid flex-1 place-items-center text-sm text-jw-muted">الشاشة</div>}
        <div className={full ? "absolute inset-0 z-[55] flex flex-col" : "flex h-[60%] flex-col"}>
          <Timeline tl={tl} assets={map} thumbs={{}} waves={{}} selected={selected} onSelect={setSelected} run={run} player={player} compact={false} readOnly={false} onEmpty={() => {}} onTransition={() => {}} onDropFiles={() => {}} onDropAsset={() => {}} flags={flags} onFlags={setFlags} full={full} onFull={() => setFull((v) => !v)} />
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
