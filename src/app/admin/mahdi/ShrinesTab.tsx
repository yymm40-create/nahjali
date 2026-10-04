"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { postJson } from "@/lib/fetch";
import { t } from "@/lib/mahdi/i18n";

const S = t.admin.shrines;

export interface ShrineAdmin {
  id: string;
  name: string;
  place: string;
  imageUrl: string | null;
  active: boolean;
  /** The researched description GPT Image 2 is given (editable). */
  prompt: string;
}

/** The shrines' pictures: generate with GPT Image 2, look, approve (then users see it) or make another. */
export default function ShrinesTab({ shrines }: { shrines: ShrineAdmin[] }) {
  return (
    <section className="card space-y-3 p-4">
      <h2 className="text-xl font-extrabold">{t.admin.tabs.shrines}</h2>
      <p className="text-sm font-bold text-muted">{S.intro}</p>
      <ul className="space-y-4">
        {shrines.map((s) => (
          <ShrineRow key={s.id} s={s} />
        ))}
      </ul>
    </section>
  );
}

function ShrineRow({ s }: { s: ShrineAdmin }) {
  const router = useRouter();
  const [prompt, setPrompt] = useState(s.prompt);
  const [draft, setDraft] = useState<{ path: string; url: string } | null>(null);
  const [busy, setBusy] = useState<"gen" | "ok" | "active" | null>(null);
  const [error, setError] = useState("");

  async function run(kind: "gen" | "ok" | "active", body: Record<string, unknown>) {
    setBusy(kind);
    setError("");
    try {
      const r = await postJson<{ draft?: { path: string; url: string } }>("/api/admin/mahdi", body);
      if (kind === "gen" && r.draft) setDraft(r.draft);
      if (kind === "ok") setDraft(null);
      if (kind !== "gen") router.refresh();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(null);
  }

  return (
    <li className="space-y-2 rounded-2xl bg-surface-2 px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-extrabold">
          {s.name} <span className="text-sm text-muted">· {s.place}</span>
        </p>
        <span className={`chip text-sm ${s.active && s.imageUrl ? "ring-2 ring-gold" : ""}`}>{s.imageUrl ? (s.active ? S.shown : S.hidden) : S.noImage}</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {s.imageUrl && (
          <figure className="space-y-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.imageUrl} alt="" className="aspect-[3/2] w-full rounded-xl object-cover" />
            <figcaption className="text-xs font-bold text-muted">{S.current}</figcaption>
          </figure>
        )}
        {draft && (
          <figure className="space-y-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={draft.url} alt="" className="aspect-[3/2] w-full rounded-xl object-cover ring-2 ring-gold" />
            <figcaption className="text-xs font-bold text-muted">{S.draft}</figcaption>
          </figure>
        )}
      </div>
      {s.prompt && (
        <details>
          <summary className="cursor-pointer text-sm font-bold">{S.description}</summary>
          <textarea className="field mt-2 text-sm" rows={5} dir="ltr" maxLength={4000} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
        </details>
      )}
      {error && <p className="error-box" role="alert">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {s.prompt && (
          <button type="button" className="btn btn-primary px-4" disabled={Boolean(busy)} onClick={() => run("gen", { action: "shrine.generate", id: s.id, prompt })}>
            {busy === "gen" ? S.generating : draft || s.imageUrl ? S.again : S.generate}
          </button>
        )}
        {draft && (
          <button type="button" className="btn btn-secondary px-4" disabled={Boolean(busy)} onClick={() => run("ok", { action: "shrine.approve", id: s.id, path: draft.path })}>
            {S.approve}
          </button>
        )}
        {s.imageUrl && (
          <button type="button" className="btn btn-ghost px-4" disabled={Boolean(busy)} onClick={() => run("active", { action: "shrine.active", id: s.id, active: !s.active })}>
            {s.active ? S.hide : S.show}
          </button>
        )}
      </div>
      <p className="text-xs font-bold text-muted">{S.cost}</p>
    </li>
  );
}
