"use client";

import { useEffect, useState } from "react";
import { t } from "@/lib/mahdi/i18n";
import Icon from "./Icon";

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
}

/** "Add to home screen": the browser's install prompt where available, instructions on iPhone. */
export default function InstallCard() {
  const [evt, setEvt] = useState<InstallEvent | null>(null);
  const [standalone, setStandalone] = useState(true);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    setStandalone(window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true);
    setIos(/iPad|iPhone|iPod/.test(navigator.userAgent));
    const on = (e: Event) => {
      e.preventDefault();
      setEvt(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", on);
    return () => window.removeEventListener("beforeinstallprompt", on);
  }, []);

  if (standalone || (!evt && !ios)) return null;
  return (
    <section className="m-card flex flex-wrap items-center gap-3 p-4">
      <Icon name="arrowDown" className="m-gold" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{t.install.title}</p>
        <p className="text-sm m-muted">{ios ? t.install.ios : t.install.body}</p>
      </div>
      {evt && (
        <button
          type="button"
          className="m-btn m-btn-primary m-btn-sm"
          onClick={async () => {
            await evt.prompt();
            setEvt(null);
          }}
        >
          {t.install.button}
        </button>
      )}
    </section>
  );
}
