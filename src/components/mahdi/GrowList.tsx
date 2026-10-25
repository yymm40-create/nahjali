"use client";

// «تطوّر وازدهر»: what the person intends to achieve — written down, marked when it is achieved. Private: read and
// written through the person's own session (/api/mahdi/grow).
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import { fmtNum, t } from "@/lib/mahdi/i18n";
import { GROW_HORIZONS, GROW_LIMITS, sortGrow, type GrowHorizon, type GrowItem } from "@/lib/mahdi/planner";
import Icon from "./Icon";
import { useMahdi } from "./Provider";

export default function GrowList() {
  const { toast } = useMahdi();
  const [items, setItems] = useState<GrowItem[] | null>(null);
  const [ready, setReady] = useState(true);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [horizon, setHorizon] = useState<GrowHorizon>("month");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    mahdiFetch<{ ready: boolean; items: GrowItem[] }>("/api/mahdi/grow")
      .then((r) => {
        setReady(r.ready);
        setItems(r.items);
      })
      .catch(() => setItems([]));
  }, []);
  useEffect(() => {
    const id = setTimeout(load, 0);
    return () => clearTimeout(id);
  }, [load]);

  async function add() {
    if (!title.trim() || busy) return;
    setBusy(true);
    try {
      const { item } = await mahdiFetch<{ item: GrowItem }>("/api/mahdi/grow", { method: "POST", json: { title, horizon, note } });
      setItems((all) => [...(all ?? []), item]);
      setTitle("");
      setNote("");
    } catch (e) {
      toast((e as Error).message);
    }
    setBusy(false);
  }
  async function patch(id: string, body: Record<string, unknown>) {
    try {
      const { item } = await mahdiFetch<{ item: GrowItem }>("/api/mahdi/grow", { method: "PATCH", json: { id, ...body } });
      setItems((all) => (all ?? []).map((x) => (x.id === id ? item : x)));
    } catch (e) {
      toast((e as Error).message);
    }
  }
  async function remove(id: string) {
    if (!window.confirm(t.grow.confirmRemove)) return;
    try {
      await mahdiFetch(`/api/mahdi/grow?id=${id}`, { method: "DELETE" });
      setItems((all) => (all ?? []).filter((x) => x.id !== id));
    } catch (e) {
      toast((e as Error).message);
    }
  }

  const list = sortGrow(items ?? []);
  const done = list.filter((i) => i.doneAt).length;
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link href="/mahdi/more" className="m-btn m-btn-quiet m-btn-sm -ms-3">
          <Icon name="chevronRight" size={18} /> {t.nav.more}
        </Link>
        <h1 className="m-display text-3xl">🌱 {t.grow.title}</h1>
        <p className="m-muted">{t.grow.intro}</p>
      </header>

      <section className="m-card space-y-3 p-5">
        <input className="m-field" value={title} maxLength={GROW_LIMITS.titleMax} placeholder={t.grow.placeholder} disabled={!ready} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void add()} />
        <input className="m-field" value={note} maxLength={GROW_LIMITS.noteMax} placeholder={t.grow.notePlaceholder} disabled={!ready} onChange={(e) => setNote(e.target.value)} />
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t.grow.horizonLabel}>
          <span className="text-sm m-muted">{t.grow.horizonLabel}</span>
          {GROW_HORIZONS.map((h) => (
            <button key={h} type="button" className="m-option px-3 py-1.5 text-sm" aria-pressed={horizon === h} onClick={() => setHorizon(h)}>
              {t.grow.horizon[h]}
            </button>
          ))}
        </div>
        <button type="button" className="m-btn m-btn-primary w-full" disabled={!title.trim() || busy || !ready} onClick={() => void add()}>
          <Icon name="plus" /> {t.grow.add}
        </button>
        {!ready && <p className="text-sm m-muted">{t.grow.off}</p>}
      </section>

      {items === null ? null : list.length === 0 ? (
        <p className="m-card p-6 text-center m-muted">{t.grow.empty}</p>
      ) : (
        <section className="space-y-3">
          <p className="m-eyebrow">{t.grow.count(done, list.length)}</p>
          <ul className="space-y-2">
            {list.map((i) => (
              <li key={i.id} className="m-card flex items-start gap-3 p-4">
                <button
                  type="button"
                  className="m-icon-btn mt-0.5 shrink-0"
                  aria-pressed={!!i.doneAt}
                  aria-label={i.doneAt ? t.grow.markOpen : t.grow.markDone}
                  title={i.doneAt ? t.grow.markOpen : t.grow.markDone}
                  onClick={() => void patch(i.id, { done: !i.doneAt })}
                >
                  {i.doneAt ? <Icon name="check" size={20} className="m-gold" /> : <span aria-hidden="true" className="block size-5 rounded-full border-2" style={{ borderColor: "var(--m-gold-text)" }} />}
                </button>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className={`font-semibold ${i.doneAt ? "line-through opacity-60" : ""}`}>{i.title}</p>
                  {i.note && <p className="text-sm m-muted">{i.note}</p>}
                  <p className="m-num text-xs m-muted">
                    {i.doneAt ? `${t.grow.done} · ${new Date(i.doneAt).toLocaleDateString("ar-SA", { day: "numeric", month: "long", year: "numeric" })}` : t.grow.horizon[i.horizon]}
                  </p>
                </div>
                <button type="button" className="m-icon-btn shrink-0" aria-label={t.grow.remove} title={t.grow.remove} onClick={() => void remove(i.id)}>
                  <Icon name="trash" size={18} />
                </button>
              </li>
            ))}
          </ul>
          <p className="sr-only">{fmtNum(list.length)}</p>
        </section>
      )}
    </div>
  );
}
