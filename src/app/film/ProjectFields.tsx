"use client";

import { useState } from "react";
import { FILM_LIMITS } from "@config/film";
import { parseStory } from "@/lib/film/story-map";
import StoryMap, { StoryWay, type StoryWayKey } from "./StoryMap";
import { isYoutubeLink, storyFromLink, storyFromUpload, storyLink, storyUpload, type StoryVideo } from "@/lib/film/story-link";
import StoryVideoUpload from "./StoryVideoUpload";

export interface FieldValues {
  title: string;
  story: string;
  fixedFacts: string;
  targetDurationSec: string;
}

// Accepts Arabic-Indic digits too (٦٠ → 60)
const toDigits = (s: string) =>
  s
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[^\d]/g, "")
    .slice(0, 4);

/**
 * Title, story, fixed facts and approximate duration — shared by the new-project and project pages. The story is
 * written freely, or with «🗺️ ساعدني أكتبها»: a question per station (StoryMap), composed into the same story text, or
 * (a new film only, `withLink`) as «🔗 رابط يوتيوب»: a YouTube link and the person's note under it (lib/film/story-link),
 * which «سجاد» downloads, looks at and hears before he builds the film on it.
 */
export default function ProjectFields({
  values,
  onChange,
  disabled,
  kind,
  startOnMap,
  withLink,
}: {
  values: FieldValues;
  onChange: (v: FieldValues) => void;
  disabled?: boolean;
  /** a short scene shows each station's seconds (its length, or a minute); a whole film does not */
  kind?: "scene" | "film" | "series" | "";
  /** open on the story map even when nothing is written yet (a link like /film/new?map=1) */
  startOnMap?: boolean;
  /** offer «🔗 رابط يوتيوب» as a third way (the new-film page) */
  withLink?: boolean;
}) {
  const set = (key: keyof FieldValues) => (e: { target: { value: string } }) => onChange({ ...values, [key]: e.target.value });
  // a story already written on the map opens on the map
  const [way, setWay] = useState<StoryWayKey>(() => (withLink && storyLink(values.story) ? "link" : withLink && storyUpload(values.story) ? "upload" : startOnMap || parseStory(values.story) !== null ? "map" : "free"));
  const map = way === "map";
  const link = withLink && way === "link" ? (storyLink(values.story) ?? { url: "", note: "" }) : null;
  const setLink = (url: string, note: string) => onChange({ ...values, story: storyFromLink(url, note).slice(0, FILM_LIMITS.storyMax) });
  const upload = withLink && way === "upload" ? (storyUpload(values.story) ?? { video: null, note: "" }) : null;
  const setUpload = (video: StoryVideo | null, note: string) =>
    onChange({ ...values, story: storyFromUpload(video, note).slice(0, FILM_LIMITS.storyMax) });
  // switching ways: a link's story is not carried into the free text (nor the free text into the link)
  const chooseWay = (w: StoryWayKey) => {
    if (w === way) return;
    if (w === "link") onChange({ ...values, story: storyFromLink("", "") });
    else if (w === "upload") onChange({ ...values, story: storyFromUpload(null, "") });
    else if (way === "link" || way === "upload") onChange({ ...values, story: "" });
    setWay(w);
  };
  const seconds = kind === "film" || kind === "series" ? null : Number(values.targetDurationSec) || (kind === "scene" ? 60 : null);

  return (
    <div className="card space-y-4 p-5">
      <label className="block space-y-1">
        <span className="font-extrabold">عنوان المشروع</span>
        <input className="field" value={values.title} onChange={set("title")} maxLength={FILM_LIMITS.titleMax} disabled={disabled} placeholder="مثلًا: ليلة الفداء" />
      </label>
      <div className="space-y-2">
        <span className="block font-extrabold">فكرتك وقصتك</span>
        {!disabled && <StoryWay way={way} onWay={chooseWay} withLink={withLink} />}
        {upload && !disabled ? (
          <div className="space-y-2">
            <StoryVideoUpload video={upload.video} onVideo={(v) => setUpload(v, upload.note)} />
            <label className="block space-y-1">
              <span className="text-sm font-extrabold">وضّح لسجاد وش تبي منه <span className="text-xs text-muted">(اختياري)</span></span>
              <textarea
                className="field min-h-32"
                value={upload.note}
                onChange={(e) => setUpload(upload.video, e.target.value)}
                maxLength={FILM_LIMITS.storyMax - 300}
                placeholder="مثلًا: أبي نفس القصة بستايل كرتوني، أو خذ فكرته بس وغيّر الشخصيات، أو انسخ حركة الكاميرا والإضاءة"
              />
            </label>
          </div>
        ) : link && !disabled ? (
          <div className="space-y-2">
            <input
              className="field"
              dir="ltr"
              inputMode="url"
              value={link.url}
              onChange={(e) => setLink(e.target.value.trim(), link.note)}
              placeholder="https://www.youtube.com/watch?v=…"
              aria-label="رابط فيديو يوتيوب"
            />
            {link.url && !isYoutubeLink(link.url) ? (
              <p className="text-xs font-bold text-red-600">هذا مو رابط فيديو يوتيوب. المتاح الحين روابط يوتيوب بس.</p>
            ) : (
              <p className="text-xs leading-6 text-muted">المتاح الحين روابط يوتيوب بس. سجاد ينزّل الفيديو ويشوف صوره ويسمع كلامه، ويقول لك وش فهم منه قبل ما يبني عليه فيلمك.</p>
            )}
            <label className="block space-y-1">
              <span className="text-sm font-extrabold">وضّح لسجاد وش تبي منه <span className="text-xs text-muted">(اختياري)</span></span>
              <textarea
                className="field min-h-32"
                value={link.note}
                onChange={(e) => setLink(link.url, e.target.value)}
                maxLength={FILM_LIMITS.storyMax - 200}
                placeholder="مثلًا: أبي نفس القصة بستايل كرتوني، أو خذ فكرته بس وغيّر الشخصيات، أو انسخ حركة الكاميرا والإضاءة"
              />
            </label>
          </div>
        ) : map && !disabled ? (
          <StoryMap story={values.story} durationSec={seconds} onChange={(story) => onChange({ ...values, story: story.slice(0, FILM_LIMITS.storyMax) })} />
        ) : (
          <textarea
            className="field min-h-48"
            value={values.story}
            onChange={set("story")}
            maxLength={FILM_LIMITS.storyMax}
            disabled={disabled}
            placeholder="فكرتي في جملة، ثم قصتي: من الشخصيات؟ كيف تبدأ؟ وش يصير؟ وشلون تنتهي؟"
          />
        )}
      </div>
      <label className="block space-y-1">
        <span className="font-extrabold">أشياء ثابتة ما تبيها تتغير <span className="text-sm text-muted">(اختياري)</span></span>
        <textarea
          className="field min-h-24"
          value={values.fixedFacts}
          onChange={set("fixedFacts")}
          maxLength={FILM_LIMITS.factsMax}
          disabled={disabled}
          placeholder="مثلًا: الأحداث كما وردت في الرواية، أو وجه الشخصية نور بلا ملامح"
        />
      </label>
      <label className="block space-y-1">
        <span className="font-extrabold">مدة تقريبية بالثواني <span className="text-sm text-muted">(اختياري)</span></span>
        <input className="field" inputMode="numeric" value={values.targetDurationSec} onChange={(e) => onChange({ ...values, targetDurationSec: toDigits(e.target.value) })} disabled={disabled} placeholder="مثلًا 60" />
      </label>
    </div>
  );
}
