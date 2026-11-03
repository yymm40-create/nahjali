// A believable account for the «لأجل المهدي» preview screenshots: no real person's data, avatars are initials.
// `snapshot` is what MahdiProvider starts from; `api(url, method)` answers every /api/mahdi/* call the pages make.
import { addDays, type ISODate, type Version } from "@/lib/mahdi/engine";
import { DEFAULT_PROFILE, makePlan } from "@/lib/mahdi/health/plan";
import type { DayLog } from "@/lib/mahdi/health/tracker";
import type { PostView, SocialUser, StoryGroup } from "@/lib/mahdi/social";
import type { Habit, Snapshot } from "@/lib/mahdi/types";

export const TODAY: ISODate = "2026-11-03";
const FROM: ISODate = "2026-08-01";
const d = (n: number) => addDays(TODAY, -n);

/** A fixed «random» so every run draws the same history. */
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

const v = (measure: Version["measure"], target: number, unit: string, freq: Version["freq"] = "daily", days: number[] = []): Version[] => [
  { effectiveFrom: FROM, measure, target, unit, freq, days, state: "active" },
];

const habits: Habit[] = [
  { id: "h-quran", projectId: "p-quran", name: "قراءة القرآن", icon: "📖", category: "", notes: "", reminderTime: "05:30", sortOrder: 0, versions: v("count", 10, "صفحات"), color: null },
  { id: "h-ahd", projectId: "p-quran", name: "دعاء العهد", icon: "🤲", category: "", notes: "", reminderTime: "06:00", sortOrder: 1, versions: v("check", 1, "") },
  { id: "h-layl", projectId: "p-salat", name: "صلاة الليل", icon: "🌙", category: "", notes: "", reminderTime: "03:45", sortOrder: 0, versions: v("check", 1, "") },
  { id: "h-awwal", projectId: "p-salat", name: "الصلاة أول الوقت", icon: "🕌", category: "", notes: "", reminderTime: null, sortOrder: 1, versions: v("count", 5, "فروض") },
  { id: "h-tasbih", projectId: "p-salat", name: "تسبيح الزهراء", icon: "📿", category: "", notes: "", reminderTime: null, sortOrder: 2, versions: v("check", 1, "") },
  { id: "h-water", projectId: "p-health", name: "شرب الماء", icon: "💧", category: "", notes: "", reminderTime: null, sortOrder: 0, versions: v("count", 8, "أكواب") },
  { id: "h-walk", projectId: "p-health", name: "المشي", icon: "🚶", category: "", notes: "", reminderTime: "19:00", sortOrder: 1, versions: v("amount", 30, "دقيقة") },
];

// How each habit tends to go (the chance a past day is complete), and today's value
const odds: Record<string, number> = { "h-quran": 0.86, "h-ahd": 0.92, "h-layl": 0.72, "h-awwal": 0.8, "h-tasbih": 0.94, "h-water": 0.78, "h-walk": 0.7 };
const todayValue: Record<string, number> = { "h-quran": 6, "h-ahd": 1, "h-layl": 1, "h-awwal": 3, "h-tasbih": 1, "h-water": 5, "h-walk": 0 };

const logs: Record<string, Record<ISODate, number>> = {};
for (const h of habits) {
  const row: Record<ISODate, number> = {};
  const { target, measure } = h.versions[0];
  for (let i = 1; i <= 94; i++) {
    const r = rnd();
    // the last weeks a little better than the first: a nice, honest climb
    const p = odds[h.id] + (i < 21 ? 0.06 : i > 60 ? -0.08 : 0);
    // the last ten days all complete: a streak to show
    if (r < p || i <= 10) row[d(i)] = target;
    else if (measure !== "check" && r < p + 0.12) row[d(i)] = Math.max(1, Math.round(target * (0.4 + rnd() * 0.4)));
  }
  if (todayValue[h.id]) row[TODAY] = todayValue[h.id];
  logs[h.id] = row;
}

// a joined challenge (its logs are kept apart)
const challengeLogs: Record<string, number> = {};
for (let i = 0; i <= 14; i++) if (i === 0 || rnd() < 0.85) challengeLogs[d(i)] = 1;

