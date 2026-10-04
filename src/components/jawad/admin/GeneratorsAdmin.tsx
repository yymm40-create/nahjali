"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Icon from "../Icon";
import { adminPost, uploadPublic } from "./client";

export interface AdminGenerator {
  id: string;
  defaultName: string;
  displayName: string;
  provider: string;
  model: string;
  output: string;
  sectionId: string;
  sort: number;
  enabled: boolean;
  sampleUrl: string | null;
  keyConfigured: boolean;
  live: boolean;
  reason: string | null;
  sections: { id: string; name: string }[];
}

export default function GeneratorsAdmin({ generators }: { generators: AdminGenerator[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-4">
      {error && <p className="error-box" role="alert">{error}</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        {generators.map((g) => (
          <GenEditor key={g.id} g={g} busy={busy} run={run} />
        ))}
      </div>
    </div>
  );
}

function GenEditor({ g, busy, run }: { g: AdminGenerator; busy: boolean; run: (fn: () => Promise<unknown>) => Promise<void> }) {
  const [v, setV] = useState({ displayName: g.displayName, sectionId: g.sectionId, sort: g.sort, enabled: g.enabled });
  const [progress, setProgress] = useState<number | null>(null);
  const dirty = v.displayName !== g.displayName || v.sectionId !== g.sectionId || v.sort !== g.sort || v.enabled !== g.enabled;
  return (
    <article className="jw-panel overflow-hidden">
      <div className="relative aspect-[16/7] bg-jw-bg-2">
        {g.sampleUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={g.sampleUrl} alt="" className="size-full object-cover" />
        ) : (
          <span className="grid size-full place-items-center text-xs text-jw-faint">لا توجد صورة نموذجية</span>
        )}
        {progress != null && <span className="absolute inset-x-0 bottom-0 h-1 bg-jw-accent" style={{ width: `${Math.round(progress * 100)}%` }} />}
      </div>
      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold" dir="ltr">{g.defaultName}</span>
          <span className="jw-chip" dir="ltr">{g.provider} · {g.model}</span>
          <span className={`jw-chip ${g.live ? "text-jw-ok" : "text-jw-warn"}`}>{g.live ? "متاح للمستخدمين" : "غير متاح للمستخدمين"}</span>
          <span className={`jw-chip ${g.keyConfigured ? "" : "text-jw-danger"}`}>{g.keyConfigured ? "المفتاح موجود" : "المفتاح غير موجود"}</span>
        </div>
        {g.reason && <p className="text-xs text-jw-muted">{g.reason}</p>}
        <div className="flex flex-wrap gap-2">
          <label className="jw-btn cursor-pointer">
            <Icon name="upload" size={16} /> {g.sampleUrl ? "استبدل الصورة النموذجية" : "ارفع صورة نموذجية"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f)
                  run(async () => {
                    try {
                      await adminPost("generator_sample", { id: g.id, path: await uploadPublic("sample", g.id, f, setProgress) });
                    } finally {
                      setProgress(null);
                    }
                  });
              }}
            />
          </label>
          {g.sampleUrl && (
            <button type="button" className="jw-btn jw-btn-quiet" disabled={busy} onClick={() => run(() => adminPost("generator_sample", { id: g.id, path: null }))}>
              إزالة
            </button>
          )}
        </div>
        <p className="text-[11px] text-jw-faint">الصورة النموذجية: صورة أو لقطة صنعها هذا المولد نفسه (وليست شعار الشركة).</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="sm:col-span-3">
            <span className="jw-label">الاسم الظاهر</span>
            <input className="jw-input" dir="auto" placeholder={g.defaultName} maxLength={60} value={v.displayName} onChange={(e) => setV({ ...v, displayName: e.target.value })} />
          </label>
          <label className="sm:col-span-2">
            <span className="jw-label">القسم</span>
            <select className="jw-select" value={v.sectionId} onChange={(e) => setV({ ...v, sectionId: e.target.value })}>
              {g.sections.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="jw-label">الترتيب</span>
            <input className="jw-input" inputMode="numeric" dir="ltr" value={v.sort} onChange={(e) => setV({ ...v, sort: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
          </label>
        </div>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={v.enabled} onChange={(e) => setV({ ...v, enabled: e.target.checked })} className="size-4 accent-[var(--jw-accent)]" />
          <span className="text-sm">مفعّل للمستخدمين</span>
        </label>
        <p className="text-[11px] text-jw-faint">جرّبه أولًا من الاستوديو (يظهر لك وحدك وهو مخفي، ولا يُخصم منك)، ثم فعّله.</p>
        <div className="flex justify-end border-t border-jw-line pt-3">
          <button type="button" className="jw-btn jw-btn-primary" disabled={busy || !dirty} onClick={() => run(() => adminPost("generator_save", { id: g.id, ...v }))}>
            احفظ
          </button>
        </div>
      </div>
    </article>
  );
}
