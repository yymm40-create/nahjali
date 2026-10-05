// JAWAD AI — what the studio shows for a job's state. Shared by the browser and the server.

export type JobStatus = "validating" | "queued" | "submitting" | "running" | "saving" | "succeeded" | "failed" | "cancelled";

/** The stage of a job in plain Arabic. `providerStatus` refines "running" (in the provider's queue / generating). */
export function stageLabel(status: JobStatus, providerStatus?: string | null) {
  switch (status) {
    case "validating":
      return "التحقق من الطلب";
    case "queued":
      return "بالانتظار";
    case "submitting":
      return providerStatus === "rewriting" ? "يكتب البرومبت المعدّل" : "الإرسال إلى المزوّد";
    case "running": {
      if (providerStatus === "queued") return "في طابور المزوّد";
      // «الفصل الذكي»
      if (providerStatus === "watching") return "Claude يشاهد الفيديو ويخطط الأصوات";
      if (providerStatus === "isolating") return "يفصل الحوار من صوت الفيديو";
      const made = /^sounds (\d+)\/(\d+)$/.exec(providerStatus ?? "");
      if (made) return `يصنع الأصوات (${made[1]} من ${made[2]})`;
      if (providerStatus === "mixing") return "يجهّز المسارات على طول الفيديو";
      return "التوليد";
    }
    case "saving":
      return "حفظ الناتج";
    case "succeeded":
      return "اكتمل";
    case "failed":
      return "فشل";
    case "cancelled":
      return "أُلغي";
  }
}

export const isOpenStatus = (s: JobStatus) => s === "validating" || s === "queued" || s === "submitting" || s === "running" || s === "saving";

export interface OutputView {
  id: string;
  kind: "image" | "video" | "audio";
  url: string | null;
  downloadUrl: string;
  /** What this result is when a job makes several kinds (e.g. «الفصل الذكي»: dialogue / music / sfx). */
  name: string | null;
  mime: string;
  width: number | null;
  height: number | null;
  durationMs: number | null;
}

export interface JobView {
  type: "job";
  id: string;
  createdAt: string;
  finishedAt: string | null;
  status: JobStatus;
  providerStatus: string | null;
  /** Only a real percentage from the provider (none of the current providers report one). */
  progress: number | null;
  generatorId: string;
  generatorName: string;
  sectionId: string;
  outputKind: "image" | "video" | "audio";
  mode: string;
  prompt: string;
  instructions: string;
  settings: Record<string, string | number | boolean>;
  refStyle: "none" | "frames" | "references";
  refs: { uploadId: string; kind: "image" | "video" | "audio"; role: "first_frame" | "last_frame" | "reference"; name?: string }[];
  /** The prompt as the model received it, when «@name» mentions were written its way. */
  modelPrompt: string | null;
  priceCoins: number;
  charged: boolean;
  chargeState: "none" | "held" | "settled" | "refunded";
  error: string | null;
  cancellable: boolean;
  outputs: OutputView[];
}

/** A picture or video made in the film maker, shown in the studio and linked to its project. */
export interface FilmItemView {
  type: "film";
  id: string;
  createdAt: string;
  kind: "image" | "video";
  url: string | null;
  downloadUrl: string | null;
  projectId: string;
  projectTitle: string;
  refKey: string;
  href: string;
}

export type WorkItem = JobView | FilmItemView;
export type WorksFilter = "all" | "image" | "video" | "audio";