const books = {
  nahj: { id: "b-nahj", title: "نهج البلاغة", author: "الشريف الرضي", pages: 560, unit: "page" as const, description: "خطب أمير المؤمنين عليه السلام ورسائله وحكمه.", coverUrl: null, addedByMe: false, hidden: false, pdfSize: null },
  ghayba: { id: "b-ghayba", title: "الغيبة", author: "محمد بن إبراهيم النعماني", pages: 340, unit: "page" as const, description: "من أقدم ما كُتب في غيبة الإمام المهدي عجّل الله فرجه.", coverUrl: null, addedByMe: false, hidden: false, pdfSize: null },
  mafatih: { id: "b-mafatih", title: "مفاتيح الجنان", author: "الشيخ عباس القمي", pages: 420, unit: "page" as const, description: "الأدعية والزيارات والأعمال.", coverUrl: null, addedByMe: false, hidden: false, pdfSize: null },
};
const sessions: Snapshot["reading"]["sessions"] = [];
let page = 1;
for (let i = 40; i >= 0; i--) {
  if (i > 13 && rnd() > 0.7) continue; // the last two weeks without a gap: a streak
  const n = i === 0 ? 9 : 6 + Math.round(rnd() * 10);
  sessions.push({ id: `s${i}`, bookId: books.nahj.id, unit: "page", date: d(i), seconds: (n * 95 + Math.round(rnd() * 200)), ranges: [[page, page + n - 1]], pages: n, note: "" });
  page += n;
}
let gp = 1;
for (let i = 30; i >= 3; i -= 3) {
  sessions.push({ id: `g${i}`, bookId: books.ghayba.id, unit: "page", date: d(i), seconds: 900, ranges: [[gp, gp + 7]], pages: 8, note: "" });
  gp += 8;
}
sessions.sort((a, b) => a.date.localeCompare(b.date));

