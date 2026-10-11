// «الاختصارات» in حيدرة كت: the keyboard of the editors people come from — Premiere Pro, DaVinci Resolve, CapCut and
// Final Cut Pro — next to our own. All of them work at once; where two programs give the SAME key to different jobs,
// the program the person chose first («أي برنامج تعودت عليه؟») wins, then ours, then the rest in a fixed order.
// Only what this editor can do is listed (no tools it lacks). On a Mac ⌘ and Ctrl are the same key here, so Final
// Cut's ⌘ shortcuts are written "Mod".

export type ProgramId = "jawad" | "premiere" | "resolve" | "capcut" | "fcp";

export const PROGRAMS: Record<ProgramId, { ar: string; en: string; icon: string }> = {
  jawad: { ar: "حيدرة كت", en: "JAWAD", icon: "🟢" },
  premiere: { ar: "بريمير برو", en: "Premiere Pro", icon: "🟪" },
  resolve: { ar: "دافنشي ريزولف", en: "DaVinci Resolve", icon: "🎨" },
  capcut: { ar: "كاب كت", en: "CapCut", icon: "⬛" },
  fcp: { ar: "فاينل كت برو", en: "Final Cut Pro", icon: "🎬" },
};
export const PROGRAM_ORDER: ProgramId[] = ["jawad", "premiere", "resolve", "capcut", "fcp"];

export type ActionId =
  | "play"
  | "pause"
  | "playFwd"
  | "back"
  | "frameBack"
  | "frameFwd"
  | "bigBack"
  | "bigFwd"
  | "start"
  | "end"
  | "prevEdit"
  | "nextEdit"
  | "split"
  | "splitAll"
  | "delete"
  | "ripple"
  | "trimStart"
  | "trimEnd"
  | "undo"
  | "redo"
  | "copy"
  | "cut"
  | "paste"
  | "pasteAttrs"
  | "duplicate"
  | "selectAll"
  | "deselect"
  | "marker"
  | "nextMarker"
  | "prevMarker"
  | "transition"
  | "zoomIn"
  | "zoomOut"
  | "zoomFit"
  | "full"
  | "import"
  | "export"
  | "save";

export const ACTIONS: { id: ActionId; ar: string; group: string }[] = [
  { id: "play", ar: "شغّل / وقّف", group: "التشغيل" },
  { id: "pause", ar: "وقّف", group: "التشغيل" },
  { id: "playFwd", ar: "شغّل لقدّام", group: "التشغيل" },
  { id: "back", ar: "وقّف وارجع ثانية", group: "التشغيل" },
  { id: "frameBack", ar: "فريم للورا", group: "التنقل" },
  { id: "frameFwd", ar: "فريم لقدّام", group: "التنقل" },
  { id: "bigBack", ar: "قفزة للورا", group: "التنقل" },
  { id: "bigFwd", ar: "قفزة لقدّام", group: "التنقل" },
  { id: "start", ar: "أول الفيديو", group: "التنقل" },
  { id: "end", ar: "آخر الفيديو", group: "التنقل" },
  { id: "prevEdit", ar: "القصّة اللي قبل", group: "التنقل" },
  { id: "nextEdit", ar: "القصّة اللي بعد", group: "التنقل" },
  { id: "split", ar: "قص عند المؤشر", group: "التعديل" },
  { id: "splitAll", ar: "قص كل المسارات عند المؤشر", group: "التعديل" },
  { id: "delete", ar: "حذف (يخلي فراغ)", group: "التعديل" },
  { id: "ripple", ar: "حذف وسحب اللي بعده", group: "التعديل" },
  { id: "trimStart", ar: "قص البداية لين المؤشر", group: "التعديل" },
  { id: "trimEnd", ar: "قص النهاية من المؤشر", group: "التعديل" },
  { id: "duplicate", ar: "تكرار المقطع", group: "التعديل" },
  { id: "transition", ar: "أضف انتقال تلاشي", group: "التعديل" },
  { id: "marker", ar: "علامة عند المؤشر", group: "العلامات" },
  { id: "nextMarker", ar: "العلامة اللي بعد", group: "العلامات" },
  { id: "prevMarker", ar: "العلامة اللي قبل", group: "العلامات" },
  { id: "undo", ar: "تراجع", group: "عام" },
  { id: "redo", ar: "إعادة", group: "عام" },
  { id: "copy", ar: "نسخ", group: "عام" },
  { id: "cut", ar: "قص (للحافظة)", group: "عام" },
  { id: "paste", ar: "لصق عند المؤشر", group: "عام" },
  { id: "pasteAttrs", ar: "لصق السمات", group: "عام" },
  { id: "selectAll", ar: "اختر الكل", group: "عام" },
  { id: "deselect", ar: "شيل الاختيار", group: "عام" },
  { id: "zoomIn", ar: "كبّر التايملاين", group: "العرض" },
  { id: "zoomOut", ar: "صغّر التايملاين", group: "العرض" },
  { id: "zoomFit", ar: "التايملاين كله في الشاشة", group: "العرض" },
  { id: "full", ar: "المعاينة ملء الشاشة", group: "العرض" },
  { id: "save", ar: "احفظ الحين", group: "المشروع" },
  { id: "import", ar: "استورد ملفات", group: "المشروع" },
  { id: "export", ar: "صدّر الفيديو", group: "المشروع" },
];

