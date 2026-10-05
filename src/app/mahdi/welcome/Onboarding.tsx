"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DEFAULT_SHRINE, MAHDI_LIMITS, PROJECT_SUGGESTIONS, type MahdiTheme } from "@config/mahdi";
import { t } from "@/lib/mahdi/i18n";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import type { Shrine } from "@/lib/mahdi/types";
import Icon from "@/components/mahdi/Icon";
import { ShrinePicker, ThemePicker } from "@/components/mahdi/LookPickers";
import { useLook } from "@/components/mahdi/ThemeRoot";

export default function Onboarding({ shrines, suggestedName, username: existingUsername }: { shrines: Shrine[]; suggestedName: string; username: string | null }) {
  const router = useRouter();
  const look = useLook();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(suggestedName);
  // the @username was claimed from the name on the way in; a taken name is sorted out later in «المزيد»
  const username = existingUsername;
  const [shrineId, setShrineId] = useState(look.shrine?.id ?? DEFAULT_SHRINE);
  const [project, setProject] = useState("");
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const steps = t.onboarding.steps;

  async function saveProfile() {
    setBusy(true);
    setError("");
    try {
      await mahdiFetch("/api/mahdi/profile", {
        method: "POST",
        json: { displayName: name.trim(), shrineId, theme: look.theme, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Riyadh" },
      });
      setStep(2);
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  async function finish(withProject: boolean) {
    setBusy(true);
    setError("");
    try {
      const chosen = custom.trim() || project;
      if (withProject && chosen) {
        const icon = PROJECT_SUGGESTIONS.find((s) => s.name === chosen)?.icon ?? "";
        const { id } = await mahdiFetch<{ id: string }>("/api/mahdi/projects", { method: "POST", json: { name: chosen, icon } });
        router.replace(`/mahdi/projects/${id}`);
      } else router.replace("/mahdi");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const next = () => setStep((s) => s + 1);
  const back = () => setStep((s) => Math.max(0, s - 1));

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
          <div className="space-y-5">
            <h1 className="text-2xl font-semibold">{t.onboarding.lookTitle}</h1>
            <div className="space-y-2">
              <p className="m-hint">{t.onboarding.shrineHint}</p>
              <ShrinePicker
                shrines={shrines}
                value={shrineId}
                onChange={(s) => {
                  setShrineId(s.id);
                  look.setShrine(s);
                }}
              />
            </div>
            <div className="space-y-2">
              <p className="m-hint">{t.onboarding.themeHint}</p>
              <ThemePicker value={look.theme} onChange={(th: MahdiTheme) => look.setTheme(th)} />
            </div>
            {error && <p className="m-error" role="alert">{error}</p>}
            <Nav back={back} next={saveProfile} canNext={!busy} label={busy ? t.common.saving : t.common.next} />
          </div>
        )}

        {step === 2 && (
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
            {error && <p className="m-error" role="alert">{error}</p>}
            <button type="button" className="m-btn m-btn-primary w-full" disabled={busy || !(custom.trim() || project)} onClick={() => finish(true)}>
              {busy ? t.common.saving : t.onboarding.projectCreate}
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

function Nav({ back, next, canNext, submit, label = t.common.next }: { back: () => void; next?: () => void; canNext: boolean; submit?: boolean; label?: string }) {
  return (
    <div className="flex gap-3 pt-2">
      <button type="button" className="m-btn m-btn-ghost" onClick={back}>
        <Icon name="chevronRight" size={18} /> {t.common.back}
      </button>
      <button type={submit ? "submit" : "button"} className="m-btn m-btn-primary flex-1" disabled={!canNext} onClick={submit ? undefined : next}>
        {label} <Icon name="chevronLeft" size={18} />
      </button>
    </div>
  );
}
