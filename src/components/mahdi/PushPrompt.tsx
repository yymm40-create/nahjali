"use client";

// «فعّل التنبيهات» on the home: notifications only reach the devices that turned them on, and that switch used to sit in «المزيد → الإشعارات»
// where almost nobody went. So the home asks, once, with one button; «لاحقًا» puts it off for a few days, and it never shows on a device that
// already said yes or no (the browser's answer is kept), or cannot get notifications at all.

import Link from "next/link";
import { useEffect, useState } from "react";
import { deviceState, enablePush, type Device } from "@/lib/mahdi/client/push";
import Icon from "./Icon";
import { useMahdi } from "./Provider";

const KEY = "mahdi-push-prompt-later";
const LATER_DAYS = 3;

export function laterStillOn(raw: string | null, now: number): boolean {
  const at = Number(raw);
  return Number.isFinite(at) && at > 0 && now - at < LATER_DAYS * 86_400_000;
}

export default function PushPrompt() {
  const { toast } = useMahdi();
  const [device, setDevice] = useState<Device>("checking");
  const [hidden, setHidden] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    let later = false;
    try {
      later = laterStillOn(localStorage.getItem(KEY), Date.now());
    } catch {}
    deviceState()
      .then((d) => {
        if (!live) return;
        setDevice(d);
        setHidden(later);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  // only where it can work: this device can get them and has not turned them on (iPhone: after adding the app to the home screen)
  if (hidden || (device !== "off" && device !== "needs-install")) return null;

  const later = () => {
    try {
      localStorage.setItem(KEY, String(Date.now()));
    } catch {}
    setHidden(true);
  };
  const turnOn = async () => {
    setBusy(true);
    try {
      const r = await enablePush();
      setDevice(r);
      if (r === "on") toast("تمام، بتوصلك تنبيهات لأجل المهدي.");
    } catch (e) {
      toast((e as Error).message || "ما قدرنا نفعّلها. جرّب من «الإشعارات».");
    }
    setBusy(false);
  };

  return (
    <section className="m-card flex flex-col gap-3 p-4" aria-label="فعّل التنبيهات">
      <div className="flex items-start gap-3">
        <Icon name="bell" size={22} className="m-gold mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="font-semibold">فعّل التنبيهات</p>
          <p className="text-sm m-muted">
            {device === "needs-install"
              ? "على الآيفون: ثبّت التطبيق على الشاشة الرئيسية (زر المشاركة ← إضافة إلى الشاشة الرئيسية) وافتحه منها، بعدها فعّل التنبيهات."
              : "آية ورواية كل صباح، وتذكير بعاداتك وملاحظة يومك، وننبهك قبل ما تنقطع سلسلتك. مرتين في اليوم بالأكثر."}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {device === "off" ? (
          <button type="button" className="m-btn m-btn-primary m-btn-sm" disabled={busy} onClick={turnOn}>
            فعّلها
          </button>
        ) : (
          <Link href="/mahdi/more/notifications" className="m-btn m-btn-primary m-btn-sm">كيف أثبّته؟</Link>
        )}
        <button type="button" className="m-btn m-btn-ghost m-btn-sm" onClick={later}>لاحقًا</button>
      </div>
    </section>
  );
}
