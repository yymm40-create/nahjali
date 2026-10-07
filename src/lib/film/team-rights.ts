// What a team member of «المسلسل الذكي» may do, in words. Pure: used by the pages and the server alike.

/** The steps a member can be given. */
export const TEAM_STAGES = [
  { key: "screenwriter", label: "السيناريست", icon: "✍️" },
  { key: "sheets", label: "صانع الشيت", icon: "🎨" },
  { key: "director", label: "المخرج والتوليد والأصوات", icon: "🎥" },
  { key: "montage", label: "المونتاج وتركيب الحلقات", icon: "✂️" },
] as const;
export type TeamStage = (typeof TEAM_STAGES)[number]["key"];
export const isTeamStage = (s: unknown): s is TeamStage => TEAM_STAGES.some((x) => x.key === s);

/** «السيناريست · 13 محاولة باقية من 20» */
export function rightsText(m: { stages: readonly string[] | null; maxAttempts: number | null; usedAttempts: number }) {
  const steps = !m.stages ? "كل الخطوات" : m.stages.length ? TEAM_STAGES.filter((s) => m.stages!.includes(s.key)).map((s) => s.label).join("، ") : "ولا خطوة";
  const tries = m.maxAttempts === null ? "محاولات بلا حد" : `${Math.max(0, m.maxAttempts - m.usedAttempts)} محاولة باقية من ${m.maxAttempts}`;
  return `${steps} · ${tries}`;
}
