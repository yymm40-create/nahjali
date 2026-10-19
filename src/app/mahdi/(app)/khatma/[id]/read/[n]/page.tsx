"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { t } from "@/lib/mahdi/i18n";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import Icon from "@/components/mahdi/Icon";
import { useMahdi } from "@/components/mahdi/Provider";
import QuranText, { QuranSource, usePortionWords } from "@/components/mahdi/khatma/QuranText";
import type { Division, PortionState } from "@/lib/mahdi/khatma/portions";

interface View {
  ready: boolean;
  settings?: { noRepeat: number } | null;
  khatma?: { division: Division; status: "open" | "done" | "closed" } | null;
  portions?: PortionState[];
}

/** One portion of the group's khatma: its whole text in the mushaf's script, and «قرأته ✓» for the one reading it. */
export default function KhatmaReader() {
  const { id, n: nParam } = useParams<{ id: string; n: string }>();
  const n = Number(nParam);
  const { toast } = useMahdi();
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let live = true;
    mahdiFetch<View>(`/api/mahdi/khatma/${id}`)
      .then((v) => live && setView(v))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [id, reload]);

  const { words, error: wordsError } = usePortionWords(view?.khatma?.division, n);

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
  const failed = error || wordsError;

  return (
    <div className="space-y-5">
      <Link href={`/mahdi/khatma/${id}`} className="m-btn m-btn-quiet m-btn-sm -ms-3">
        <Icon name="chevronRight" size={18} /> {t.khatma.back}
      </Link>
      {failed && !words ? (
        <p className="m-card p-5 text-center">{failed}</p>
      ) : !words ? (
        <p className="m-muted">{t.khatma.loadingText}</p>
      ) : (
        <>
          <QuranText words={words} />
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
          <QuranSource words={words} />
        </>
      )}
    </div>
  );
}
