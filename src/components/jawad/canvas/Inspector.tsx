"use client";

// «اللوحة»: the selected node's settings (a side panel on a computer, a sheet from the bottom on a phone) — its name,
// its words, its picture, its generator with the generator's own options (the studio's OutputSettings), the style or
// «ذوقي», «هويتي», and its wires as plain lists, so a phone can wire a canvas without dragging.

import { generatorById } from "@config/jawad/generators";
import { MANUAL_TOOL_ID, NODE_KINDS, TYPE_AR, wireProblem, type CanvasEdge, type CanvasNode, type NodeData } from "@config/jawad/canvas";
import type { SettingValue } from "@config/jawad/types";
import type { Evaluation } from "@/lib/jawad/engine";
import type { LookState } from "@/lib/jawad/server/taste";
import Riyal from "@/components/Riyal";
import Icon from "../Icon";
import OutputSettings from "../studio/OutputSettings";
import StylePicker from "../studio/StylePicker";
import type { StudioGenerator } from "../studio/types";
import { MediaThumb, type Media } from "./NodeCard";

export default function Inspector({
  node,
  nodes,
  edges,
  generators,
  ev,
  price,
  owner,
  look,
  media,
  uploading,
  onData,
  onDelete,
  onDuplicate,
  onDisconnect,
  onConnect,
  onUpload,
  onClose,
}: {
  node: CanvasNode;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  /** the generators this node may use */
  generators: StudioGenerator[];
  ev: Evaluation | null;
  price: number | null;
  owner: boolean;
  look: LookState | null;
  media: Media | null;
  uploading: string;
  onData: (patch: Partial<NodeData>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onDisconnect: (edgeId: string) => void;
  onConnect: (from: string, to: string, port: string) => void;
  onUpload: (file: File) => void;
  onClose: () => void;
}) {
  const def = NODE_KINDS[node.kind];
  const gdef = node.data.generatorId ? generatorById(node.data.generatorId) : undefined;
  const titleOf = (n: CanvasNode) => n.data.title || NODE_KINDS[n.kind].label;

  return (
    <aside className="cv-inspector" dir="rtl" aria-label={`إعدادات «${titleOf(node)}»`} data-scroll>
      <div className="cv-insp-head">
        <span className="cv-icon"><Icon name={def.icon} size={16} /></span>
        <input className="jw-input !min-h-9 flex-1 text-sm" value={node.data.title ?? ""} placeholder={def.label} maxLength={40} onChange={(e) => onData({ title: e.target.value })} aria-label="اسم العقدة" />
        <button type="button" className="jw-btn jw-btn-icon" onClick={onClose} aria-label="سكّر">
          <Icon name="x" size={16} />
        </button>
      </div>
      <div className="cv-insp-body jw-scroll">
        <p className="text-xs text-jw-muted">{def.hint}</p>

        {node.kind === "text" && (
          <label className="block">
            <span className="jw-label">النص</span>
            <textarea className="jw-textarea min-h-36 text-sm" value={node.data.text ?? ""} maxLength={4000} onChange={(e) => onData({ text: e.target.value })} placeholder="اكتب الوصف… يدخل في برومبت كل مولّد توصله فيه." />
          </label>
        )}

        {node.kind === "upload" && (
          <div className="space-y-2">
            {media && <MediaThumb m={media} big />}
            <label className="jw-btn w-full cursor-pointer gap-1.5">
              <Icon name="upload" size={15} /> {node.data.uploadId ? "غيّر الصورة" : "ارفع صورة"}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={Boolean(uploading)} onChange={(e) => (e.target.files?.[0] && onUpload(e.target.files[0]), (e.target.value = ""))} />
            </label>
            {uploading && <p className="text-xs text-jw-muted">{uploading}</p>}
          </div>
        )}

        {def.runs && (
          <div className="space-y-4">
            <label className="block">
              <span className="jw-label">{node.kind === "tool" ? "الأداة" : "المولّد"}</span>
              <select className="jw-select w-full" value={node.data.generatorId ?? ""} onChange={(e) => onData({ generatorId: e.target.value, settings: {} })}>
                {!node.data.generatorId && <option value="">اختر…</option>}
                {generators.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                    {!g.live ? " (للمالك)" : ""}
                  </option>
                ))}
              </select>
              {!generators.length && <span className="mt-1 block text-xs text-jw-danger">ما فيه مولّد متاح لحسابك من هالنوع.</span>}
            </label>
            {gdef && gdef.prompt.max > 0 && (
              <label className="block">
                <span className="jw-label">{node.kind === "tool" ? gdef.prompt.label : "كلام زيادة (بعد اللي يجي من الأسلاك)"}</span>
                <textarea className="jw-textarea min-h-20 text-sm" value={node.data.text ?? ""} maxLength={4000} placeholder={gdef.prompt.placeholder} onChange={(e) => onData({ text: e.target.value })} />
              </label>
            )}
            {node.kind === "video" && (
              <div>
                <span className="jw-label">الصور الموصولة</span>
                <div className="jw-seg" role="radiogroup">
                  {(["first_frame", "reference"] as const).map((v) => (
                    <button key={v} type="button" role="radio" aria-checked={(node.data.imageAs ?? "first_frame") === v} onClick={() => onData({ imageAs: v })}>
                      {v === "first_frame" ? "أول لقطة (والثانية آخر لقطة)" : "مراجع"}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {node.data.generatorId === MANUAL_TOOL_ID && <p className="rounded-lg bg-jw-surface-2 p-2 text-xs text-jw-muted">«امسح/عدّل» يحتاج تلوّن الجزء بيدك، فما يشتغل مع «شغّل الكل»: اضغط «لوّن وشغّل» على العقدة.</p>}
            {ev && <OutputSettings ev={ev} values={ev.settings} onChange={(k: string, v: SettingValue) => onData({ settings: { ...(node.data.settings ?? {}), [k]: v } })} />}
            {ev && ev.issues.length > 0 && (
              <ul className="space-y-1 text-xs text-jw-warn">
                {ev.issues.slice(0, 3).map((i) => <li key={i.field + i.message}>{i.message}</li>)}
              </ul>
            )}
            {price != null && (
              <p className="flex items-center gap-1.5 text-sm">
                {owner ? "قيمتها" : "سعرها"}: <Riyal halalas={price} size={13} free={owner} />
                <span className="text-xs text-jw-muted">(تقريبي إذا مداخلها ما انصنعت بعد)</span>
              </p>
            )}
            {media && <MediaThumb m={media} big />}
            {media?.downloadUrl && (
              <a className="jw-btn w-full gap-1.5" href={media.downloadUrl}>
                <Icon name="download" size={15} /> نزّل النتيجة
              </a>
            )}
          </div>
        )}

        {node.kind === "style" && (
          <div className="space-y-3">
            <StylePicker value={node.data.styleId ?? ""} onChange={(id) => onData({ styleId: id || undefined, tasteId: undefined })} />
            {look?.migrated && look.tastes.length > 0 && (
              <label className="block">
                <span className="jw-label">أو واحد من «🎨 ذوقي»</span>
                <select className="jw-select w-full" value={node.data.tasteId ?? ""} onChange={(e) => onData({ tasteId: e.target.value || undefined, styleId: undefined })}>
                  <option value="">—</option>
                  {look.tastes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </label>
            )}
          </div>
        )}

        {node.kind === "brand" && (
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={Boolean(node.data.logo)} onChange={(e) => onData({ logo: e.target.checked })} /> حط الشعار بعد (للصور اللي تاخذ مراجع)
            </label>
            {look && (!look.migrated || (!look.brand.colors.length && !look.brand.fonts.length && !look.brand.voice && !look.brand.logo)) && <p className="text-xs text-jw-warn">ما حفظت «هويتي» بعد: احفظها من الاستوديو (تحت البرومبت) وترجع تشتغل هنا.</p>}
          </div>
        )}

        {node.kind === "result" && media === null && <p className="text-xs text-jw-muted">النتائج تطلع هنا وفي «أعمالي» بالاستوديو.</p>}

        {def.inputs.length > 0 && (
          <section className="space-y-2 border-t border-jw-line pt-3">
            <p className="text-sm font-semibold">الأسلاك</p>
            {def.inputs.map((p) => {
              const wires = edges.filter((e) => e.to === node.id && e.port === p.id);
              const options = nodes.filter((n) => n.id !== node.id && !wireProblem({ nodes, edges }, n.id, node.id, p.id));
              return (
                <div key={p.id} className="rounded-lg border border-jw-line p-2">
                  <p className="mb-1 text-xs text-jw-muted">
                    {p.label} · ياخذ {p.accepts.map((t) => TYPE_AR[t]).join(" أو ")}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {wires.map((w) => {
                      const src = nodes.find((n) => n.id === w.from);
                      return (
                        <span key={w.id} className="jw-chip gap-1 text-xs">
                          {src ? titleOf(src) : "؟"}
                          <button type="button" onClick={() => onDisconnect(w.id)} aria-label="شيل السلك">
                            <Icon name="x" size={12} />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                  {options.length > 0 && (
                    <select className="jw-select mt-1 w-full !min-h-8 text-xs" value="" onChange={(e) => e.target.value && onConnect(e.target.value, node.id, p.id)}>
                      <option value="">وصّل من…</option>
                      {options.map((n) => <option key={n.id} value={n.id}>{titleOf(n)}</option>)}
                    </select>
                  )}
                </div>
              );
            })}
          </section>
        )}

        <div className="flex gap-2 border-t border-jw-line pt-3">
          <button type="button" className="jw-btn flex-1 gap-1.5" onClick={onDuplicate}>
            <Icon name="copy" size={15} /> نسخة
          </button>
          <button type="button" className="jw-btn flex-1 gap-1.5 text-jw-danger" onClick={onDelete}>
            <Icon name="trash" size={15} /> احذف
          </button>
        </div>
      </div>
    </aside>
  );
}
