// «لأجل المهدي» milestones and what each one unlocks. Quiet rewards only: no coins, no loot.
// To add one: give it a new id, pick a metric and a threshold, and the reward it opens.

export type MilestoneMetric = "fullDays" | "bestDayStreak" | "goalsAchieved" | "successfulWeeks";

export type Reward =
  | { type: "frame"; value: "gold" | "emerald" | "pearl" }
  | { type: "variant"; theme: "cinematic" | "minimal" | "night"; value: "dawn" | "emerald" | "moon" }
  | { type: "view"; value: "compact" };

export interface Milestone {
  id: string;
  title: string;
  description: string;
  metric: MilestoneMetric;
  threshold: number;
  reward: Reward;
  rewardLabel: string;
}

export const MILESTONES: Milestone[] = [
  { id: "first_full_day", title: "يوم مكتمل", description: "أتممت كل أهداف يوم واحد.", metric: "fullDays", threshold: 1, reward: { type: "frame", value: "gold" }, rewardLabel: "إطار ذهبي للصورة الشخصية" },
  { id: "streak_7", title: "سبعة أيام ثابتة", description: "سبعة أيام متتالية حققت فيها 80٪ أو أكثر.", metric: "bestDayStreak", threshold: 7, reward: { type: "variant", theme: "night", value: "moon" }, rewardLabel: "لمسة «ضوء القمر» لطابع زيارة الليل" },
  { id: "goals_30", title: "ثلاثون هدفًا", description: "حققت 30 هدفًا كاملًا.", metric: "goalsAchieved", threshold: 30, reward: { type: "view", value: "compact" }, rewardLabel: "طريقة عرض مضغوطة لعادات اليوم" },
  { id: "weeks_4", title: "أربعة أسابيع ناجحة", description: "أربعة أسابيع حققت في كل منها 80٪ أو أكثر.", metric: "successfulWeeks", threshold: 4, reward: { type: "variant", theme: "minimal", value: "emerald" }, rewardLabel: "لمسة «الزمرد» لطابع السكينة" },
  { id: "streak_30", title: "استمرار طويل", description: "ثلاثون يومًا متتاليًا من الثبات.", metric: "bestDayStreak", threshold: 30, reward: { type: "variant", theme: "cinematic", value: "dawn" }, rewardLabel: "لمسة «فجر الحرم» للطابع السينمائي" },
  { id: "goals_100", title: "مئة هدف", description: "حققت 100 هدف كامل.", metric: "goalsAchieved", threshold: 100, reward: { type: "frame", value: "pearl" }, rewardLabel: "إطار لؤلؤي للصورة الشخصية" },
  { id: "weeks_12", title: "ثلاثة أشهر من الثبات", description: "اثنا عشر أسبوعًا ناجحًا.", metric: "successfulWeeks", threshold: 12, reward: { type: "frame", value: "emerald" }, rewardLabel: "إطار زمردي للصورة الشخصية" },
];

export const FRAME_STYLES: Record<string, string> = {
  gold: "0 0 0 3px #e2bc66, 0 0 0 5px rgba(226,188,102,0.35)",
  pearl: "0 0 0 3px #f2ece0, 0 0 0 5px rgba(242,236,224,0.4)",
  emerald: "0 0 0 3px #2f9e74, 0 0 0 5px rgba(47,158,116,0.35)",
};
