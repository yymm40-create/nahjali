// BROWSER ONLY. Where the floating «المساعد» button sits and whether it is shown: kept on this device only.
import { useSyncExternalStore } from "react";

export interface AssistantPrefs {
  hidden?: boolean;
  /** The side it rests on, and its distance from the bottom of the screen (px). */
  side?: "left" | "right";
  bottom?: number;
}

const KEY = "mahdi:assistant";
const EMPTY: AssistantPrefs = {};
const listeners = new Set<() => void>();
let cache: { raw: string | null; value: AssistantPrefs } = { raw: null, value: EMPTY };

function read(): AssistantPrefs {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return cache.value; // storage blocked: what was set in this visit
  }
  if (raw !== cache.raw) {
    let value: AssistantPrefs = EMPTY;
    try {
      value = raw ? (JSON.parse(raw) as AssistantPrefs) : EMPTY;
    } catch {}
    cache = { raw, value };
  }
  return cache.value;
}

export function setAssistantPrefs(next: Partial<AssistantPrefs>) {
  const value = { ...read(), ...next };
  const raw = JSON.stringify(value);
  try {
    localStorage.setItem(KEY, raw);
  } catch {}
  cache = { raw, value };
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  window.addEventListener("storage", l);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", l);
  };
}

export const useAssistantPrefs = () => useSyncExternalStore(subscribe, read, () => EMPTY);
