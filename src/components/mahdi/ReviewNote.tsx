"use client";

// «حاسبوا أنفسكم»: the person's own note for a day, a week or a month of the review. Saved by itself a moment after
// they stop typing (and when they leave); read and written only through their own session.
import { useEffect, useRef, useState } from "react";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import { t } from "@/lib/mahdi/i18n";

type Kind = "day" | "week" | "month";
const MAX = 2000;

export default function ReviewNote({ kind, start }: { kind: Kind; start: string }) {
  // each period has its own note: the component starts again when the period changes
  return <Note key={`${kind}:${start}`} kind={kind} start={start} />;
}

function Note({ kind, start }: { kind: Kind; start: string }) {
  const [text, setText] = useState("");
  const [state, setState] = useState<"loading" | "saved" | "dirty" | "saving" | "error" | "off">("loading");
  const saved = useRef("");
  const latest = useRef("");

  useEffect(() => {
    let live = true;
    mahdiFetch<{ note: string; ready: boolean }>(`/api/mahdi/notes?kind=${kind}&start=${start}`)
      .then((r) => {
        if (!live) return;
        saved.current = r.note;
        latest.current = r.note;
        setText(r.note);
        setState(r.ready ? "saved" : "off");
      })
      .catch(() => live && setState("error"));
    return () => {
      live = false;
    };
  }, [kind, start]);

  const save = async (value: string) => {
    setState("saving");
    try {
      await mahdiFetch("/api/mahdi/notes", { method: "PUT", json: { kind, start, note: value } });
      saved.current = value.trim();
      setState(latest.current.trim() === saved.current ? "saved" : "dirty");
    } catch {
      setState("error");
    }
  };

  // saved a moment after the last key
  useEffect(() => {
    if (state !== "dirty") return;
    const id = setTimeout(() => void save(text), 900);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, state]);

  // leaving the page within that moment: the last words are still kept
  useEffect(
    () => () => {
      if (latest.current.trim() !== saved.current) {
        void fetch("/api/mahdi/notes", { method: "PUT", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, start, note: latest.current }) }).catch(() => null);
      }
    },
    [kind, start],
  );

  const label = { loading: "", saved: t.notes.saved, dirty: t.notes.dirty, saving: t.notes.saving, error: t.notes.error, off: t.notes.off }[state];
  return (
    <section className="m-card space-y-2 p-5" aria-label={t.notes[kind]}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">{t.notes[kind]}</h2>
        <span className="text-xs m-muted" role="status">{label}</span>
      </div>
      <textarea
        className="m-field min-h-28"
        value={text}
        maxLength={MAX}
        disabled={state === "loading" || state === "off"}
        placeholder={t.notes.placeholder[kind]}
        onChange={(e) => {
          latest.current = e.target.value;
          setText(e.target.value);
          setState("dirty");
        }}
      />
    </section>
  );
}
