"use client";

import Image from "next/image";
import { createContext, useCallback, useContext, useState } from "react";
import type { MahdiTheme } from "@config/mahdi";
import type { Shrine } from "@/lib/mahdi/types";

interface Look {
  theme: MahdiTheme;
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
  fontClass,
  skipLabel,
  children,
}: {
  initialTheme: MahdiTheme;
  initialVariant?: string;
  initialShrine: Shrine | null;
  fontClass: string;
  skipLabel: string;
  children: React.ReactNode;
}) {
  const [theme, setThemeState] = useState(initialTheme);
  const [shrine, setShrine] = useState(initialShrine);
  const [variant, setVariant] = useState(initialVariant);
  const setTheme = useCallback((t: MahdiTheme) => {
    setThemeState(t);
    try {
      localStorage.setItem("mahdi:theme", t);
    } catch {}
  }, []);

  return (
    <LookContext.Provider value={{ theme, variant, setVariant, shrine, setTheme, setShrine }}>
      <div className={`mahdi-root ${fontClass}`} data-mtheme={theme} data-mvariant={variant || undefined} lang="ar" dir="rtl">
        <a href="#m-main" className="m-skip">
          {skipLabel}
        </a>
        <div className="m-backdrop" aria-hidden="true">
          {shrine?.imageUrl && theme !== "minimal" && (
            <Image
              src={shrine.imageUrl}
              alt=""
              fill
              sizes="100vw"
              loading="eager"
              fetchPriority="high"
              style={{ objectPosition: shrine.imagePosition }}
            />
          )}
        </div>
        {children}
      </div>
    </LookContext.Provider>
  );
}
