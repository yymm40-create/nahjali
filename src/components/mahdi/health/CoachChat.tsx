"use client";

// «عباس سبع القنطرة» on every page of «الصحة العلوية»: a small movable bubble that opens his chat. He explains, asks,
// and changes the plan directly (the setup's answers, the nutrition targets, the table), moves the person to a page or a
// step, and can start the setup again from the beginning. He also sees the last two weeks of the tracker.

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import MovableBubble from "@/components/MovableBubble";
import RobotFace from "@/components/RobotFace";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import type { HealthPlan, HealthProfile } from "@/lib/mahdi/health/plan";
import type { DayLog } from "@/lib/mahdi/health/tracker";
import { COACH } from "./HealthApp";
import { useHealth, type SetupStep } from "./HealthProvider";

const SETUP = ["track", "about", "goal", "train", "mode"] as const;

/** The tracker of the last 14 days, for عباس to see how it is going. */
function recentDays(days: Record<string, DayLog>, today: string): DayLog[] {
  const from = new Date(new Date(`${today}T12:00:00Z`).getTime() - 13 * 86400000).toISOString().slice(0, 10);
  return Object.values(days).filter((d) => d.date >= from && d.date <= today);
}

interface CoachMsg {
  role: "user" | "assistant";
  text: string;
  changed?: boolean;
  error?: boolean;
}

/** «عباس سبع القنطرة» on the side: a small movable bubble that opens his chat; he can change the plan directly. */
export default function CoachChat() {
  const router = useRouter();
  const path = usePathname() ?? "";
  const { uid, profile, setProfile, plan, save, step, setStep, days, today } = useHealth();
  const female = profile.sex === "female";
  // where the person is: a step of the setup, or a page of the app
  const screen = path.endsWith("/setup") ? step : (path.split("/mahdi/health/")[1] ?? "today").split("/")[0] || "today";
  const onResult = (r: { profile: HealthProfile; plan: HealthPlan | null; go: string; restart?: boolean }) => {
    setProfile(r.profile);
    if (r.plan && plan) save(r.plan);
    if (r.restart) {
      setStep("track");
      router.push("/mahdi/health/setup");
      return;
    }
    const g = r.go;
    if (!g) return;
    if ((SETUP as readonly string[]).includes(g)) {
      setStep(g as SetupStep);
      router.push("/mahdi/health/setup");
    } else if (g === "today") router.push("/mahdi/health");
    else if (plan || !["plan", "habits"].includes(g)) router.push(`/mahdi/health/${g}`);
  };
  const key = `mahdi-health-chat:${uid}`;
  const hello: CoachMsg = {
    role: "assistant",
    text: female
      ? "هلا يا بطلة 🦁 أنا عباس سبع القنطرة. أي شي ما فهمتيه أو تبين تغيرينه في خطتك قولي لي، وأنا أعدله لك على طول."
      : "هلا يا بطل 🦁 أنا عباس سبع القنطرة. أي شي ما فهمته أو تبي تغيره في خطتك قول لي، وأنا أعدله لك على طول.",
  };
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<CoachMsg[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) ?? "null") as CoachMsg[] | null;
      return Array.isArray(saved) && saved.length ? saved : [hello];
    } catch {
      return [hello];
    }
  });
  const [choices, setChoices] = useState<string[]>(["ما فهمت الخطة، اشرح لي", "ما عندي أدوات، عدّل الجدول", "أبي أنزل وزن وأبني عضل", "عندي إصابة في ركبتي"]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(list.slice(-400)));
    } catch {
      /* private window */
    }
    end.current?.scrollIntoView({ block: "nearest" });
  }, [list, key, busy]);

  const send = async (text: string) => {
    const said = text.trim();
    if (!said || busy) return;
    const next = [...list, { role: "user" as const, text: said }];
    setList(next);
    setDraft("");
    setChoices([]);
    setBusy(true);
    try {
      const r = await mahdiFetch<{ reply: string; choices: string[]; profile: HealthProfile; plan: HealthPlan | null; go: string; restart: boolean; changed: boolean }>("/api/mahdi/health/coach", {
        method: "POST",
        json: { messages: next.filter((m) => !m.error).map(({ role, text }) => ({ role, text })), profile, plan, screen, recent: recentDays(days, today) },
      });
      setList((l) => [...l, { role: "assistant", text: r.reply, changed: r.changed }]);
      setChoices(r.choices ?? []);
      onResult(r);
    } catch (e) {
      setList((l) => [...l, { role: "assistant", text: (e as Error).message || "عباس ما قدر يرد الحين، جرّب بعد شوي.", error: true }]);
    } finally {
      setBusy(false);
    }
  };

  // «أرتبها مع عباس» on the setup (or any page) opens the chat with a first message; it is sent once the plan is there
  const [pending, setPending] = useState("");
  useEffect(() => {
    const on = (e: Event) => {
      const text = String((e as CustomEvent<{ text?: string }>).detail?.text ?? "").trim();
      setOpen(true);
      if (text) setPending(text);
    };
    window.addEventListener("gym-coach", on);
    return () => window.removeEventListener("gym-coach", on);
  }, []);
  useEffect(() => {
    if (!pending || !plan || busy) return;
    const text = pending;
    setPending("");
    void send(text);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- send once, when the plan has arrived
  }, [pending, plan, busy]);

  return (
    <>
      <MovableBubble id="mahdi-coach" corner="left" size={52} label="عباس سبع القنطرة: اسألني" gradient="linear-gradient(135deg, #c6ff1a, #5c7a00)" hidden={open} onPress={() => setOpen(true)}>
        <RobotFace id="sabaa" size={38} />
      </MovableBubble>
      {open && (
        <aside className="gym-chat" role="dialog" aria-modal="false" aria-label="محادثة عباس سبع القنطرة" dir="rtl">
          <header>
            <RobotFace id="sabaa" size={38} />
            <div>
              <b>{COACH}</b>
              <small>مدربك · يعدّل خطتك مباشرة</small>
            </div>
            <button type="button" className="gym-icon-btn" onClick={() => setOpen(false)} aria-label="إغلاق">✕</button>
          </header>
          <div className="gym-chat-list" aria-live="polite">
            {list.map((m, i) => (
              <div key={i} className={`gym-msg ${m.role}${m.error ? " err" : ""}`}>
                {m.text}
                {m.changed && <span className="gym-msg-tag">✓ عدّلت خطتك</span>}
              </div>
            ))}
            {busy && <div className="gym-msg assistant">عباس يكتب… 🏋️</div>}
            <div ref={end} />
          </div>
          {!!choices.length && !busy && (
            <div className="gym-chips px-3 pb-2">
              {choices.map((c) => (
                <button key={c} type="button" className="gym-chip" onClick={() => void send(c)}>
                  {c}
                </button>
              ))}
            </div>
          )}
          <form className="gym-chat-send" onSubmit={(e) => (e.preventDefault(), void send(draft))}>
            <textarea
              className="gym-input"
              rows={2}
              maxLength={1500}
              placeholder="اكتب لعباس…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(draft);
                }
              }}
            />
            <button type="submit" className="gym-btn sm" disabled={busy || !draft.trim()}>
              إرسال
            </button>
          </form>
          <p className="gym-chat-note">عباس مساعد ذكي وقد يخطئ؛ عندك مشكلة صحية؟ ارجع لطبيبك.</p>
        </aside>
      )}
    </>
  );
}

