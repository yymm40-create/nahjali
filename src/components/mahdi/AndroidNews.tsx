"use client";

import { useEffect, useState } from "react";
import { t } from "@/lib/mahdi/i18n";
import Icon from "./Icon";
import { ANDROID_APK } from "./InstallCard";

const SEEN = "mahdi-android-news-1";
const A = t.androidNews;

/**
 * The announcement «التطبيق صار على الأندرويد»: shown on every page to everyone until they close it (or download),
 * never inside the installed app. Android phones get the download button; others see where to send it.
 */
export default function AndroidNews() {
  const [show, setShow] = useState(false);
  const [android, setAndroid] = useState(false);
  useEffect(() => {
    let seen = true;
    try {
      seen = localStorage.getItem(SEEN) === "1";
    } catch {}
    const installed = window.matchMedia("(display-mode: standalone)").matches || document.referrer.startsWith("android-app://");
    const id = setTimeout(() => {
      setAndroid(/Android/i.test(navigator.userAgent));
      setShow(!seen && !installed);
    }, 0);
    return () => clearTimeout(id);
  }, []);
  if (!show) return null;
  const close = () => {
    try {
      localStorage.setItem(SEEN, "1");
    } catch {}
    setShow(false);
  };
  return (
    <section className="m-card mx-4 mt-3 flex flex-wrap items-center gap-3 p-4 sm:mx-6 lg:mx-10" role="status" aria-labelledby="android-news">
      <span className="text-2xl" aria-hidden="true">📱</span>
      <div className="min-w-0 flex-1">
        <p id="android-news" className="font-semibold">{A.title}</p>
        <p className="m-muted text-sm">{android ? A.body : A.bodyOther}</p>
      </div>
      {android ? (
        <a href={ANDROID_APK} download className="m-btn m-btn-primary m-btn-sm" onClick={close}>
          {A.button}
        </a>
      ) : (
        <button
          type="button"
          className="m-btn m-btn-ghost m-btn-sm"
          onClick={() => {
            const url = `${location.origin}${ANDROID_APK}`;
            if (navigator.share) navigator.share({ title: A.title, url }).catch(() => {});
            else navigator.clipboard?.writeText(url).catch(() => {});
          }}
        >
          {A.share}
        </button>
      )}
      <button type="button" className="m-icon-btn" onClick={close} aria-label={t.common.close}>
        <Icon name="close" size={20} />
      </button>
    </section>
  );
}
