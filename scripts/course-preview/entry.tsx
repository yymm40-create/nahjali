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
const s = { ...rest, launchAt: new Date(now - ago).toISOString(), videoFileUrl: q.get("video") === "0" ? null : "/reel.mp4", posterUrl: null, payable: true, bonus: { comboA: 0, recordedB: 50, recordedC: 50 } };

createRoot(document.getElementById("root")!).render(
  <CourseLanding
    s={s}
    serverNow={now}
    user={q.get("signed") === "1" ? { email: "me@example.com" } : null}
    orders={[]}
    unlocked={q.get("unlocked") === "1" ? { confirmed: false, products: [], groupLink: "https://chat.whatsapp.com/x", recordedLink: "" } : null}
    buy={q.get("sheet") ? ((phase === "A" ? "combo" : "recorded") as never) : null}
    loginHref="/jawad-ai/login"
  />,
);
