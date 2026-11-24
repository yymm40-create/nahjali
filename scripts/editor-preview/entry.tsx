// The whole «حيدرة كت» editor in a plain browser page with a made-up project (no sign-in, no database), for
// looking at the interface: node scripts/editor-preview/run.mjs [outDir]. Its calls to the site's API answer 404,
// which the editor lives with (nothing is saved, no file plays).
import { createRoot } from "react-dom/client";
import Editor from "@/components/jawad/editor/Editor";
import type { EditorAsset, EditorProjectView } from "@/components/jawad/editor/types";
import { readTimeline } from "@/lib/editor/model";
import "@/app/jawad-ai/jawad.css";
import "@/app/jawad-ai/sections.css";

// ?media=1: the cameras are real little videos (run.mjs makes them), so the picture and «شبكة الكاميرات» can be tried
const media = new URLSearchParams(location.search).has("media");
let made = 0;
const asset = (id: string, kind: "video" | "audio", sec: number): EditorAsset => ({ id, kind, name: `${id}.mp4`, durationMs: sec * 1000, width: 1080, height: 1920, hasAudio: !media, status: "ready", url: media && kind === "video" ? `/cam${made++ % 8}.webm` : null }) as unknown as EditorAsset;
const clip = (id: string, assetId: string, start: number, sec: number, more: object = {}) => ({ id, assetId, start, in: 0, out: sec * 1000, speed: 1, ...more });
const cams = 7;
const assets: EditorAsset[] = [asset("القصيدة", "audio", 200), asset("الافتتاحية", "video", 200)];
const tracks: unknown[] = [{ id: "main", kind: "video", name: "الرئيسي", clips: [clip("m1", "الافتتاحية", 0, 46), clip("m2", "الافتتاحية", 46_000, 60)] }];
const colours = ["#ef4444", "#f59e0b", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899"];
for (let i = 0; i < cams; i++) {
  assets.push(asset(`كاميرا ${i + 1}`, "video", 40));
  tracks.push({ id: `v${i}`, kind: "video", name: `كاميرا ${i + 1}`, clips: [clip(`c${i}a`, `كاميرا ${i + 1}`, 4000 + i * 5000, 30, { label: colours[i] }), clip(`c${i}b`, `كاميرا ${i + 1}`, 104_000 + i * 12_000, 13, { label: colours[i] })] });
}
tracks.push({ id: "t0", kind: "text", name: "نص", clips: [{ id: "tx", assetId: null, start: 2000, in: 0, out: 5000, speed: 1, text: { body: "يا ليلة القدر" } }] });
tracks.push({ id: "a0", kind: "audio", name: "القصيدة", clips: [clip("p", "القصيدة", 0, 200)] });
const timeline = readTimeline({ width: 1080, height: 1920, fps: 30, magnetic: false, tracks });
const project = { id: "preview", title: "قصيدة ليلة القدر", kind: "reel", clips: 17, updatedAt: new Date().toISOString(), filmProjectId: null, purged: false, version: 1, timeline } as unknown as EditorProjectView;

createRoot(document.getElementById("root")!).render(
  <div className="jw" dir="rtl" lang="ar">
    <main id="jw-main">
      <div className="jw-sec" data-jw-section="editor">
        <Editor project={project} initialAssets={assets} exportUrl={null} backHref="/" />
      </div>
    </main>
  </div>,
);
