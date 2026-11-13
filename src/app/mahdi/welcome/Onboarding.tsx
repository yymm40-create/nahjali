"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DEFAULT_SHRINE, MAHDI_LIMITS, PROJECT_SUGGESTIONS, type MahdiTheme } from "@config/mahdi";
import { t } from "@/lib/mahdi/i18n";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import { rememberPick } from "@/lib/mahdi/client/look-pick";
import type { Shrine } from "@/lib/mahdi/types";
import Icon from "@/components/mahdi/Icon";
import { useLook } from "@/components/mahdi/ThemeRoot";
import { NEWCOMER } from "@/components/mahdi/FirstSteps";

export default function Onboarding({ suggestedName, username: existingUsername }: { shrines: Shrine[]; suggestedName: string; username: string | null }) {
  const router = useRouter();
  const look = useLook();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(suggestedName);
  // the @username was claimed from the name on the way in; a taken name is sorted out later in «المزيد»
  const username = existingUsername;
  const shrineId = look.shrine?.id ?? DEFAULT_SHRINE;
  const [project, setProject] = useState("");
  const [custom, setCustom] = useState("");
  const [habit, setHabit] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const steps = t.onboarding.steps;

  // The look (shrine and design) is no longer asked here: the first «تم» comes first, and the home invites the
  // person to pick their look right after it (FirstSteps). The account starts with the look on the screen now.
  async function saveProfile() {
    const { profile: saved } = await mahdiFetch<{ profile: { theme: MahdiTheme; userId: string } }>("/api/mahdi/profile", {
      method: "POST",
      json: { displayName: name.trim(), shrineId, theme: look.theme, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Riyadh" },
    });
    // the pick stays on this device too, in case the account could not keep it
    rememberPick(saved.userId, look.theme, saved.theme);
  }

  /** Name → project + first habit → the home, where one tap gives the first «تم». */
  async function finish(withProject: boolean) {
    setBusy(true);
    setError("");
    try {
      await saveProfile();
      try {
        localStorage.setItem(NEWCOMER, "1");
      } catch {}
      const chosen = custom.trim() || project;
      if (withProject && chosen) {
        const icon = PROJECT_SUGGESTIONS.find((s) => s.name === chosen)?.icon ?? "";
        const { id } = await mahdiFetch<{ id: string }>("/api/mahdi/projects", { method: "POST", json: { name: chosen, icon } });
        await mahdiFetch("/api/mahdi/habits", { method: "POST", json: { projectId: id, name: habit.trim(), measure: "check", freq: "daily", target: 1 } });
      }
      router.replace("/mahdi");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const next = () => setStep((s) => s + 1);

  return (
    <main id="m-main" className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col justify-end gap-6 px-4 pb-10 pt-[20vh]">
      <ol className="flex gap-1.5" aria-label={t.onboarding.steps.join("، ")}>
        {steps.map((s, i) => (
          <li key={s} className="h-1.5 flex-1 rounded-full" style={{ background: i <= step ? "var(--m-gold)" : "var(--m-track)" }} aria-current={i === step ? "step" : undefined}>
            <span className="sr-only">{s}</span>
          </li>
        ))}
      </ol>

      <section className="m-card space-y-6 p-6">
        {step === 0 && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return setError(t.onboarding.nameRequired);
              next();
            }}
          >
            <h1 className="m-display m-gold text-3xl">{t.onboarding.welcomeTitle}</h1>
            <p className="text-lg">{t.onboarding.welcomeBody}</p>
            <h2 className="text-xl font-semibold">{t.onboarding.nameTitle}</h2>
            <label className="block">
              <span className="sr-only">{t.more.name}</span>
              <input
                className="m-field text-lg"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError("");
                }}
                maxLength={MAHDI_LIMITS.nameMax}
                placeholder={t.onboarding.namePlaceholder}
                autoFocus
                required
              />
            </label>
            {name.trim() && <p className="m-display m-gold text-2xl">{t.mawla(name.trim())}</p>}
            <p className="m-hint">{t.onboarding.nameHint}</p>
            {username && <p className="m-chip w-fit" dir="auto">{t.username.yours(username)}</p>}
            <button type="submit" className="m-btn m-btn-primary w-full text-lg" disabled={!name.trim()}>
              {t.onboarding.start} <Icon name="chevronLeft" size={18} />
            </button>
          </form>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <h1 className="text-2xl font-semibold">{t.onboarding.projectTitle}</h1>
            <p className="m-hint">{t.onboarding.projectHint}</p>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t.project.name}>
              {PROJECT_SUGGESTIONS.map((s) => (
                <button
                  key={s.name}
                  type="button"
                  role="radio"
                  aria-checked={!custom && project === s.name}
                  className="m-option min-h-12 px-4 font-semibold"
                  onClick={() => {
                    setProject(s.name);
                    setCustom("");
                  }}
                >
                  <span aria-hidden="true">{s.icon}</span> {s.name}
                </button>
              ))}
            </div>
            <label className="block">
              <span className="sr-only">{t.onboarding.projectCustom}</span>
              <input className="m-field" value={custom} onChange={(e) => setCustom(e.target.value)} maxLength={MAHDI_LIMITS.projectNameMax} placeholder={t.onboarding.projectCustom} />
            </label>
            <label className="block space-y-1">
              <span className="font-semibold">{t.onboarding.habitTitle}</span>
              <input className="m-field text-lg" value={habit} onChange={(e) => setHabit(e.target.value)} maxLength={MAHDI_LIMITS.habitNameMax} placeholder={t.onboarding.habitPlaceholder} />
              <span className="m-hint block">{t.onboarding.habitHint}</span>
            </label>
            {error && <p className="m-error" role="alert">{error}</p>}
            <button type="button" className="m-btn m-btn-primary w-full" disabled={busy || !(custom.trim() || project) || !habit.trim()} onClick={() => finish(true)}>
              {busy ? t.common.saving : t.onboarding.habitCreate}
            </button>
            <button type="button" className="m-btn m-btn-quiet w-full" disabled={busy} onClick={() => finish(false)}>
              {t.onboarding.skip}
            </button>
          </div>
        )}
        {error && step === 0 && <p className="m-error" role="alert">{error}</p>}
      </section>
    </main>
  );
}
