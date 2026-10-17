"use client";

// «مصمم العروض» — one slide shown at any width: the slide's page in a sandboxed frame (no scripts can run in it; the
// markup is already sanitized), scaled down from its real 1920×1080. In the editor its text boxes are editable in
// place and its pictures can be picked; every change comes back as the slide's markup (pictures as img: tokens again).

import { useEffect, useMemo, useRef } from "react";
import { FONTS, fontById } from "@config/jawad/student";
import { DECK_SIZE, deckDocument, setFontFamilyLookup, type Deck, type DeckSlide } from "@/lib/slides/format";

setFontFamilyLookup((id) => fontById(id).family);

/** The deck's fonts from the site's own files (the same ones the PDF embeds). */
export function clientFontCss(fonts: string[]) {
  if (typeof window === "undefined") return "";
  const ids = [...new Set([...fonts, "plex", "amiri"])];
  return ids
    .map((id) => FONTS.find((f) => f.id === id))
    .filter(Boolean)
    .flatMap((f) => f!.files.map((x, i) => `@font-face{font-family:"${f!.family}";src:url(${window.location.origin}/api/jawad/student/fonts/${f!.id}?i=${i}) format("truetype");font-weight:${x.weight};font-display:block}`))
    .join("\n");
}

const EDIT_CSS = `[contenteditable]{cursor:text;outline:none;border-radius:6px}[contenteditable]:hover{box-shadow:0 0 0 3px rgba(139,92,246,.55)}[contenteditable]:focus{box-shadow:0 0 0 4px rgba(245,158,11,.9)}img{cursor:pointer}img:hover{outline:4px dashed rgba(139,92,246,.8)}img[data-picked]{outline:6px solid #f59e0b}`;
const TEXT_SEL = "h1,h2,h3,p,li,td,th";

/** The slide's markup as it is in the frame now: edit marks removed, pictures back to their tokens. */
export function serializeSlide(doc: Document): string | null {
  const sec = doc.querySelector("section[data-slide]");
  if (!sec) return null;
  const c = sec.cloneNode(true) as HTMLElement;
  c.querySelectorAll("[contenteditable]").forEach((el) => el.removeAttribute("contenteditable"));
  c.querySelectorAll("[data-picked]").forEach((el) => el.removeAttribute("data-picked"));
  c.querySelectorAll("img").forEach((img) => {
    const t = img.getAttribute("data-token");
    if (t) img.setAttribute("src", `img:${t}`);
    img.removeAttribute("data-token");
    img.removeAttribute("data-missing");
  });
  return c.outerHTML;
}

export default function SlideFrame({
  deck,
  slide,
  images,
  width,
  fontCss,
  editable = false,
  renderKey = 0,
  onChange,
  onPickImage,
  onFrame,
}: {
  deck: Deck;
  slide: DeckSlide;
  images: Record<string, string>;
  width: number;
  fontCss: string;
  editable?: boolean;
  /** bumped when the slide changed from outside (undo, Claude, a new picture): the frame is drawn again */
  renderKey?: number;
  onChange?: (html: string) => void;
  onPickImage?: (img: HTMLImageElement | null) => void;
  onFrame?: (doc: Document | null) => void;
}) {
  const { w, h } = DECK_SIZE[deck.aspect];
  const scale = width / w;
  const ref = useRef<HTMLIFrameElement>(null);
  const cb = useRef({ onChange, onPickImage, onFrame });
  useEffect(() => {
    cb.current = { onChange, onPickImage, onFrame };
  });
  // while editing, the frame is NOT redrawn on every keystroke (the caret would jump): only on an outside change
  const html = editable ? `${slide.id}:${renderKey}` : slide.html;
  const doc = useMemo(
    () => deckDocument({ ...deck, slides: [slide] }, { fontCss, resolve: (p) => images[p], csp: true, extraCss: editable ? EDIT_CSS : "" }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [html, fontCss, editable, deck.aspect, images],
  );

  useEffect(() => {
    const f = ref.current;
    if (!f || !editable) return;
    const wire = () => {
      const d = f.contentDocument;
      if (!d) return;
      d.querySelectorAll(TEXT_SEL).forEach((el) => {
        // the outermost text box takes the edits (a <p> inside an <li> stays part of it)
        if (!el.parentElement?.closest(TEXT_SEL)) el.setAttribute("contenteditable", "true");
      });
      // a box that holds only words (no inner text blocks) is editable too
      d.querySelectorAll("section[data-slide] div").forEach((el) => {
        if (!el.querySelector(TEXT_SEL) && !el.closest("[contenteditable]") && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent?.trim())) el.setAttribute("contenteditable", "true");
      });
      const emit = () => {
        const out = serializeSlide(d);
        if (out) cb.current.onChange?.(out);
      };
      d.addEventListener("input", emit);
      d.addEventListener("click", (e) => {
        const t = e.target as HTMLElement;
        d.querySelectorAll("[data-picked]").forEach((el) => el.removeAttribute("data-picked"));
        if (t.tagName === "IMG") {
          t.setAttribute("data-picked", "1");
          cb.current.onPickImage?.(t as HTMLImageElement);
        } else cb.current.onPickImage?.(null);
      });
      // pasted text comes in as plain words (never someone else's markup)
      d.addEventListener("paste", (e) => {
        e.preventDefault();
        const text = e.clipboardData?.getData("text/plain") ?? "";
        d.execCommand("insertText", false, text);
      });
      cb.current.onFrame?.(d);
    };
    f.addEventListener("load", wire);
    if (f.contentDocument?.readyState === "complete") wire();
    return () => {
      f.removeEventListener("load", wire);
      cb.current.onFrame?.(null);
    };
  }, [doc, editable]);

  return (
    <div className="relative overflow-hidden" style={{ width, height: h * scale }} dir="ltr">
      <iframe
        ref={ref}
        title={`شريحة ${slide.id}`}
        sandbox="allow-same-origin"
        srcDoc={doc}
        className="absolute top-0 left-0 border-0 bg-white"
        style={{ width: w, height: h, transform: `scale(${scale})`, transformOrigin: "0 0", pointerEvents: editable ? "auto" : "none" }}
      />
    </div>
  );
}
