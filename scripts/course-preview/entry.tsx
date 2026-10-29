// Draws the course page with fake data (no server): ?phase=soon|A|B|C &sheet=form|bank|done &unlocked=1 &signed=1
import { createRoot } from "react-dom/client";
import CourseLanding from "@/components/jawad/course/CourseLanding";
import { DEFAULT_SETTINGS } from "@config/course";

const q = new URLSearchParams(location.search);
const phase = q.get("phase") ?? "A";
const HOUR = 3_600_000;
const now = Date.now();
const ago = phase === "soon" ? -3 * HOUR : phase === "A" ? 0.4 * HOUR : phase === "B" ? 30 * HOUR : 60 * HOUR;
const { bank, groupLink, recordedLink, videoPath, posterPath, ...rest } = DEFAULT_SETTINGS;
void bank; void groupLink; void recordedLink; void videoPath; void posterPath;
// the clock course as 0097_content_maker_course.sql writes it (?plain=1 draws a one-price course instead)
const ID = "3b68eb1d-ca1b-4e71-a5f7-78013603b443";
const words = q.get("plain") === "1" ? { ladderCourseId: "" } : {
  ladderCourseId: ID,
  headline: "من فكرة في راسك إلى كاروسيل وموشن جرافكس يوقّف السكرول، بضغطة زر",
  subhead: "دورة مباشرة ومسجلة: نمشي معك على منصة الجواد خطوة بخطوة، تسوي كاروسيل بستايل النوتبوك وموشن جرافكس جاهز للريلز والإعلانات، بأرخص الأسعار، وتعدّل فيه كل شي بنفسك.",
  problem: "تتعب على المحتوى، والسكرول يعدّيه في ثانية. الكاروسيل يبي له مصمم، والموشن جرافكس يبي له برامج مونتاج وشهور تعلّم أو مبالغ كبيرة على كل مقطع. والنتيجة: حساب واقف وإعلانات ما تجيب نتيجة.",
  days: [
    { title: "الكاروسيل اللي يوقّف السكرول", points: ["وش هو الكاروسيل: بوست تقلّبه بالسكرول، ومتى يكون أقوى من الصورة الوحدة", "قبل وبعد: كاروسيل سوّاه عميل في الجواد، وكيف صار خرافي بملاحظات بسيطة", "ستايل النوتبوك خطوة بخطوة، من الفكرة إلى آخر شريحة", "كيف تستخدمه في الإعلانات ونمو حسابك وشرح أي موضوع"] },
    { title: "الموشن جرافكس بضغطة زر", points: ["أمثلة موشن جرافكس كاملة، ومقاطع من فيديوهاتي", "تسوي موشن جرافكس من الجواد بضغطة زر وبأرخص الأسعار", "تعدّل كل كلمة ولون وحركة بنفسك بدون برامج", "تطلّعه جاهز للريلز والإعلانات"] },
  ],
  risks: ["تطبّق على منصة الجواد نفسها: بدون برامج ولا اشتراك شهري", "في البث المباشر تطبّق معي خطوة بخطوة وتسأل عن أي شي", "المسجلة (مع الدورة الكاملة أو المسجلة) تظهر لك في «دوراتي» مدى الحياة، تعيد أي درس لين تتقنه", "السعر اللي شفته محفوظ لك ٣ ساعات لين تحوّل"],
  liveWhen: "الخميس ٥ نوفمبر ٢٠٢٦ · الساعة تتحدد قريبًا",
  terms: "تنبيه مهم: إذا تُوفّي المدرّب أو عجز قبل تقديم الدورة أو قبل رفع نسختها المسجلة، فلا يكون عليه أي التزام مالي تجاه المشتركين.",
};
const s = { ...rest, ...words, launchAt: new Date(now - ago).toISOString(), videoFileUrl: q.get("video") === "0" ? null : "/reel.mp4", posterUrl: null, payable: true, bonus: { comboA: 0, recordedB: q.get("plain") === "1" ? 50 : 0, recordedC: q.get("plain") === "1" ? 50 : 0 } };

createRoot(document.getElementById("root")!).render(
  <CourseLanding
    s={s}
    courseId={q.get("plain") === "1" ? "00000000-0000-4000-8000-000000000001" : ID}
    title="وقّف السكرول: دورة صانع المحتوى للكاروسيل والموشن جرافكس"
    price={60}
    was={100}
    serverNow={now}
    user={q.get("signed") === "1" ? { email: "me@example.com" } : null}
    orders={[]}
    unlocked={q.get("unlocked") === "1" ? { confirmed: false, products: [], groupLink: "https://chat.whatsapp.com/x", recordedLink: "" } : null}
    buy={q.get("sheet") ? ((phase === "A" ? "combo" : "recorded") as never) : null}
    loginHref="/jawad-ai/login"
  />,
);
