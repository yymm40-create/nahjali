"use client";

// The Claude model the person picked, kept on this device and shared by every robot's chat (one choice, same everywhere).

import { useCallback, useSyncExternalStore } from "react";
import { CLAUDE_MODEL_KEY, DEFAULT_CLAUDE_MODEL, claudeModelOf, findClaudeModel, type ClaudeModel } from "@config/claude-models";

const EVENT = "jw-claude-model";

/** The model the person chose on this device, or "" when they never chose one. */
function read(): string {
  try {
    return findClaudeModel(localStorage.getItem(CLAUDE_MODEL_KEY))?.id ?? "";
  } catch {
    return "";
  }
}

const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
};

/**
 * [the chosen model, choose]. `fallback`: the model of a section that has its own default (the content maker: «الرشيق»)
 * while the person has chosen none — a choice they made stays theirs everywhere. The server shows the default until the
 * page is on the device.
 */
export function useClaudeModel(fallback: string = DEFAULT_CLAUDE_MODEL): [ClaudeModel, (id: string) => void] {
  const id = useSyncExternalStore(subscribe, read, () => "") || fallback;
  const choose = useCallback((next: string) => {
    try {
      localStorage.setItem(CLAUDE_MODEL_KEY, claudeModelOf(next).id);
    } catch {
      /* private mode: the choice lasts until the page closes — nothing more to do */
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [claudeModelOf(id), choose];
}
