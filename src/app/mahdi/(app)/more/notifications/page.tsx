"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { t } from "@/lib/mahdi/i18n";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import { ENGAGE, ENGAGE_DAILY_MAX, engageOn } from "@/lib/mahdi/engage";
import { readHints, writeHints, type HintPrefs } from "@/lib/mahdi/client/review-hints";
import type { NotificationSettings } from "@/lib/mahdi/types";
import Icon from "@/components/mahdi/Icon";
import { useMahdi } from "@/components/mahdi/Provider";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const MODES = ["off", "daily", "every_12h", "every_6h", "custom"] as const;

type Device = "checking" | "unsupported" | "needs-install" | "not-configured" | "denied" | "off" | "on";

function keyToBytes(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Can this device get notifications, and are they on? */
async function deviceState(): Promise<Device> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    return ios && !standalone ? "needs-install" : "unsupported";
  }
  if (!VAPID_PUBLIC) return "not-configured";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.getRegistration("/mahdi/");
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === "granted" ? "on" : "off";
}

interface Status {
  configured: boolean;
  cronSecret: boolean;
  devices: number;
  admin: boolean;
  heartbeatReady?: boolean;
  runs?: { ran_at: string; age_min: number; checked: number; sent: number; engage_sent: number }[];
  devicesAll?: number;
  engageLastDay?: number | null;
}

const ago = (m: number) => {
  return m < 1 ? "الحين" : m < 60 ? `قبل ${m} دقيقة` : m < 1440 ? `قبل ${Math.round(m / 60)} ساعة` : `قبل ${Math.round(m / 1440)} يوم`;
};

/** The state of the system, for the owner: are the keys set, did the 15-minute dispatcher run lately, how many devices. */
function SystemStatus({ status }: { status: Status }) {
  const last = status.runs?.[0]?.age_min;
  const alive = last !== undefined && last < 40;
  const rows: [string, boolean | null, string][] = [
    ["مفاتيح الإشعارات (VAPID) في الموقع", status.configured, status.configured ? "موجودة" : "ناقصة: ضعها في إعدادات الموقع"],
    ["كلمة سر المجدوِل (MAHDI_CRON_SECRET)", status.cronSecret, status.cronSecret ? "موجودة" : "ناقصة أو قصيرة"],
    ["المجدوِل (كل ١٥ دقيقة)", status.heartbeatReady ? alive : null, !status.heartbeatReady ? "ما نعرف: شغّل ملف 0098" : last !== undefined ? `آخر تشغيل ${ago(last)}` : "ما اشتغل ولا مرة: شغّل ملف 0009 (الجدولة)"],
  ];
  return (
    <section className="m-card space-y-3 p-5" aria-labelledby="sys-title">
      <h2 id="sys-title" className="font-semibold">حالة نظام الإشعارات (للمالك)</h2>
      <ul className="space-y-2 text-sm">
        {rows.map(([label, ok, note]) => (
          <li key={label} className="flex items-center justify-between gap-3">
            <span>{label}</span>
            <span className="m-num font-semibold" style={{ color: ok === null ? "var(--m-muted)" : ok ? "var(--m-success)" : "var(--m-warning)" }}>{ok === null ? "؟" : ok ? "✓" : "✗"} {note}</span>
          </li>
        ))}
      </ul>
      <p className="m-num m-muted text-xs">
        أجهزة مشتركة: {status.devicesAll ?? "؟"} · آخر ٢٤ ساعة أُرسل {status.engageLastDay ?? "؟"} تنبيه جذب
        {status.runs?.length ? ` · آخر تشغيل أرسل ${status.runs[0].sent} تذكير و${status.runs[0].engage_sent} تنبيه جذب` : ""}
      </p>
    </section>
  );
}

