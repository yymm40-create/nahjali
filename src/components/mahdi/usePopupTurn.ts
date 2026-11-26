"use client";

import { useEffect, useState } from "react";
import { wantPopup, type PopupId } from "@/lib/mahdi/client/popups";

/**
 * «نافذة وحدة بس في كل زيارة»: `show` turns true only when it is this layer's turn (after the person completes something, and
 * only if no other layer opened during this visit). Call `done` when it closes, so it does not open again in the same visit.
 */
export function usePopupTurn(id: PopupId, want: boolean): { show: boolean; done: () => void } {
  const [turn, setTurn] = useState(false);
  const [used, setUsed] = useState(false);
  useEffect(() => {
    if (!want || used) return;
    return wantPopup(id, () => setTurn(true));
  }, [id, want, used]);
  return {
    show: want && turn && !used,
    done: () => {
      setTurn(false);
      setUsed(true);
    },
  };
}
