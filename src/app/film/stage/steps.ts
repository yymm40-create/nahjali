// The steps of a scene, in order: plain data, shared by the stage (client) and the lobby (server).

import type { FilmStage as Stage } from "@config/film";

/** The steps of a scene, in order; `reached` is the project stage from which a step opens. */
export const STEPS: { key: string; label: string; hint: string; icon: string; path: string; reached: Stage }[] = [
  { key: "story", label: "القصة", hint: "فكرتك بكلماتك", icon: "📝", path: "", reached: "screenwriter" },
  { key: "script", label: "السيناريست", hint: "القصة تصير سيناريو", icon: "✍️", path: "/script", reached: "screenwriter" },
  { key: "sheets", label: "صانع الشيت", hint: "شكل كل شخصية ومكان", icon: "🎨", path: "/sheets", reached: "sheets" },
  { key: "director", label: "المخرج", hint: "اللقطات وبرومبتاتها", icon: "🎥", path: "/director", reached: "director" },
  { key: "videos", label: "التوليد", hint: "كل لقطة تصير فيديو", icon: "🎬", path: "/videos", reached: "director" },
  { key: "voices", label: "الأصوات", hint: "صوت كل شخصية", icon: "🎙️", path: "/voices", reached: "director" },
  { key: "edit", label: "المونتاج", hint: "المشهد كاملًا", icon: "✂️", path: "/edit", reached: "director" },
];