/** Reminder settings, and turning notifications on for this device. */
export default function NotificationsPage() {
  const { state, store, toast } = useMahdi();
  const saved = state.snap.notifications;
  const [form, setForm] = useState<NotificationSettings>(saved);
  const [busy, setBusy] = useState(false);
  const [device, setDevice] = useState<Device>("checking");
  const [status, setStatus] = useState<Status | null>(null);
  const [hints, setHints] = useState<HintPrefs | null>(null);

  useEffect(() => {
    let live = true;
    deviceState().then((d) => live && setDevice(d));
    mahdiFetch<Status>("/api/mahdi/notifications/status").then((s) => live && setStatus(s)).catch(() => {});
    const id = setTimeout(() => live && setHints(readHints()), 0);
    return () => {
      clearTimeout(id);
      live = false;
    };
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.register("/mahdi/sw.js", { scope: "/mahdi/" });
      await navigator.serviceWorker.ready;
      if ((await Notification.requestPermission()) !== "granted") return setDevice("denied");
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        try {
          sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(VAPID_PUBLIC) });
        } catch {
          // An old subscription made with other keys: drop it and try once more
          await (await reg.pushManager.getSubscription())?.unsubscribe();
          sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(VAPID_PUBLIC) });
        }
      }
      await mahdiFetch("/api/mahdi/notifications/subscribe", { method: "POST", json: sub.toJSON() });
      setDevice("on");
      toast(t.notify.enabled);
    } catch (e) {
      toast((e as Error).message || t.errors.generic);
    }
    setBusy(false);
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/mahdi/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await mahdiFetch("/api/mahdi/notifications/subscribe", { method: "DELETE", json: { endpoint: sub.endpoint } });
        await sub.unsubscribe();
      }
      setDevice("off");
      toast(t.notify.disabled);
    } catch (e) {
      toast((e as Error).message);
    }
    setBusy(false);
  }

  async function test() {
    setBusy(true);
    try {
      await mahdiFetch("/api/mahdi/notifications/test", { method: "POST" });
      toast(t.notify.testSent);
    } catch (e) {
      toast((e as Error).message);
    }
    setBusy(false);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const times = form.mode === "custom" ? form.times : form.times.slice(0, 1);
      const { notifications } = await mahdiFetch<{ notifications: NotificationSettings }>("/api/mahdi/notifications", { method: "PUT", json: { ...form, times } });
      store.setSnapPart({ notifications });
      setForm(notifications);
      toast(t.notify.saved);
    } catch (err) {
      toast((err as Error).message);
    }
    setBusy(false);
  }

  const setTime = (i: number, v: string) => setForm((f) => ({ ...f, times: f.times.map((x, k) => (k === i ? v : x)) }));
  const times = form.times.length ? form.times : ["20:00"];
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);

  const deviceNote: Partial<Record<Device, string>> = {
    unsupported: t.notify.unsupported,
    "needs-install": t.notify.iosHint,
    "not-configured": t.notify.notConfigured,
    denied: t.notify.denied,
  };

  return (
    <div className="space-y-6">
      <Link href="/mahdi/more" className="m-btn m-btn-quiet m-btn-sm -ms-3">
        <Icon name="chevronRight" size={18} /> {t.more.title}
      </Link>
      <h1 className="m-display text-3xl">{t.notify.title}</h1>
      <p className="m-note">{t.notify.intro}</p>

      <section className="m-card space-y-4 p-5" aria-labelledby="dev-title">
        <h2 id="dev-title" className="font-semibold">{t.notify.device}</h2>
        {device === "checking" && <p className="m-muted">{t.common.loading}</p>}
        {deviceNote[device] && <p className="m-note">{deviceNote[device]}</p>}
        {device === "off" && (
          <>
            <p className="text-sm m-muted">{t.notify.deviceOff}</p>
            <button type="button" className="m-btn m-btn-primary w-full" disabled={busy} onClick={enable}>
              <Icon name="sparkle" size={18} /> {t.notify.enable}
            </button>
          </>
        )}
        {device === "on" && (
          <>
            <p className="m-chip m-chip-success w-fit"><Icon name="check" size={14} /> {t.notify.enabled}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <button type="button" className="m-btn m-btn-ghost" disabled={busy} onClick={test}>{t.notify.test}</button>
              <button type="button" className="m-btn m-btn-quiet" disabled={busy} onClick={disable}>{t.notify.disable}</button>
            </div>
          </>
        )}
      </section>

      <form className="m-card space-y-5 p-5" onSubmit={save} aria-labelledby="set-title">
        <h2 id="set-title" className="font-semibold">{t.notify.settings}</h2>

        <fieldset>
          <legend className="m-label">{t.notify.mode}</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label={t.notify.mode}>
            {MODES.map((m) => (
              <button key={m} type="button" role="radio" aria-checked={form.mode === m} className="m-option min-h-11 px-3 text-sm font-semibold" onClick={() => setForm((f) => ({ ...f, mode: m }))}>
                {t.notify.modes[m]}
              </button>
            ))}
          </div>
        </fieldset>

        {form.mode !== "off" && form.mode !== "custom" && (
          <label className="block">
            <span className="m-label">{form.mode === "daily" ? t.notify.startTime : t.notify.startTimeFrom}</span>
            <input type="time" className="m-field m-num" dir="ltr" required value={times[0]} onChange={(e) => setTime(0, e.target.value)} />
          </label>
        )}

        {form.mode === "custom" && (
          <fieldset className="space-y-2">
            <legend className="m-label">{t.notify.timesCustom}</legend>
            {times.map((v, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="time" className="m-field m-num flex-1" dir="ltr" required value={v} aria-label={`${t.notify.times} ${i + 1}`} onChange={(e) => setTime(i, e.target.value)} />
                {times.length > 1 && (
                  <button type="button" className="m-icon-btn" aria-label={t.notify.removeTime} onClick={() => setForm((f) => ({ ...f, times: times.filter((_, k) => k !== i) }))}>
                    <Icon name="close" size={20} />
                  </button>
                )}
              </div>
            ))}
            {times.length < 6 && (
              <button type="button" className="m-btn m-btn-ghost m-btn-sm" onClick={() => setForm((f) => ({ ...f, times: [...times, "12:00"] }))}>
                <Icon name="plus" size={16} /> {t.notify.addTime}
              </button>
            )}
          </fieldset>
        )}

        {form.mode !== "off" && (
          <>
            <fieldset>
              <legend className="m-label">{t.notify.quiet}</legend>
              <div className="grid grid-cols-2 gap-3">
                <label>
                  <span className="m-hint">{t.notify.quietFrom}</span>
                  <input type="time" className="m-field m-num" dir="ltr" required value={form.quietStart} onChange={(e) => setForm((f) => ({ ...f, quietStart: e.target.value }))} />
                </label>
                <label>
                  <span className="m-hint">{t.notify.quietTo}</span>
                  <input type="time" className="m-field m-num" dir="ltr" required value={form.quietEnd} onChange={(e) => setForm((f) => ({ ...f, quietEnd: e.target.value }))} />
                </label>
              </div>
              <p className="m-hint mt-1">{t.notify.quietHint}</p>
            </fieldset>

            <label className="flex min-h-12 items-start justify-between gap-4">
              <span>
                <span className="block font-semibold">{t.notify.habitReminders}</span>
                <span className="block text-sm m-muted">{t.notify.habitRemindersHint}</span>
              </span>
              <input type="checkbox" role="switch" className="mt-1 size-6 shrink-0 accent-[var(--m-gold)]" checked={form.habitReminders} onChange={(e) => setForm((f) => ({ ...f, habitReminders: e.target.checked }))} />
            </label>
            <p className="text-sm m-muted">{t.notify.skipHint}</p>
            {device === "off" && <p className="m-note text-sm">{t.notify.needDevice}</p>}
          </>
        )}

        <fieldset className="space-y-3 border-t pt-4" style={{ borderColor: "var(--m-line)" }}>
          <legend className="m-label">تنبيهات تجيبك للتطبيق</legend>
          <p className="text-sm m-muted">تجيك على جهازك (إذا فعّلته فوق) بحد أقصى {ENGAGE_DAILY_MAX} في اليوم، وتحترم وقت الهدوء. شيل اللي ما تبيه.</p>
          {ENGAGE.map((e) => (
            <label key={e.id} className="flex min-h-12 items-start justify-between gap-4">
              <span>
                <span className="block font-semibold">{e.ar}</span>
                <span className="block text-sm m-muted">{e.hint} · <span className="m-num" dir="ltr">{e.at}</span></span>
              </span>
              <input
                type="checkbox"
                role="switch"
                className="mt-1 size-6 shrink-0 accent-[var(--m-gold)]"
                checked={engageOn(form.engage, e.id)}
                onChange={(ev) =>
                  setForm((f) => {
                    const next = { ...(f.engage ?? {}) };
                    if (ev.target.checked) delete next[e.id];
                    else next[e.id] = false;
                    return { ...f, engage: next };
                  })
                }
              />
            </label>
          ))}
        </fieldset>

        <button className="m-btn m-btn-primary w-full" disabled={busy || !dirty}>{busy ? t.common.saving : t.common.save}</button>
      </form>

      {hints && (
        <section className="m-card space-y-3 p-5" aria-labelledby="hint-title">
          <h2 id="hint-title" className="font-semibold">بطاقات التذكير في الرئيسية</h2>
          <p className="text-sm m-muted">بطاقة «اكتب ملاحظتك» تطلع في الرئيسية آخر اليوم وآخر الأسبوع. تنحفظ على هذا الجهاز.</p>
          {(
            [
              ["day", "ملاحظة يومك"],
              ["week", "ملاحظة أسبوعك"],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="flex min-h-11 items-center justify-between gap-4">
              <span className="font-semibold">{label}</span>
              <input type="checkbox" role="switch" className="size-6 shrink-0 accent-[var(--m-gold)]" checked={hints[k]} onChange={(e) => setHints(writeHints({ [k]: e.target.checked }))} />
            </label>
          ))}
        </section>
      )}

      {status?.admin && <SystemStatus status={status} />}
    </div>
  );
}
