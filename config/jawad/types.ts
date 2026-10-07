// «الجواد الذكي!» | JAWAD AI — shared types of the central registry. Imported by the browser and the server alike,
// so everything here (and in the other config/jawad files) must stay pure: no secrets, no server imports.

export type OutputKind = "image" | "video" | "audio";
export type RefKind = "image" | "video" | "audio";
/** What a reference does: the first/last frame of a video, or a free reference. */
export type RefRole = "first_frame" | "last_frame" | "reference";

/** An official document a capability or price was checked against. */
export interface Source {
  label: string;
  url: string;
  /** YYYY-MM-DD */
  checked: string;
}

/** One documented fact about an integration and whether it could be confirmed. */
export interface VerificationItem {
  item: string;
  status: "verified" | "unverified";
  note: string;
}

/** Limits a reference file must meet (checked in the browser and again on the server). */
export interface FileRule {
  mimes: string[];
  maxBytes: number;
  minSide?: number;
  maxSide?: number;
  /** width / height */
  minAspect?: number;
  maxAspect?: number;
  minPixels?: number;
  maxPixels?: number;
  minMs?: number;
  maxMs?: number;
  minFps?: number;
  maxFps?: number;
}

/** What a stored reference looks like to the rules (from the server's check of the file). */
export interface RefMeta {
  id: string;
  kind: RefKind;
  role: RefRole;
  mime: string;
  bytes: number;
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
  fps?: number | null;
  /** The name the prompt mentions it by («@image1» or one the user chose). */
  name?: string | null;
  /** pending: still uploading/being checked · ready · rejected */
  status: "pending" | "ready" | "rejected";
}

/** How references are used: none, the first/last frames of a video, or free references. */
export type RefStyle = "none" | "frames" | "references";

export interface ModeDef {
  id: string;
  label: string;
  refStyle: RefStyle;
  refs: Partial<Record<RefKind, { min: number; max: number; totalMaxMs?: number }>>;
  /** frames: the roles in order (the first is required). */
  roles?: RefRole[];
  /** At least one reference of these kinds must be present. */
  needsOneOf?: RefKind[];
  promptRequired: boolean;
  /** The text box reads differently in this mode (e.g. an optional note instead of the description). */
  prompt?: { label?: string; placeholder?: string };
}

export interface ChoiceOption {
  key: string;
  label: string;
  kind: "choice";
  values: { value: string; label: string; hint?: string }[];
  default: string;
  /** Shown left-to-right (technical values such as 16:9, 720p, voice names). */
  ltr?: boolean;
  /**
   * Values outside `values` that are also valid in form (the person's own saved voices, the provider's voice list);
   * the server checks each one really exists and belongs to the person before anything is charged.
   */
  accepts?: RegExp;
  /** Drawn by a dedicated picker instead of the plain buttons. */
  picker?: "voice";
}
export interface IntOption {
  key: string;
  label: string;
  kind: "int";
  min: number;
  max: number;
  step?: number;
  default: number;
  unit: string;
}
export interface BoolOption {
  key: string;
  label: string;
  kind: "bool";
  default: boolean;
  hint?: string;
}
export type OptionDef = ChoiceOption | IntOption | BoolOption;
export type SettingValue = string | number | boolean;
export type Settings = Record<string, SettingValue>;

/** An option as it applies right now: hidden, fixed to one value, or with some values unavailable (each with a reason). */
export type OptionState = OptionDef & {
  hidden?: boolean;
  fixed?: { value: SettingValue; reason: string };
  disabledValues?: Record<string, string>;
};

export type IssueField = "generator" | "refs" | "prompt" | "instructions" | "price" | string;
export interface Issue {
  field: IssueField;
  message: string;
}

/** A supported price unit of a generator. Defaults come from the provider's verified price, or null (unverified). */
export interface PriceKeyDef {
  key: string;
  label: string;
  /** Hundredths of a coin, or null when the provider's cost could not be verified (the owner decides). */
  defaultCenti: number | null;
  basis: string;
}

export interface PriceLine {
  label: string;
  centi: number;
}
export type PriceResult = { ok: true; coins: number; lines: PriceLine[]; usdCeiling: number | null } | { ok: false; reason: string };

/** Everything the rules need to judge one request. */
export interface RequestDraft {
  settings: Settings;
  prompt: string;
  instructions: string;
  refs: RefMeta[];
}

export interface Resolved {
  mode: ModeDef;
  options: OptionState[];
  /** Settings with defaults and fixed values applied (what would be sent). */
  settings: Settings;
  issues: Issue[];
  notes: string[];
}

export interface GeneratorDef {
  id: string;
  name: string;
  output: OutputKind;
  /** The built-in section that shows it (the owner can move it to another section of the same output). */
  defaultSection: string;
  provider: { id: "openai" | "byteplus-modelark" | "elevenlabs" | "minimax"; label: string };
  model: { id: string; family: string; version: string };
  api: {
    name: string;
    endpoint: string;
    /** sync: one request returns the result · async: create a task, then a callback and/or polling */
    tracking: "sync" | "async";
    /** Real progress percentage from the provider (none: an indeterminate indicator with the stage). */
    progress: "none" | "percent";
    cancel: "none" | "queued-only";
  };
  modes: ModeDef[];
  options: OptionDef[];
  files: Partial<Record<RefKind, FileRule>>;
  prompt: {
    label: string;
    placeholder: string;
    /** Hard limit (the provider's documented one). */
    max: number;
    arabic: boolean;
    arabicNote?: string;
    /** The provider's advice on length (not a limit): past it, a warning is shown, nothing is blocked. */
    advise?: { maxWords: number; maxCjk: number; note: string };
  };
  /** How the model itself names the n-th reference of a type in a prompt (each «@name» is sent this way). */
  refLabel?: (kind: RefKind, n: number) => string;
  /** A second text field sent separately (e.g. the voice's performance description). */
  extraText?: { key: "instructions"; label: string; placeholder: string; max: number };
  priceKeys: PriceKeyDef[];
  /** Picks the mode from how references are used. */
  modeFor(refStyle: RefStyle, refs: RefMeta[]): ModeDef;
  /** Option states and cross-checks for this request (mode-dependent options, linked limits). */
  rules(d: RequestDraft, mode: ModeDef): { options: OptionState[]; issues: Issue[]; notes: string[] };
  price(d: RequestDraft, mode: ModeDef, table: Record<string, number | null>): PriceResult;
  /** Estimated provider cost ceiling (USD) for the owner's records. */
  costUsd(d: RequestDraft, mode: ModeDef): number | null;
  sources: Source[];
  verification: VerificationItem[];
  notes: string[];
}