/** Each program's keys for what this editor can do ("Mod" = Ctrl on Windows, ⌘ on a Mac). */
export const KEYMAPS: Record<ProgramId, Partial<Record<ActionId, string[]>>> = {
  jawad: {
    play: ["Space"],
    frameBack: ["Left"],
    frameFwd: ["Right"],
    bigBack: ["Shift+Left"],
    bigFwd: ["Shift+Right"],
    start: ["Home"],
    end: ["End"],
    split: ["S", "Mod+B"],
    delete: ["Delete", "Backspace"],
    ripple: ["Shift+Delete", "Shift+Backspace"],
    duplicate: ["Mod+D"],
    undo: ["Mod+Z"],
    redo: ["Mod+Shift+Z", "Mod+Y"],
    copy: ["Mod+C"],
    cut: ["Mod+X"],
    paste: ["Mod+V"],
    pasteAttrs: ["Mod+Alt+V"],
    selectAll: ["Mod+A"],
    deselect: ["Escape"],
    save: ["Mod+S"],
  },
  premiere: {
    play: ["Space"],
    pause: ["K"],
    playFwd: ["L"],
    back: ["J"],
    frameBack: ["Left"],
    frameFwd: ["Right"],
    bigBack: ["Shift+Left"],
    bigFwd: ["Shift+Right"],
    start: ["Home"],
    end: ["End"],
    prevEdit: ["Up"],
    nextEdit: ["Down"],
    split: ["Mod+K"],
    splitAll: ["Mod+Shift+K"],
    delete: ["Delete", "Backspace"],
    ripple: ["Shift+Delete", "Shift+Backspace"],
    trimStart: ["Q"],
    trimEnd: ["W"],
    transition: ["Mod+D"],
    marker: ["M"],
    nextMarker: ["Shift+M"],
    prevMarker: ["Mod+Shift+M"],
    undo: ["Mod+Z"],
    redo: ["Mod+Shift+Z"],
    copy: ["Mod+C"],
    cut: ["Mod+X"],
    paste: ["Mod+V"],
    pasteAttrs: ["Mod+Alt+V"],
    selectAll: ["Mod+A"],
    deselect: ["Mod+Shift+A"],
    zoomIn: ["="],
    zoomOut: ["-"],
    zoomFit: ["\\"],
    full: ["Mod+`"],
    import: ["Mod+I"],
    export: ["Mod+M"],
    save: ["Mod+S"],
  },
  resolve: {
    play: ["Space"],
    pause: ["K"],
    playFwd: ["L"],
    back: ["J"],
    frameBack: ["Left"],
    frameFwd: ["Right"],
    bigBack: ["Shift+Left"],
    bigFwd: ["Shift+Right"],
    start: ["Home"],
    end: ["End"],
    prevEdit: ["Up"],
    nextEdit: ["Down"],
    split: ["Mod+B", "Mod+\\"],
    delete: ["Backspace"],
    ripple: ["Delete", "Shift+Backspace"],
    trimStart: ["Shift+["],
    trimEnd: ["Shift+]"],
    transition: ["Mod+T"],
    marker: ["M"],
    nextMarker: ["Shift+Down"],
    prevMarker: ["Shift+Up"],
    undo: ["Mod+Z"],
    redo: ["Mod+Shift+Z"],
    copy: ["Mod+C"],
    cut: ["Mod+X"],
    paste: ["Mod+V"],
    pasteAttrs: ["Alt+V"],
    selectAll: ["Mod+A"],
    deselect: ["Mod+Shift+A"],
    zoomIn: ["Mod+="],
    zoomOut: ["Mod+-"],
    zoomFit: ["Shift+Z"],
    full: ["Mod+F"],
    import: ["Mod+I"],
    save: ["Mod+S"],
  },
  capcut: {
    play: ["Space"],
    frameBack: ["Left"],
    frameFwd: ["Right"],
    start: ["Home"],
    end: ["End"],
    prevEdit: ["Up"],
    nextEdit: ["Down"],
    split: ["Mod+B"],
    delete: ["Delete", "Backspace"],
    trimStart: ["Q"],
    trimEnd: ["W"],
    marker: ["M"],
    undo: ["Mod+Z"],
    redo: ["Mod+Shift+Z"],
    copy: ["Mod+C"],
    cut: ["Mod+X"],
    paste: ["Mod+V"],
    selectAll: ["Mod+A"],
    zoomIn: ["Mod+="],
    zoomOut: ["Mod+-"],
    zoomFit: ["Shift+Z"],
    full: ["Mod+Shift+F"],
    import: ["Mod+I"],
    export: ["Mod+E"],
    save: ["Mod+S"],
  },
  fcp: {
    play: ["Space"],
    pause: ["K"],
    playFwd: ["L"],
    back: ["J"],
    frameBack: ["Left"],
    frameFwd: ["Right"],
    bigBack: ["Shift+Left"],
    bigFwd: ["Shift+Right"],
    start: ["Home"],
    end: ["End"],
    prevEdit: ["Up"],
    nextEdit: ["Down"],
    split: ["Mod+B"],
    splitAll: ["Mod+Shift+B"],
    ripple: ["Delete", "Backspace"],
    delete: ["Shift+Delete", "Shift+Backspace"],
    trimStart: ["Alt+["],
    trimEnd: ["Alt+]"],
    transition: ["Mod+T"],
    marker: ["M"],
    undo: ["Mod+Z"],
    redo: ["Mod+Shift+Z"],
    copy: ["Mod+C"],
    cut: ["Mod+X"],
    paste: ["Mod+V"],
    pasteAttrs: ["Mod+Shift+V"],
    selectAll: ["Mod+A"],
    deselect: ["Mod+Shift+A"],
    zoomIn: ["Mod+="],
    zoomOut: ["Mod+-"],
    zoomFit: ["Shift+Z"],
    full: ["Mod+Shift+F"],
    import: ["Mod+I"],
    export: ["Mod+E"],
    save: ["Mod+S"],
  },
};

