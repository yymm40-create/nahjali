"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { MAHDI_LIMITS, type MahdiTheme } from "@config/mahdi";
import { t } from "@/lib/mahdi/i18n";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import { createClient } from "@/lib/supabase/client";
import type { Profile, Shrine } from "@/lib/mahdi/types";
import Avatar from "@/components/mahdi/Avatar";
import { FeedbackCard } from "@/components/mahdi/Feedback";
import InstallCard from "@/components/mahdi/InstallCard";
import UsernameForm from "@/components/mahdi/UsernameForm";
import Icon from "@/components/mahdi/Icon";
import { ShrinePicker, ThemePicker } from "@/components/mahdi/LookPickers";
import { useMahdi } from "@/components/mahdi/Provider";
import { useLook } from "@/components/mahdi/ThemeRoot";

/** Account and settings: name, picture, look, calendar, time zone, sign out. */
export default function MorePage() {
  const router = useRouter();
  const { state, store, toast } = useMahdi();
  const look = useLook();
  const { profile, shrines } = state.snap;
  const [name, setName] = useState(profile.displayName);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const deviceTz = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "";

  async function save(fields: Partial<Record<string, unknown>>, undo?: () => void) {
    try {
      const { profile: p } = await mahdiFetch<{ profile: Profile }>("/api/mahdi/profile", { method: "PATCH", json: fields });
      store.setProfile(p);
      toast(t.common.saved);
    } catch (e) {
      undo?.();
      toast((e as Error).message);
    }
  }

  async function upload(file: File) {
    if (file.size > MAHDI_LIMITS.avatarMaxBytes) return toast(t.more.avatarTooBig);
    setBusy(true);
    const form = new FormData();
    form.append("file", file);
    try {
      const { profile: p } = await mahdiFetch<{ profile: Profile }>("/api/mahdi/profile/avatar", { method: "POST", body: form });
      store.setProfile(p);
      toast(t.common.saved);
    } catch (e) {
      toast((e as Error).message);
    }
    setBusy(false);
  }

  const chooseTheme = (th: MahdiTheme) => {
    const before = look.theme;
    look.setTheme(th);
    save({ theme: th }, () => look.setTheme(before));
  };
  const chooseShrine = (s: Shrine) => {
    const before = look.shrine;
    look.setShrine(s);
    save({ shrineId: s.id }, () => look.setShrine(before));
  };

  return (
    <div className="space-y-6">
      <h1 className="m-display text-3xl">{t.more.title}</h1>

      <nav className="grid gap-2 sm:grid-cols-2" aria-label={t.more.title}>
        {(
          [
            ["/mahdi/more/family", "users", t.family.link],
            ["/mahdi/reading", "book", t.reading.title],
            ["/mahdi/groups", "users", t.groups.title],
            ["/mahdi/more/rewards", "sparkle", t.rewards.title],
            ["/mahdi/community", "globe", t.community.title],
            ["/mahdi/more/privacy", "lock", t.privacy.title],
            ["/mahdi/more/notifications", "settings", t.notify.title],
          ] as const
        ).map(([href, icon, label]) => (
          <Link key={href} href={href} className="m-card flex items-center gap-3 p-4 font-semibold">
            <Icon name={icon} className="m-gold" /> <span className="flex-1">{label}</span> <Icon name="chevronLeft" size={18} />
          </Link>
        ))}
      </nav>
      <FeedbackCard place="more" />
      <InstallCard />

      <section className="m-card space-y-5 p-5">
        <h2 className="font-semibold">{t.more.profile}</h2>
        <div className="flex flex-wrap items-center gap-4">
          <Avatar profile={profile} size={72} />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="m-btn m-btn-ghost m-btn-sm" disabled={busy} onClick={() => fileRef.current?.click()}>
              <Icon name="image" size={18} /> {t.more.avatarPick}
            </button>
            {profile.avatarUrl && (
              <button
                type="button"
                className="m-btn m-btn-quiet m-btn-sm"
                disabled={busy}
                onClick={async () => {
                  try {
                    const { profile: p } = await mahdiFetch<{ profile: Profile }>("/api/mahdi/profile/avatar", { method: "DELETE" });
                    store.setProfile(p);
                  } catch (e) {
                    toast((e as Error).message);
                  }
                }}
              >
                {t.more.avatarRemove}
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f);
                e.target.value = "";
              }}
            />
          </div>
          <p className="m-hint w-full">{t.more.avatarHint}</p>
        </div>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim() && name.trim() !== profile.displayName) save({ displayName: name.trim() });
          }}
        >
          <label className="min-w-48 flex-1">
            <span className="m-label">{t.more.name}</span>
            <input className="m-field" value={name} onChange={(e) => setName(e.target.value)} maxLength={MAHDI_LIMITS.nameMax} required />
          </label>
          <button className="m-btn m-btn-ghost" disabled={!name.trim() || name.trim() === profile.displayName}>
            {t.common.save}
          </button>
        </form>
        <p className="text-sm m-muted">{t.mawla(profile.displayName)}</p>
        <div className="border-t pt-4" style={{ borderColor: "var(--m-line)" }}>
          <UsernameForm />
        </div>
      </section>

      <section className="m-card space-y-4 p-5">
        <h2 className="font-semibold">{t.more.theme}</h2>
        <ThemePicker value={look.theme} onChange={chooseTheme} />
        <h2 className="pt-2 font-semibold">{t.more.shrine}</h2>
        <ShrinePicker shrines={shrines} value={look.shrine?.id ?? profile.shrineId} onChange={chooseShrine} />
        {look.shrine?.isArtwork && <p className="m-hint">{t.more.artwork}</p>}
      </section>

      <section className="m-card space-y-4 p-5">
        <h2 className="font-semibold">{t.more.calendar}</h2>
        <label className="block">
          <span className="m-label">{t.more.weekStart}</span>
          <select className="m-field" value={profile.weekStart} onChange={(e) => save({ weekStart: Number(e.target.value) })}>
            {[6, 0, 1].map((d) => (
              <option key={d} value={d}>
                {t.weekdays[d]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-h-12 items-center justify-between gap-3">
          <span className="font-semibold">{t.more.showHijri}</span>
          <input type="checkbox" className="size-6 accent-[var(--m-gold)]" checked={profile.showHijri} onChange={(e) => save({ showHijri: e.target.checked })} />
        </label>
        {profile.showHijri && (
          <label className="block">
            <span className="m-label">{t.more.hijriOffset}</span>
            <select className="m-field" value={profile.hijriOffset} onChange={(e) => save({ hijriOffset: Number(e.target.value) })}>
              {[-2, -1, 0, 1, 2].map((n) => (
                <option key={n} value={n}>
                  {n > 0 ? `+${n}` : n}
                </option>
              ))}
            </select>
            <span className="m-hint mt-1 block">{t.more.hijriOffsetHint}</span>
          </label>
        )}
        <div>
          <p className="m-label">{t.more.timeZone}</p>
          <p className="text-sm" dir="ltr" style={{ textAlign: "right" }}>{profile.timeZone}</p>
          <p className="m-hint">{t.more.timeZoneHint}</p>
          {deviceTz && deviceTz !== profile.timeZone && (
            <button type="button" className="m-btn m-btn-ghost m-btn-sm mt-2" onClick={() => save({ timeZone: deviceTz })}>
              {t.more.useDeviceTz(deviceTz)}
            </button>
          )}
        </div>
      </section>

      <section className="m-card space-y-2 p-5">
        <h2 className="font-semibold">{t.more.account}</h2>
        <button
          type="button"
          className="m-btn m-btn-ghost w-full justify-start"
          onClick={async () => {
            await createClient().auth.signOut();
            router.replace("/mahdi/start");
            router.refresh();
          }}
        >
          <Icon name="logout" /> {t.auth.logout}
        </button>
        <Link href="/" className="m-btn m-btn-quiet w-full justify-start">
          <Icon name="chevronRight" /> {t.backToSite}
        </Link>
      </section>
    </div>
  );
}
