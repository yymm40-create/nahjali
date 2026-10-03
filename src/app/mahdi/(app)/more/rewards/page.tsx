"use client";

import { useEffect, useState } from "react";
import { MILESTONES, type Reward } from "@config/mahdi-rewards";
import { MAHDI_THEMES } from "@config/mahdi";
import { fmtNum, t } from "@/lib/mahdi/i18n";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import type { MilestoneMetrics } from "@/lib/mahdi/engine";
import type { Profile } from "@/lib/mahdi/types";
import Icon from "@/components/mahdi/Icon";
import { useMahdi } from "@/components/mahdi/Provider";
import { useLook } from "@/components/mahdi/ThemeRoot";

/** Milestones with their progress, and the unlocked frames / theme touches / views to use. */
export default function RewardsPage() {
  const { state, store, toast } = useMahdi();
  const look = useLook();
  const { profile, rewards } = state.snap;
  const [metrics, setMetrics] = useState<MilestoneMetrics | null>(null);
  const have = new Set(rewards.map((r) => r.milestoneId));

  useEffect(() => {
    mahdiFetch<{ metrics: MilestoneMetrics; rewards: typeof rewards }>("/api/mahdi/rewards", { method: "POST" })
      .then((r) => {
        setMetrics(r.metrics);
        store.setSnapPart({ rewards: r.rewards });
      })
      .catch(() => {});
  }, [store]);

  const isOn = (r: Reward) => (r.type === "frame" ? profile.frame === r.value : r.type === "variant" ? profile.themeVariant === r.value : profile.viewMode === r.value);

  async function toggle(r: Reward) {
    const on = isOn(r);
    const body = r.type === "frame" ? { frame: on ? "" : r.value } : r.type === "variant" ? { themeVariant: on ? "" : r.value, ...(on ? {} : { theme: r.theme }) } : { viewMode: on ? "list" : r.value };
    try {
      const { profile: p } = await mahdiFetch<{ profile: Profile }>("/api/mahdi/profile", { method: "PATCH", json: body });
      store.setProfile(p);
      if (r.type === "variant") {
        look.setVariant(p.themeVariant);
        look.setTheme(p.theme);
      }
      toast(t.common.saved);
    } catch (e) {
      toast((e as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="m-display text-3xl">{t.rewards.title}</h1>
        <p className="m-muted">{t.rewards.hint}</p>
      </header>
      <ul className="grid gap-3 md:grid-cols-2">
        {MILESTONES.map((m) => {
          const unlocked = have.has(m.id);
          const value = metrics ? Math.min(metrics[m.metric], m.threshold) : null;
          const on = unlocked && isOn(m.reward);
          return (
            <li key={m.id} className="m-card space-y-3 p-4" style={{ opacity: unlocked ? 1 : 0.85 }}>
              <div className="flex items-start gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-full" style={{ background: unlocked ? "var(--m-gold)" : "var(--m-surface-2)", color: unlocked ? "var(--m-gold-ink)" : "var(--m-muted)" }}>
                  <Icon name={unlocked ? "sparkle" : "lock"} size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{m.title}</p>
                  <p className="text-sm m-muted">{m.description}</p>
                </div>
                <span className={`m-chip shrink-0 ${unlocked ? "m-chip-success" : ""}`}>{unlocked ? t.rewards.unlocked : t.rewards.locked}</span>
              </div>
              {!unlocked && value !== null && (
                <div className="space-y-1">
                  <div className="m-bar" aria-hidden="true">
                    <span style={{ width: `${(value / m.threshold) * 100}%` }} />
                  </div>
                  <p className="m-num text-xs m-muted">{t.rewards.progress(Number(fmtNum(value)), m.threshold)}</p>
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>
                  {t.rewards.opens} {m.rewardLabel}
                  {m.reward.type === "variant" && <span className="m-muted"> ({MAHDI_THEMES.find((x) => x.key === (m.reward as { theme: string }).theme)?.label})</span>}
                </span>
                {unlocked && (
                  <button type="button" className={`m-btn m-btn-sm ${on ? "m-btn-ghost" : "m-btn-primary"}`} onClick={() => toggle(m.reward)}>
                    {on ? t.rewards.remove : t.rewards.apply}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