/** How far «قفزة» moves in each program (Premiere 5 frames, Final Cut 10 frames, the others a second). */
export const BIG_STEP: Record<ProgramId, { frames?: number; ms?: number; ar: string }> = {
  jawad: { ms: 1000, ar: "ثانية" },
  premiere: { frames: 5, ar: "٥ فريمات" },
  resolve: { ms: 1000, ar: "ثانية" },
  capcut: { ms: 1000, ar: "ثانية" },
  fcp: { frames: 10, ar: "١٠ فريمات" },
};

/** Keys a web browser keeps for itself (a new tab, close, new window): they work only in the computer app. */
export const BROWSER_KEPT = new Set(["Mod+T", "Mod+W", "Mod+N", "Mod+Shift+T", "Mod+Shift+N", "Mod+Shift+W"]);

const KEY_NAME: Record<string, string> = {
  " ": "Space",
  ArrowLeft: "Left",
  ArrowRight: "Right",
  ArrowUp: "Up",
  ArrowDown: "Down",
  Esc: "Escape",
  Del: "Delete",
};
/** The key of `e.code` when the layout writes something else (Arabic letters, a shifted symbol). */
function codeKey(code: string) {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  return (
    {
      Space: "Space",
      Minus: "-",
      Equal: "=",
      NumpadAdd: "=",
      NumpadSubtract: "-",
      BracketLeft: "[",
      BracketRight: "]",
      Backslash: "\\",
      IntlBackslash: "\\",
      Backquote: "`",
      Semicolon: ";",
      Quote: "'",
    } as Record<string, string>
  )[code];
}