export const snapshot: Snapshot = {
  profile: {
    userId: "u-jawad",
    displayName: "جواد",
    avatarUrl: null,
    shrineId: "imam-ali",
    // ?theme=<key> picks another look (config/mahdi.ts MAHDI_THEMES); «الحرم» by default
    theme: (typeof location !== "undefined" && new URLSearchParams(location.search).get("theme")) || "cinematic",
    themeVariant: "",
    timeZone: "Asia/Riyadh",
    weekStart: 6,
    showHijri: true,
    hijriOffset: 0,
    frame: "",
    viewMode: "list",
    homeWidgets: ["habits", "reading", "quick", "daily", "dayNote", "priorities", "tasks", "week", "book", "khatma", "phrase"],
    shrinePlace: "auto",
  },
  shrines: [],
  phrases: [
    { id: "ph1", text: "خطوة صغيرة كل يوم، وتصير طريقًا إليه.", contexts: ["home"] },
    { id: "ph2", text: "الثبات أجمل من الكمال: ارجع اليوم وكمّل.", contexts: ["home", "comeback"] },
    { id: "ph3", text: "يومك اكتمل، تقبّل الله.", contexts: ["day_complete"] },
  ],
  rewards: [],
  privacy: { community: true, leaderboard: true, showAvatar: true, privateAccount: false, storiesInFeed: true },
  challenges: {
    sections: [
      { id: "sec-month", name: "تحديات الشهر", description: "تحديات يشارك فيها الجميع بنفس القواعد.", icon: "🌙" },
      { id: "sec-quran", name: "مع القرآن", description: "ورد ثابت تتابعه مع الإخوة.", icon: "📖" },
    ],
    list: [
      { id: "c-fajr", sectionId: "sec-month", title: "صلاة الفجر في وقتها", description: "أربعون يومًا على صلاة الفجر أول وقتها.", rules: "", measure: "check", target: 1, unit: "", freq: "daily", startsOn: "2026-10-20", endsOn: "2026-11-28", leaderboard: true },
      { id: "c-salawat", sectionId: "sec-month", title: "مئة صلاة على محمد وآل محمد", description: "كل يوم مئة صلاة.", rules: "", measure: "count", target: 100, unit: "صلاة", freq: "daily", startsOn: "2026-11-01", endsOn: "2026-11-30", leaderboard: true },
      { id: "c-juz", sectionId: "sec-quran", title: "جزء كل أسبوع", description: "ختمة كاملة على مدار السنة.", rules: "", measure: "check", target: 1, unit: "", freq: "weekly", startsOn: "2026-09-01", endsOn: null, leaderboard: false },
      { id: "c-kahf", sectionId: "sec-quran", title: "سورة الكهف ليلة الجمعة", description: "", rules: "", measure: "check", target: 1, unit: "", freq: "weekly", startsOn: "2026-11-10", endsOn: "2027-01-31", leaderboard: false },
    ],
    memberships: [{ challengeId: "c-fajr", joinedOn: "2026-10-20", leftOn: null, onLeaderboard: true }],
    logs: { "c-fajr": challengeLogs },
  },
  notifications: { mode: "daily", times: ["08:00"], quietStart: "23:00", quietEnd: "05:00", habitReminders: true },
  reading: {
    library: [
      { book: books.nahj, state: "reading", addedAt: `${d(41)}T10:00:00Z`, finishedAt: null },
      { book: books.ghayba, state: "reading", addedAt: `${d(31)}T10:00:00Z`, finishedAt: null },
      { book: books.mafatih, state: "finished", addedAt: "2026-06-01T10:00:00Z", finishedAt: "2026-09-12T10:00:00Z" },
    ],
    sessions,
    goals: { daily: { metric: "minutes", target: 20 }, weekly: { metric: "pages", target: 70 }, habitId: null, habitMetric: "pages" },
  },
  username: "jawad",
  projects: [
    { id: "p-quran", name: "القرآن", icon: "📖", color: "gold", sortOrder: 0, archivedAt: null, kind: "project" },
    { id: "p-salat", name: "الصلاة", icon: "🕌", color: "emerald", sortOrder: 1, archivedAt: null, kind: "project" },
    { id: "p-health", name: "الصحة", icon: "💪", color: "turquoise", sortOrder: 2, archivedAt: null, kind: "project" },
  ],
  habits,
  milestones: [],
  milestoneLogs: {},
  emergencyDays: {},
  logs,
  logsFrom: "2025-09-29",
  today: TODAY,
  tasks: [
    { id: "t1", date: TODAY, title: "زيارة الوالدين", at: null, habitId: null, sortOrder: 0, doneAt: `${TODAY}T13:10:00Z`, priority: true },
    { id: "t2", date: TODAY, title: "تحضير درس الأخلاق", at: "18:00", habitId: null, sortOrder: 1, doneAt: null, priority: true },
    { id: "t3", date: TODAY, title: "ختم سورة يس للمرحوم", at: null, habitId: null, sortOrder: 2, doneAt: null, priority: true },
    { id: "t4", date: TODAY, title: "مراجعة الحفظ مع الإخوة", at: "20:30", habitId: null, sortOrder: 0, doneAt: null },
    { id: "t5", date: TODAY, title: "شراء كتاب «الغيبة» للمكتبة", at: null, habitId: null, sortOrder: 1, doneAt: `${TODAY}T10:05:00Z` },
    { id: "t6", date: TODAY, title: "الاتصال بأبو حسن", at: null, habitId: null, sortOrder: 2, doneAt: null },
  ],
  tasksReady: true,
  groupPlan: null,
};

/** The shrine shown behind the gold design (a photo from public/mahdi/shrines). */
export const shrine = {
  id: "imam-ali", name: "حرم أمير المؤمنين", place: "النجف الأشرف", imageUrl: "/mahdi/shrines/imam-ali.jpg", imageAlt: "قبة حرم أمير المؤمنين",
  imagePosition: "50% 40%", imageCredit: "", isArtwork: false, active: true,
};
snapshot.shrines = [shrine];

// ——— the answers of the API ———

