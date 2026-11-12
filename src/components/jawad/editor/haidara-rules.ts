// «تعليماتي الدايمة» on this device: a copy of what the person wrote for حيدرا ماكس — the only copy until migration 0111
// runs — sent with every request to him; once the server keeps them, its copy wins and this one follows it.

import { cleanRules } from "@/lib/editor/changes-core";

const KEY = "jw-haidara-rules";

export function localRules() {
  try {
    return cleanRules(localStorage.getItem(KEY) ?? "");
  } catch {
    return "";
  }
}

export function keepLocalRules(v: string) {
  try {
    if (v) localStorage.setItem(KEY, v);
    else localStorage.removeItem(KEY);
  } catch {
    /* not kept */
  }
}