/** A key press written the way the maps write it ("Mod+Shift+K"); null for a lone modifier. */
export function comboOf(e: Pick<KeyboardEvent, "key" | "code" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey">) {
  if (["Control", "Meta", "Shift", "Alt", "AltGraph", "CapsLock"].includes(e.key)) return null;
  // the physical key first, so an Arabic keyboard or Shift+= ("+") still means the same shortcut
  const k = codeKey(e.code) ?? KEY_NAME[e.key] ?? (e.key.length === 1 ? e.key.toUpperCase() : e.key);
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push("Mod");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  parts.push(k);
  return parts.join("+");
}

/** The order the programs are asked in: the chosen one, then ours, then the rest. */
export function priority(first: ProgramId): ProgramId[] {
  return [first, ...PROGRAM_ORDER.filter((p) => p !== first)];
}

/** Every key → the one job it does, the chosen program winning a clash. */
export function keyTable(first: ProgramId) {
  const out = new Map<string, { action: ActionId; from: ProgramId }>();
  for (const p of priority(first))
    for (const [action, combos] of Object.entries(KEYMAPS[p]) as [ActionId, string[]][])
      for (const c of combos) if (!out.has(c)) out.set(c, { action, from: p });
  return out;
}

/** The keys that mean different jobs in different programs, and who wins each with this choice. */
export function clashes(first: ProgramId) {
  const uses = new Map<string, { p: ProgramId; action: ActionId }[]>();
  for (const p of PROGRAM_ORDER)
    for (const [action, combos] of Object.entries(KEYMAPS[p]) as [ActionId, string[]][])
      for (const c of combos) uses.set(c, [...(uses.get(c) ?? []), { p, action }]);
  const table = keyTable(first);
  return [...uses.entries()]
    .filter(([, u]) => new Set(u.map((x) => x.action)).size > 1)
    .map(([combo, u]) => ({ combo, uses: u, wins: table.get(combo)! }));
}

/** A combo shown to a person: ⌘ on a Mac, Ctrl elsewhere; arrows as arrows. */
export function showCombo(combo: string, mac: boolean) {
  const sym: Record<string, string> = { Left: "←", Right: "→", Up: "↑", Down: "↓", Space: "Space", Escape: "Esc", Mod: mac ? "⌘" : "Ctrl", Alt: mac ? "⌥" : "Alt", Shift: mac ? "⇧" : "Shift" };
  return combo
    .split("+")
    .map((p) => sym[p] ?? p)
    .join(mac ? "" : "+");
}

export const KEYS_STORE = "jw-editor-keys";
export function readProgram(v: string | null): ProgramId | null {
  return v && v in PROGRAMS ? (v as ProgramId) : null;
}
