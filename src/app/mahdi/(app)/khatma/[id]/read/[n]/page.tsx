"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { t } from "@/lib/mahdi/i18n";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import ConfirmSheet from "@/components/mahdi/ConfirmSheet";
import Icon from "@/components/mahdi/Icon";
import { useMahdi } from "@/components/mahdi/Provider";
import QuranReader from "@/components/mahdi/khatma/QuranReader";
import { portionTitle, type Division, type PortionState } from "@/lib/mahdi/khatma/portions";

interface View {
  ready: boolean;
  settings?: { noRepeat: number } | null;
  khatma?: { division: Division; status: "open" | "done" | "closed" } | null;
  portions?: PortionState[];
}

/** One portion of the group's khatma in the one Quran reader, and «قرأته ✓» for the one reading it. */
export default function KhatmaReader() {
  const { id, n: nParam } = useParams<{ id: string; n: string }>();
  const n = Number(nParam);
  const { toast } = useMahdi();
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const [ask, setAsk] = useState(false);

  useEffect(() => {
    let live = true;
    mahdiFetch<View>(`/api/mahdi/khatma/${id}`)
      .then((v) => live && setView(v))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [id, reload]);

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

  if (error && !view) return <p className="m-card p-5 text-center">{error}</p>;
  return (
    <>
      <QuranReader division={view?.khatma?.division} n={n} eyebrow="ختمة المجموعة">
        {state === "reading" && open && (
          <>
            <button type="button" className="m-btn m-btn-primary w-full" disabled={busy} onClick={() => act("done", t.khatma.markedDone)}>{t.khatma.markDone}</button>
            <button type="button" className="m-btn m-btn-quiet w-full" disabled={busy} onClick={() => setAsk(true)}>{t.khatma.release}</button>
          </>
        )}
        {state === "done" && (
          <>
            <p className="flex items-center justify-center gap-2 font-semibold" style={{ color: "var(--m-success)" }}>
              <Icon name="check" size={18} /> {t.khatma.legendDone}
            </p>
            {open && <button type="button" className="m-btn m-btn-quiet w-full" disabled={busy} onClick={() => act("undone", t.khatma.legendReading)}>{t.khatma.undo}</button>}
            {open && <button type="button" className="m-btn m-btn-quiet w-full" disabled={busy} onClick={() => setAsk(true)}>{t.khatma.release}</button>}
          </>
        )}
        {state === "free" && open && <button type="button" className="m-btn m-btn-primary w-full" disabled={busy} onClick={() => act("claim", t.khatma.claimed)}>{t.khatma.claim}</button>}
        {state === "blocked" && <p className="text-center text-sm m-muted">{t.khatma.blockedNote(view?.settings?.noRepeat ?? 0)}</p>}
      </QuranReader>
      {view?.khatma && (
        <ConfirmSheet
          open={ask}
          onClose={() => setAsk(false)}
          title={t.khatma.withdrawTitle(portionTitle(view.khatma.division, n))}
          body={t.khatma.withdrawBody}
          confirmLabel={t.khatma.withdraw}
          onConfirm={async () => void (await act("release", t.khatma.released))}
        />
      )}
    </>
  );
}