const person = (id: string, username: string, displayName: string): SocialUser => ({ id, username, displayName, avatarUrl: null, frame: "" });
const people = {
  hasan: person("u2", "abuhasan", "أبو حسن"),
  ali: person("u3", "ali_kadhim", "علي كاظم"),
  mahdi: person("u4", "mahdi313", "مهدي"),
  sajjad: person("u5", "sajjad", "سجاد"),
  me: person("u-jawad", "jawad", "جواد"),
};
const at = (hoursAgo: number) => new Date(Date.parse(`${TODAY}T14:40:00Z`) - hoursAgo * 3600_000).toISOString();

const posts: PostView[] = [
  {
    id: "post1", mine: false, author: people.hasan, kind: "quote", payload: null, closing: "",
    caption: "آية تعطي الأمل كل صباح 🤍",
    quote: { text: "وَنُرِيدُ أَن نَّمُنَّ عَلَى الَّذِينَ اسْتُضْعِفُوا فِي الْأَرْضِ وَنَجْعَلَهُمْ أَئِمَّةً وَنَجْعَلَهُمُ الْوَارِثِينَ", by: "سورة القصص · ٥" },
    media: null, createdAt: at(2), ahsant: 48, ahsantByMe: true, comments: 6, views: 312,
  },
  {
    id: "post2", mine: false, author: people.ali, kind: "week",
    payload: { kind: "week", title: "التزام هذا الأسبوع", value: "٨٨٪", sub: "تحسن +١٢ نقطة عن الأسبوع الماضي", label: "" },
    closing: "اللهم عجّل لوليك الفرج", caption: "الحمد لله، أفضل أسبوع لي من بداية السنة.", quote: null, media: null,
    createdAt: at(6), ahsant: 31, ahsantByMe: false, comments: 4, views: 205,
  },
  {
    id: "post3", mine: false, author: people.mahdi, kind: "photo", payload: null, closing: "", quote: null,
    caption: "زيارة الليلة عن كل الإخوة في التطبيق 🤲",
    media: { kind: "image", url: "/mahdi/shrines/imam-hussain.jpg", width: 1200, height: 800, ms: null },
    createdAt: at(20), ahsant: 96, ahsantByMe: false, comments: 14, views: 640,
  },
];

const story = (id: string, text: string, style: string, hoursAgo: number, seen = false) => ({
  id, kind: "quote" as const, media: null, text, style, createdAt: at(hoursAgo), expiresAt: at(hoursAgo - 24), seen,
});
const stories: StoryGroup[] = [
  { user: people.me, mine: true, stories: [story("st0", "يومي كامل الحمد لله", "gold", 1, true)], fresh: false },
  { user: people.hasan, mine: false, stories: [story("st1", "صباح الولاء", "gold", 3)], fresh: true },
  { user: people.ali, mine: false, stories: [story("st2", "ختمت الجزء العاشر", "green", 5)], fresh: true },
  { user: people.sajjad, mine: false, stories: [story("st3", "على طريق الزيارة", "night", 9)], fresh: true },
  { user: people.mahdi, mine: false, stories: [story("st4", "اللهم عجّل فرجه", "rose", 12, true)], fresh: false },
];

// the running khatma: by hizb quarters, 30 days, day 12, a little ahead of the plan
const khatmaStart = d(11);
const reads: { quarter: number; readOn: ISODate }[] = [];
let q = 1;
for (let i = 11; i >= 0; i--) {
  const n = i === 0 ? 6 : i === 4 ? 8 : 9;
  for (let k = 0; k < n; k++) reads.push({ quarter: q++, readOn: d(i) });
}

const healthProfile = { ...DEFAULT_PROFILE, age: 31, heightCm: 176, weightKg: 82, goals: ["muscle" as const, "fit" as const], level: "intermediate" as const, days: [0, 1, 2, 3], minutes: 60 };
const plan = { ...makePlan(healthProfile, "ready"), savedAt: "2026-10-01T10:00:00Z" };
const healthDays: DayLog[] = [];
for (let i = 1; i <= 21; i++) {
  if (i % 7 === 2 || i % 7 === 5) continue;
  healthDays.push({ date: d(i), sets: {}, cardioMin: 10, done: true, food: { proteinG: 140, waterCups: 8, kcal: 2400 }, bodyKg: i % 7 === 0 ? 82 + i / 14 : null, planDay: i % 4 });
}
healthDays.push({ date: TODAY, sets: {}, cardioMin: 0, done: false, food: { proteinG: 85, waterCups: 5, kcal: 1450, produce: 3, steps: 6200 }, bodyKg: 81.6 });

