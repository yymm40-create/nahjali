"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BOOK_PDF } from "@config/mahdi";
import { fmtNum, t } from "@/lib/mahdi/i18n";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import { shrinkImage } from "@/lib/mahdi/client/reading";
import BookCover from "./BookCover";
import Icon from "./Icon";
import { useMahdi } from "./Provider";

const R = t.reading;
const E = R.enhance;
const COVER_MAX = 20 * 1024 * 1024;

export const pdfSizeLabel = (bytes: number) => R.pdf.size(fmtNum(Math.max(0.1, Math.round((bytes / 1024 / 1024) * 10) / 10)));

/**
 * The book's cover: a photo from the camera or the gallery, and «حسّن الصورة» (GPT Image 2, keeps what is printed on
 * the cover; paid in coins). `onChange` gets the picture to save: the enhanced one or the original, as chosen.
 */
export function CoverPicker({ title, onChange }: { title: string; onChange: (cover: Blob | null) => void }) {
  const { toast } = useMahdi();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [original, setOriginal] = useState<{ file: File; url: string } | null>(null);
  const [enhanced, setEnhanced] = useState<{ url: string; blob: Blob } | null>(null);
  const [useEnhanced, setUseEnhanced] = useState(false);
  const [price, setPrice] = useState<number | null>(null);
  const [asking, setAsking] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<{ text: string; buy?: boolean } | null>(null);

  useEffect(() => {
    let live = true;
    mahdiFetch<{ coins: number }>("/api/mahdi/reading/cover")
      .then((r) => live && setPrice(r.coins))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => () => {
    if (original) URL.revokeObjectURL(original.url);
  }, [original]);

  function pick(file: File | undefined) {
    if (!file) return;
    if (file.size > COVER_MAX) return setError({ text: R.coverTooBig });
    setError(null);
    setOriginal({ file, url: URL.createObjectURL(file) });
    setEnhanced(null);
    setUseEnhanced(false);
    setAsking(false);
    onChange(file);
  }

  async function enhance() {
    if (!original) return;
    setAsking(false);
    setWorking(true);
    setError(null);
    try {
      const data = new FormData();
      data.append("photo", await shrinkImage(original.file, 2000), "cover.jpg");
      const r = await mahdiFetch<{ image: string; coins: number }>("/api/mahdi/reading/cover", { method: "POST", body: data });
      const blob = await (await fetch(r.image)).blob();
      setEnhanced({ url: r.image, blob });
      setUseEnhanced(true);
      onChange(blob);
      toast(E.done);
    } catch (e) {
      const status = (e as { status?: number }).status;
      setError({ text: (e as Error).message, buy: status === 402 });
    }
    setWorking(false);
  }

  const choose = (enh: boolean) => {
    setUseEnhanced(enh);
    onChange(enh && enhanced ? enhanced.blob : (original?.file ?? null));
  };
  const shown = useEnhanced && enhanced ? enhanced.url : (original?.url ?? null);
  const input = (ref: React.RefObject<HTMLInputElement | null>, camera: boolean) => (
    <input
      ref={ref}
      type="file"
      accept="image/*"
      {...(camera ? { capture: "environment" as const } : {})}
      className="sr-only"
      tabIndex={-1}
      aria-hidden="true"
      onChange={(e) => {
        pick(e.target.files?.[0]);
        e.target.value = "";
      }}
    />
  );

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-4">
        <span className="relative shrink-0">
          <BookCover book={{ title: title || R.bookTitle, coverUrl: shown }} width={84} />
          {working && <span className="absolute inset-0 grid place-items-center rounded-lg bg-black/45 text-xs font-semibold text-white">…</span>}
        </span>
        <div className="min-w-0 space-y-2">
          <p className="m-label">{R.cover}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="m-btn m-btn-ghost m-btn-sm" disabled={working} onClick={() => cameraRef.current?.click()}>
              <Icon name="camera" size={18} /> {R.coverPick}
            </button>
            <button type="button" className="m-btn m-btn-ghost m-btn-sm" disabled={working} onClick={() => galleryRef.current?.click()}>
              <Icon name="image" size={18} /> {R.coverGallery}
            </button>
          </div>
          <p className="m-hint">{R.coverHint}</p>
          {input(cameraRef, true)}
          {input(galleryRef, false)}
        </div>
      </div>

      {original && (
        <div className="m-soft space-y-2 p-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <Icon name="sparkle" size={16} className="m-gold" /> {E.title}
          </p>
          <p className="m-hint">{E.body}</p>
          {enhanced && (
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={E.title}>
              <button type="button" role="radio" aria-checked={useEnhanced} className="m-option min-h-10 text-sm font-semibold" onClick={() => choose(true)}>{E.useEnhanced}</button>
              <button type="button" role="radio" aria-checked={!useEnhanced} className="m-option min-h-10 text-sm font-semibold" onClick={() => choose(false)}>{E.useOriginal}</button>
            </div>
          )}
          {working ? (
            <p className="text-sm font-semibold" role="status">{E.working}</p>
          ) : asking ? (
            <div className="space-y-2">
              <p className="text-sm">{price ? E.confirm(price) : E.confirmFree}</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" className="m-btn m-btn-ghost m-btn-sm" onClick={() => setAsking(false)}>{E.no}</button>
                <button type="button" className="m-btn m-btn-primary m-btn-sm" onClick={enhance}>{E.yes}</button>
              </div>
            </div>
          ) : (
            !enhanced && (
              <button type="button" className="m-btn m-btn-primary m-btn-sm w-full" disabled={price === null} onClick={() => setAsking(true)}>
                <Icon name="sparkle" size={16} /> {price ? E.button(price) : E.free}
              </button>
            )
          )}
        </div>
      )}
      {error && (
        <p className="m-error text-sm" role="alert">
          {error.text}
          {error.buy && (
            <>
              {" "}
              <Link href="/coins" className="underline">{E.buy}</Link>
            </>
          )}
        </p>
      )}
    </div>
  );
}

/** Choosing the book's PDF (uploaded when the form is sent). */
export function PdfPicker({ file, onChange, disabled }: { file: File | null; onChange: (f: File | null) => void; disabled?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  return (
    <div className="space-y-2">
      <p className="m-label">
        {R.pdf.label} <span className="m-hint">({t.common.optional})</span>
      </p>
      {file ? (
        <div className="m-soft flex items-center gap-3 p-3">
          <Icon name="book" size={20} className="m-gold shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold" dir="auto">{file.name}</span>
            <span className="m-num m-muted block text-xs">{pdfSizeLabel(file.size)}</span>
          </span>
          <button type="button" className="m-icon-btn" aria-label={R.pdf.remove} disabled={disabled} onClick={() => onChange(null)}>
            <Icon name="close" size={18} />
          </button>
        </div>
      ) : (
        <button type="button" className="m-btn m-btn-ghost m-btn-sm" disabled={disabled} onClick={() => ref.current?.click()}>
          <Icon name="plus" size={16} /> {R.pdf.pick}
        </button>
      )}
      <p className="m-hint">{R.pdf.hint}</p>
      {error && <p className="m-error text-sm" role="alert">{error}</p>}
      <input
        ref={ref}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          if (!(f.type === "application/pdf" || /\.pdf$/i.test(f.name))) return setError(R.pdf.badType);
          if (f.size > BOOK_PDF.maxBytes) return setError(R.pdf.tooBig);
          setError("");
          onChange(f);
        }}
      />
    </div>
  );
}
