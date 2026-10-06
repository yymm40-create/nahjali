"use client";

import { useEffect, useState } from "react";
import Icon from "../Icon";

interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * «ثبّت الممنتج على جوالك»: the editor as an app on the home screen. Chrome and Android ask with their own window;
 * an iPhone (Safari) is shown the two taps it takes. Hidden once it runs as the app.
 */
export default function InstallApp({ compact = false }: { compact?: boolean }) {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [state, setState] = useState<{ standalone: boolean; ios: boolean; ready: boolean }>({ standalone: false, ios: false, ready: false });
  const [help, setHelp] = useState(false);

  useEffect(() => {
    navigator.serviceWorker?.register("/editor-sw.js", { scope: "/jawad-ai/" }).catch(() => {});
    const t = setTimeout(() => {
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      setState({ standalone, ios, ready: true });
    }, 0);
    const take = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
    };
    const done = () => setPrompt(null);
    window.addEventListener("beforeinstallprompt", take);
    window.addEventListener("appinstalled", done);
    return () => {
      clearTimeout(t);
      window.removeEventListener("beforeinstallprompt", take);
      window.removeEventListener("appinstalled", done);
    };
  }, []);

  if (!state.ready || state.standalone || (!prompt && !state.ios)) return null;

  const install = async () => {
    if (prompt) {
      await prompt.prompt().catch(() => {});
      await prompt.userChoice.catch(() => null);
      setPrompt(null);
    } else setHelp((v) => !v);
  };

  return (
    <div className={compact ? "" : "rounded-2xl border border-[#b8f53d]/40 bg-[#b8f53d]/10 p-3"}>
      <div className="flex flex-wrap items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {!compact && <img src="/editor-app/icon-192.png" alt="" className="size-11 rounded-xl" />}
        {!compact && (
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">ثبّت الممنتج على شاشتك الرئيسية</p>
            <p className="text-xs text-jw-muted">يفتح كتطبيق بملء الشاشة، بدون شريط المتصفح.</p>
          </div>
        )}
        <button type="button" className="jw-btn jw-btn-primary !min-h-9 text-sm" onClick={install}>
          <Icon name="download" size={16} /> ثبّت كتطبيق
        </button>
      </div>
      {help && (
        <ol className="mt-3 list-inside list-decimal space-y-1 text-sm">
          <li>
            اضغط زر <b>المشاركة</b> <span aria-hidden>⬆️</span> في أسفل Safari.
          </li>
          <li>
            اختر <b>«إضافة إلى الشاشة الرئيسية»</b> ثم <b>«إضافة»</b>.
          </li>
        </ol>
      )}
    </div>
  );
}
