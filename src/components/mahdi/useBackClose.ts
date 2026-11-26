"use client";

import { useEffect, useRef } from "react";
import { backLayers } from "@/lib/mahdi/client/back-layers";

/**
 * While `open`, the phone's back button (or the browser's) calls `onClose` instead of leaving the screen; closing it any
 * other way leaves no extra history entry behind. Used by every sheet and dialog of the app.
 */
export function useBackClose(open: boolean, onClose: () => void) {
  const latest = useRef(onClose);
  useEffect(() => {
    latest.current = onClose;
  });
  useEffect(() => {
    if (!open) return;
    const layers = backLayers();
    if (!layers) return;
    const id = layers.open(() => latest.current());
    return () => layers.close(id);
  }, [open]);
}
