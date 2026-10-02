import { UserError } from "@/lib/api";
import { FILM_LIMITS } from "@config/film";

const clean = (s: unknown) => (typeof s === "string" ? s.replace(/[\p{Cc}\p{Cf}]/gu, (c) => (c === "\n" ? c : " ")).trim() : "");

/** Validates the editable project fields; only the keys present in `body` are returned. */
export function projectFields(body: Record<string, unknown>, { requireTitle }: { requireTitle: boolean }) {
  const out: { title?: string; story?: string; fixed_facts?: string; target_duration_sec?: number | null } = {};

  if ("title" in body || requireTitle) {
    const title = clean(body.title).replace(/\s+/g, " ");
    if (!title) throw new UserError("اكتب عنوان المشروع.", 400);
    if (title.length > FILM_LIMITS.titleMax) throw new UserError(`العنوان طويل (${FILM_LIMITS.titleMax} حرف كحد أقصى).`, 400);
    out.title = title;
  }
  if ("story" in body) {
    const story = clean(body.story);
    if (story.length > FILM_LIMITS.storyMax) throw new UserError("القصة طويلة جدًا.", 400);
    out.story = story;
  }
  if ("fixedFacts" in body) {
    const facts = clean(body.fixedFacts);
    if (facts.length > FILM_LIMITS.factsMax) throw new UserError("الحقائق الثابتة طويلة جدًا.", 400);
    out.fixed_facts = facts;
  }
  if ("targetDurationSec" in body) {
    const v = body.targetDurationSec;
    if (v === null || v === "" || v === undefined) out.target_duration_sec = null;
    else {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1 || n > 3600) throw new UserError("المدة لازم تكون بين ثانية و٦٠ دقيقة.", 400);
      out.target_duration_sec = n;
    }
  }
  return out;
}
