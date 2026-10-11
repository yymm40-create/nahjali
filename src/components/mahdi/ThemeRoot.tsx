"use client";

import Image from "next/image";
import { createContext, useCallback, useContext, useState } from "react";
import { designOf, type MahdiTheme } from "@config/mahdi";
import { readPlace, type ShrinePlace } from "@/lib/mahdi/shrine-art";
import ShrineArt from "./ShrineArt";
import type { Shrine } from "@/lib/mahdi/types";

interface Look {
  theme: MahdiTheme;
  /** where the drawn shrine shows: the person's choice, or «auto» (the design's own) */
  place: ShrinePlace | "auto";
  setPlace: (p: ShrinePlace | "auto") => void;
  variant: string;
  setVariant: (v: string) => void;
  shrine: Shrine | null;
  setTheme: (t: MahdiTheme) => void;
  setShrine: (s: Shrine | null) => void;
}

const LookContext = createContext<Look | null>(null);

export function useLook() {
  const v = useContext(LookContext);
  if (!v) throw new Error("useLook outside ThemeRoot");
  return v;
}

/**
 * The branch's root element: theme tokens, fonts, and the shrine backdrop.
 * It lives in the branch layout, so the large picture is loaded once and stays while the user moves between pages.
 */
export default function ThemeRoot({
  initialTheme,
  initialVariant = "",
  initialShrine,
  initialPlace = "auto",
  fontClass,
  skipLabel,
  children,
}: {
  initialTheme: MahdiTheme;
  initialVariant?: string;
  initialShrine: Shrine | null;
  initialPlace?: string;
  fontClass: string;
  skipLabel: string;
  children: React.ReactNode;
}) {
  const [theme, setThemeState] = useState(initialTheme);
  const [shrine, setShrine] = useState(initialShrine);
  const [variant, setVariant] = useState(initialVariant);
  const [place, setPlace] = useState<ShrinePlace | "auto">(readPlace(initialPlace));
  const setTheme = useCallback((t: MahdiTheme) => {
    setThemeState(t);
    try {
      localStorage.setItem("mahdi:theme", t);
    } catch {}
  }, []);

  return (
    <LookContext.Provider value={{ theme, variant, setVariant, shrine, setTheme, setShrine, place, setPlace }}>
      <div className={`mahdi-root ${fontClass}`} data-mtheme={theme} data-mlight={designOf(theme).light || undefined} data-mvariant={variant || undefined} lang="ar" dir="rtl">
        <a href="#m-main" className="m-skip">
          {skipLabel}
        </a>
        <div className="m-backdrop" aria-hidden="true">
          {(() => {
            const design = designOf(theme);
            const where = shownPlace(place, design.place);
            // the photo made earlier, in the design's colours (as it is for «الحرم» and the older night look)
            if (where === "photo" && shrine?.imageUrl) {
              const own = theme === "cinematic" || theme === "night";
              return (
                <>
                  <Image src={shrine.imageUrl} alt="" fill sizes="100vw" loading="eager" fetchPriority="high" style={{ objectPosition: shrine.imagePosition }} className={own ? undefined : "m-photo-tinted"} />
                  {!own && <span className="m-photo-tint" />}
                </>
              );
            }
            // the shrine drawn in code, in the design's drawing style, standing at the bottom of every page
            if (where === "backdrop") return <ShrineArt shrineId={shrine?.id} style={design.art} className="m-shrine-backdrop" sky />;
            return null;
          })()}
        </div>
        {children}
      </div>
    </LookContext.Provider>
  );
}

/** Where the shrine shows: the person's choice, else the design's own. */
export const shownPlace = (place: ShrinePlace | "auto", own: ShrinePlace): ShrinePlace => (place === "auto" ? own : place);