const board = {
  entries: [
    { rank: 1, user: people.hasan, score: 96, mine: false },
    { rank: 2, user: people.me, score: 91, mine: true },
    { rank: 3, user: people.ali, score: 88, mine: false },
    { rank: 4, user: people.sajjad, score: 84, mine: false },
    { rank: 5, user: people.mahdi, score: 79, mine: false },
  ],
  me: null,
};

const notes: Record<string, string> = {
  day: "الحمد لله، صليت الليل وقرأت ورد الختمة. باقي المشي بعد العشاء.",
  week: "أسبوع طيب: صلاة الليل صارت أثبت، والماء يبيله اهتمام أكثر.",
};

/** null = not mocked (logged by the entry, answered with {}). */
export function api(url: string, method: string): unknown {
  const u = new URL(url, "http://x");
  const p = u.pathname;
  if (method !== "GET") {
    if (p === "/api/mahdi/rewards") return { fresh: [], rewards: [] };
    if (p === "/api/mahdi/profile") return { profile: snapshot.profile };
    if (p === "/api/mahdi/logs") return { results: [] };
    return { ok: true };
  }
  switch (p) {
    case "/api/mahdi/inbox":
      return u.searchParams.get("count") ? { unread: 3 } : { items: [] };
    case "/api/mahdi/feedback":
      return { prompt: false };
    case "/api/mahdi/notes":
      return { note: notes[u.searchParams.get("kind") ?? ""] ?? "", ready: true };
    case "/api/mahdi/sync":
      return snapshot;
    case "/api/mahdi/groups":
      return {
        groups: [
          { id: "g1", name: "شباب الانتظار", isLeader: true, leaderName: "جواد", members: 12 },
          { id: "g2", name: "حلقة القرآن الأسبوعية", isLeader: false, leaderName: "أبو حسن", members: 8 },
        ],
        invites: [{ id: "g3", name: "مشاية الأربعين", isLeader: false, leaderName: "سجاد", members: 23, invitedBy: "سجاد" }],
      };
    case "/api/mahdi/khatma/mine":
      return {
        ready: true,
        today: TODAY,
        current: { id: "k1", number: 3, days: 30, startedOn: khatmaStart, status: "open", finishedOn: null, dedicatedTo: "صاحب العصر والزمان عجّل الله فرجه", forSoulOf: "", habitId: "h-quran", unit: "quarter", range: { from: 1, to: 240 }, reads },
        history: [
          { id: "k0", number: 2, days: 30, startedOn: "2026-08-20", status: "done", finishedOn: "2026-09-18", dedicatedTo: "الوالدين", forSoulOf: "", habitId: null, unit: "juz", range: { from: 1, to: 30 } },
          { id: "kx", number: 1, days: 60, startedOn: "2026-04-01", status: "done", finishedOn: "2026-05-28", dedicatedTo: "", forSoulOf: "", habitId: null, unit: "juz", range: { from: 1, to: 30 } },
        ],
      };
    case "/api/mahdi/khatma/reader":
      return { ready: true, timeHabitId: null, freePage: 182, todaySeconds: 1140 };
    case "/api/mahdi/health":
      return { ready: true, plan };
    case "/api/mahdi/health/days":
      return { ready: true, days: healthDays };
    case "/api/mahdi/community/posts":
      return { posts, more: false };
    case "/api/mahdi/social/stories":
      return { groups: stories };
    case "/api/mahdi/social/search":
      return { people: [] };
    case "/api/mahdi/leaderboard":
      return board;
    case "/api/mahdi/planner":
      return { items: [], ready: true };
    case "/api/mahdi/grow":
      return { items: [] };
  }
  return null;
}
