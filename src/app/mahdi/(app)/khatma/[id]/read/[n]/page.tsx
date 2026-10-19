"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { t } from "@/lib/mahdi/i18n";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import Icon from "@/components/mahdi/Icon";
import { useMahdi } from "@/components/mahdi/Provider";
import { arabicDigits, portionCount, type Division, type PortionState } from "@/lib/mahdi/khatma/portions";

interface Text {
  title: string;
  range: string;
  suras: { sura: number; name: string; bismillah: string | null; ayat: { n: number; text: string }[] }[];
  source: { name: string; url: string; version: string };
}
interface View {
  ready: boolean;
  settings?: { noRepeat: number } | null;
  khatma?: { division: Division; status: "open" | "done" | "closed" } | null;
  portions?: PortionState[];
}

const SIZE_KEY = "mahdi-quran-size";
const SIZES = [1.25, 1.45, 1.65, 1.9, 2.2];

/** One portion of the khatma: its whole text in the mushaf's script, and «قرأته ✓» for the one reading it. */
export default function KhatmaReader() {
  const { id, n: nParam } = useParams<{ id: string; n: string }>();
  const n = Number(nParam);
  const { toast } = useMahdi();
  const [view, setView] = useState<View | null>(null);
  const [text, setText] = useState<Text | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  // the reader's letter size, kept on the device (the words only show after loading, so the first paint matches)
  const [size, setSize] = useState(() => {
    try {
      const kept = typeof window === "undefined" ? null : localStorage.getItem(SIZE_KEY);
      const s = kept === null ? NaN : Number(kept);
      return Number.isInteger(s) && s >= 0 && s < SIZES.length ? s : 2;
    } catch {
      return 2;
    }
  });
  function resize(d: number) {
    const s = Math.max(0, Math.min(SIZES.length - 1, size + d));
    setSize(s);
    try {
      localStorage.setItem(SIZE_KEY, String(s));
    } catch {}
  }

  useEffect(() => {
    let live = true;
    mahdiFetch<View>(`/api/mahdi/khatma/${id}`)
      .then((v) => live && setView(v))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [id, reload]);

  const division = view?.khatma?.division;
  useEffect(() => {
    if (!division || !Number.isInteger(n) || n < 1 || n > portionCount(division)) return;
    let live = true;
    fetch(`/api/mahdi/khatma/text?d=${division}&n=${n}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((x: Text) => live && setText(x))
      .catch(() => live && setError(t.khatma.textError));
    return () => {
      live = false;
    };
  }, [division, n]);

  async function act(action: "claim" | "done" | "undone" | "release", done: string) {
    setBusy(true);
    try {
      await mahdiFetch(`/api/mahdi/khatma/${id}`, { method: "POST", json: { action, portion: n } });
      toast(done);
    } catch (e) {
      toast((e as Error).message);
    }
    setReload((x) => x + 1);
    setBusy(false);
  }

  const state = view?.portions?.[n - 1];
  const open = view?.khatma?.status === "open";

  return (
    <div className="space-y-5">
      <Link href={`/mahdi/khatma/${id}`} className="m-btn m-btn-quiet m-btn-sm -ms-3">
        <Icon name="chevronRight" size={18} /> {t.khatma.back}
      </Link>
      {error && !text ? (
        <p className="m-card p-5 text-center">{error}</p>
      ) : !text ? (
        <p className="m-muted">{t.khatma.loadingText}</p>
      ) : (
        <>
          <header className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="m-eyebrow">{t.khatma.title}</p>
              <h1 className="m-display text-2xl">{text.title}</h1>
              <p className="m-num text-sm m-muted">{text.range}</p>
            </div>
            <div className="flex items-center gap-1" aria-label="حجم الخط">
              <button type="button" className="m-icon-btn m-btn-ghost" aria-label="تصغير الخط" disabled={size === 0} onClick={() => resize(-1)}>
                <Icon name="minus" size={16} />
              </button>
              <button type="button" className="m-icon-btn m-btn-ghost" aria-label="تكبير الخط" disabled={size === SIZES.length - 1} onClick={() => resize(1)}>
                <Icon name="plus" size={16} />
              </button>
            </div>
          </header>

          <article className="m-card space-y-6 px-4 py-6 sm:px-8" lang="ar" dir="rtl">
            {text.suras.map((s) => (
              <section key={s.sura} className="space-y-3">
                {s.ayat[0]?.n === 1 && (
                  <h2 className="rounded-xl border-2 py-2 text-center" style={{ borderColor: "var(--m-gold)", fontFamily: "var(--font-quran), serif", fontSize: "1.4rem" }}>
                    سُورَةُ {s.name}
                  </h2>
                )}
                {s.bismillah && s.sura !== 1 && (
                  <p className="text-center" style={{ fontFamily: "var(--font-quran), serif", fontSize: `${SIZES[size]}rem`, lineHeight: 2.4 }}>{s.bismillah}</p>
                )}
                <p className="text-justify" style={{ fontFamily: "var(--font-quran), serif", fontSize: `${SIZES[size]}rem`, lineHeight: 2.5 }}>
                  {s.ayat.map((a) => (
                    <span key={a.n}>
                      {a.text} <span style={{ color: "var(--m-gold)", whiteSpace: "nowrap" }}>﴿{arabicDigits(a.n)}﴾</span>{" "}
                    </span>
                  ))}
                </p>
              </section>
            ))}
          </article>

          <div className="m-card space-y-2 p-4">
            {state === "reading" && open && (
              <>
                <button type="button" className="m-btn m-btn-primary w-full" disabled={busy} onClick={() => act("done", t.khatma.markedDone)}>{t.khatma.markDone}</button>
                <button type="button" className="m-btn m-btn-quiet w-full" disabled={busy} onClick={() => act("release", t.khatma.released)}>{t.khatma.release}</button>
              </>
            )}
            {state === "done" && (
              <>
                <p className="text-center font-semibold" style={{ color: "#22c55e" }}>✅ {t.khatma.legendDone}</p>
                {open && <button type="button" className="m-btn m-btn-quiet w-full" disabled={busy} onClick={() => act("undone", t.khatma.legendReading)}>{t.khatma.undo}</button>}
              </>
            )}
            {state === "free" && open && <button type="button" className="m-btn m-btn-primary w-full" disabled={busy} onClick={() => act("claim", t.khatma.claimed)}>{t.khatma.claim}</button>}
            {state === "blocked" && <p className="text-center text-sm m-muted">{t.khatma.blockedNote(view?.settings?.noRepeat ?? 0)}</p>}
          </div>

          <p className="text-center text-xs m-muted">
            {t.khatma.source} — <a href={text.source.url} target="_blank" rel="noopener noreferrer" className="underline" dir="ltr">tanzil.net</a>
          </p>
        </>
      )}
    </div>
  );
}
