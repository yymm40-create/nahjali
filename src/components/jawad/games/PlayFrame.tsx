"use client";

// A built game, full screen: the game in its fenced frame (sandboxed, see playCsp), under a slim bar with the site's name,
// the title, «شارك» (the phone's share sheet, else the link copied), full screen, and «اصنع لعبتك» for whoever got the link.
// An error the game hits is reported once (the owner of the game sees it and can have it fixed).

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { PLAYS, playSource } from "@/lib/games/plays-shared";

const never = () => () => {};

const LOCAL = (id: string) => `jw-game-save:${id}`;
const VISITOR = "jw-game-visitor";
const pack = (d: Record<string, string>) => encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(d)))));

export default function PlayFrame({ id, title, src, makeHref, loginHref = "/jawad-ai/login" }: { id: string; title: string; src: string; makeHref: string; loginHref?: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [toast, setToast] = useState("");
  // «احفظ تقدمك»: the game's progress on the player's site account (on this device until they sign in)
  const [save, setSave] = useState<{ signedIn: boolean; email: string | null; data: Record<string, string> } | null>(null);
  useEffect(() => {
    let local: Record<string, string> = {};
    try {
      local = JSON.parse(localStorage.getItem(LOCAL(id)) ?? "{}") ?? {};
    } catch {}
    fetch(`/api/games/play/${id}/save`)
      .then((r) => r.json())
      .then((r: { signedIn: boolean; email: string | null; data: Record<string, string> | null }) => {
        // signed in for the first time with progress on this device: it goes to the account
        const data = r.data ?? local;
        if (r.signedIn && !r.data && Object.keys(local).length) void fetch(`/api/games/play/${id}/save`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ data: local }) });
        setSave({ signedIn: r.signedIn, email: r.email, data });
      })
      .catch(() => setSave({ signedIn: false, email: null, data: local }));
  }, [id]);
  useEffect(() => {
    if (!save) return;
    const onSave = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return;
      const d = e.data as { jwGame?: string; data?: unknown } | null;
      if (d?.jwGame !== "save" || !d.data || typeof d.data !== "object") return;
      try {
        localStorage.setItem(LOCAL(id), JSON.stringify(d.data));
      } catch {}
      if (save.signedIn) void fetch(`/api/games/play/${id}/save`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ data: d.data }) }).catch(() => null);
    };
    window.addEventListener("message", onSave);
    return () => window.removeEventListener("message", onSave);
  }, [id, save]);
  // the game's counter: a sitting while the game is on screen, its seconds sent every few (and when the page is left);
  // this browser has its own random id, so a player is counted once however many times they open it
  const ready = !!save;
  useEffect(() => {
    if (!ready) return;
    let visitor = "";
    try {
      visitor = localStorage.getItem(VISITOR) ?? "";
      if (!visitor) localStorage.setItem(VISITOR, (visitor = crypto.randomUUID().replace(/-/g, "")));
    } catch {
      visitor = crypto.randomUUID().replace(/-/g, "");
    }
    const url = `/api/games/play/${id}/visit`;
    const source = playSource({ referrer: document.referrer, ua: navigator.userAgent, search: window.location.search, host: window.location.hostname });
    let session: string | null = null;
    let last = Date.now();
    const body = (add: number) => JSON.stringify({ visitor, session, add, source });
    const send = (add: number) =>
      void fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: body(add), keepalive: true })
        .then((r) => r.json())
        .then((r: { session?: string | null }) => {
          if (r.session) session = r.session;
        })
        .catch(() => null);
    const since = () => {
      const add = Math.round((Date.now() - last) / 1000);
      last = Date.now();
      return add;
    };
    send(0);
    const t = setInterval(() => {
      if (document.visibilityState !== "visible") {
        last = Date.now();
        return;
      }
      const add = since();
      if (add > 0) send(add);
    }, PLAYS.tickSeconds * 1000);
    const onVis = () => {
      if (document.visibilityState === "visible") {
        last = Date.now();
        return;
      }
      const add = since();
      if (add > 0 && session) navigator.sendBeacon?.(url, body(add));
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [id, ready]);
  // full screen where the browser allows it on an element (not iPhone Safari)
  const canFull = useSyncExternalStore(never, () => !!document.documentElement.requestFullscreen, () => false);

  useEffect(() => {
    const sent = new Set<string>();
    const onMsg = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return;
      const d = e.data as { jwGame?: string; message?: unknown } | null;
      if (d?.jwGame !== "error" || typeof d.message !== "string" || sent.has(d.message) || sent.size >= 3) return;
      sent.add(d.message);
      void fetch(`/api/games/play/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ error: d.message }) }).catch(() => null);
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [id]);

  const say = (t: string) => {
    setToast(t);
    setTimeout(() => setToast(""), 2200);
  };

  async function share() {
    const url = window.location.href.split("#")[0];
    const text = `جرّب لعبتي «${title}» 🎮`;
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text}\n${url}`);
      say("انسخ الرابط ✓ أرسله لربعك");
    } catch {
      /* the share sheet was closed */
    }
  }

  function full() {
    const el = document.documentElement;
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => null);
    else void el.requestFullscreen?.().catch(() => null);
    frame.current?.focus();
  }

  return (
    <div className="pl" dir="rtl">
      <header className="pl-bar">
        <a className="pl-brand" href="/jawad-ai" target="_blank" rel="noopener">
          {/* eslint-disable-next-line @next/next/no-img-element -- the site's own small logo */}
          <img src="/jawad-ai/logo.png" alt="" width={26} height={26} />
          <b>الجواد الذكي</b>
        </a>
        <span className="pl-title">{title}</span>
        {save && (save.signedIn ? (
          <span className="pl-btn" title={save.email ?? ""}>💾 تقدمك محفوظ</span>
        ) : (
          <a className="pl-btn" href={`${loginHref}?next=${encodeURIComponent(`/play/${id}`)}`} title="سجّل دخول بإيميلك ويتحفظ تقدمك على حسابك">🔐 احفظ تقدمك</a>
        ))}
        <button type="button" className="pl-btn" onClick={() => void share()} aria-label="شارك اللعبة">↗ شارك</button>
        {canFull && <button type="button" className="pl-btn" onClick={full} aria-label="ملء الشاشة">⛶</button>}
        <a className="pl-btn hot" href={makeHref} target="_blank" rel="noopener">🎮 اصنع لعبتك</a>
      </header>
      {save && <iframe
        ref={frame}
        className="pl-frame"
        src={Object.keys(save.data).length ? `${src}#jws=${pack(save.data)}` : src}
        title={title}
        sandbox="allow-scripts allow-pointer-lock"
        allow="autoplay; fullscreen; gamepad"
        onLoad={() => frame.current?.focus()}
      />}
      {toast && <div className="pl-toast" role="status">{toast}</div>}
    </div>
  );
}
