"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Icon from "../Icon";
import { adminPost } from "./client";

export interface AdminSection {
  id: string;
  name: string;
  icon: string;
  implementation: string;
  sort: number;
  enabled: boolean;
  builtIn: boolean;
  overridden: boolean;
}

export default function SectionsAdmin({ sections, icons, implementations }: { sections: AdminSection[]; icons: string[]; implementations: { key: string; label: string }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      router.refresh();
      setAdding(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-jw-muted">
        الشريط يُبنى من هذه القائمة: أي قسم مفعّل يظهر تلقائيًا بترتيبه. إضافة قسم لا تنشئ وظيفة جديدة؛ لازم يرتبط بمكوّن منفّذ (استوديو صور أو فيديو أو صوت)، والمولدات تُنقل إليه من صفحة «المولدات».
      </p>
      {error && <p className="error-box" role="alert">{error}</p>}
      <div className="space-y-3">
        {sections.map((s) => (
          <SectionRow key={s.id} s={s} icons={icons} implementations={implementations} busy={busy} run={run} />
        ))}
      </div>
      {adding ? (
        <SectionRow
          s={{ id: "", name: "", icon: "sparkles", implementation: "studio:image", sort: 100, enabled: false, builtIn: false, overridden: false }}
          isNew
          icons={icons}
          implementations={implementations.filter((i) => i.key !== "film")}
          busy={busy}
          run={run}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button type="button" className="jw-btn" onClick={() => setAdding(true)}><Icon name="plus" size={16} /> قسم جديد</button>
      )}
    </div>
  );
}

function SectionRow({
  s,
  icons,
  implementations,
  busy,
  run,
  isNew = false,
  onCancel,
}: {
  s: AdminSection;
  icons: string[];
  implementations: { key: string; label: string }[];
  busy: boolean;
  run: (fn: () => Promise<unknown>) => Promise<void>;
  isNew?: boolean;
  onCancel?: () => void;
}) {
  const [v, setV] = useState(s);
  const dirty = isNew || JSON.stringify(v) !== JSON.stringify(s);
  return (
    <div className="jw-panel grid items-end gap-3 p-4 sm:grid-cols-[auto_1fr_1fr_6rem_auto]">
      <span className="grid size-10 place-items-center rounded-xl bg-jw-accent-soft text-jw-accent"><Icon name={v.icon} size={20} /></span>
      <label>
        <span className="jw-label">الاسم</span>
        <input className="jw-input" value={v.name} maxLength={40} onChange={(e) => setV({ ...v, name: e.target.value })} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label>
          <span className="jw-label">الأيقونة</span>
          <select className="jw-select" value={v.icon} onChange={(e) => setV({ ...v, icon: e.target.value })}>
            {icons.map((i) => (
              <option key={i} value={i}>{i}</option>
            ))}
          </select>
        </label>
        {isNew ? (
          <label>
            <span className="jw-label">المعرّف (المسار)</span>
            <input className="jw-input" dir="ltr" placeholder="products" value={v.id} onChange={(e) => setV({ ...v, id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} />
          </label>
        ) : (
          <div>
            <span className="jw-label">المسار</span>
            <p className="truncate py-2 text-xs text-jw-muted" dir="ltr">{v.implementation === "film" ? "/jawad-ai/film" : `/jawad-ai/${v.id}`}</p>
          </div>
        )}
      </div>
      <label>
        <span className="jw-label">الترتيب</span>
        <input className="jw-input" inputMode="numeric" dir="ltr" value={v.sort} onChange={(e) => setV({ ...v, sort: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
      </label>
      <label className="flex items-center gap-2 pb-2">
        <input type="checkbox" checked={v.enabled} onChange={(e) => setV({ ...v, enabled: e.target.checked })} className="size-4 accent-[var(--jw-accent)]" />
        <span className="text-sm">مفعّل</span>
      </label>
      <div className="flex flex-wrap items-center gap-2 sm:col-span-5">
        {isNew ? (
          <label className="flex items-center gap-2 text-sm">
            المكوّن المنفّذ:
            <select className="jw-select w-auto" value={v.implementation} onChange={(e) => setV({ ...v, implementation: e.target.value })}>
              {implementations.map((i) => (
                <option key={i.key} value={i.key}>{i.label}</option>
              ))}
            </select>
          </label>
        ) : (
          <span className="jw-chip">{implementations.find((i) => i.key === v.implementation)?.label ?? v.implementation}</span>
        )}
        {s.builtIn && <span className="jw-chip">أساسي</span>}
        <div className="ms-auto flex gap-2">
          {onCancel && <button type="button" className="jw-btn jw-btn-quiet" onClick={onCancel}>إلغاء</button>}
          {!isNew && (s.overridden || !s.builtIn) && (
            <button type="button" className="jw-btn jw-btn-quiet" disabled={busy} onClick={() => run(() => adminPost("section_delete", { id: s.id }))}>
              {s.builtIn ? "رجوع للافتراضي" : "حذف القسم"}
            </button>
          )}
          <button type="button" className="jw-btn jw-btn-primary" disabled={busy || !dirty} onClick={() => run(() => adminPost("section_save", { ...v, isNew }))}>
            {isNew ? "أضف القسم" : "احفظ"}
          </button>
        </div>
      </div>
    </div>
  );
}
