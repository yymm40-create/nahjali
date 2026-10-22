"use client";

// The ad pixels (Meta, TikTok, Snap) and where the visitor came from. Rendered once, in the root layout. Everything is
// optional: a pixel loads only when its NEXT_PUBLIC_*_PIXEL_ID is set (nothing is requested otherwise), the landing
// address's source is kept in the jw_src / jw_last cookies (src/lib/track.ts), PageView goes out on the first page and on
// every client-side navigation, and a brand-new account's first page reports CompleteRegistration.
//
// How the sign-up is known, with the least coupling: /auth/callback and /auth/confirm — the only places the server makes a
// session — set a 10-minute cookie jw_new=1 when the account was created minutes ago (markFreshSignup); this component,
// present on every page, reads it once, fires the event and clears it. No page or layout has to know anything about it.
// A page may also send `?signup=1` for the same effect (the parameter is removed from the address afterwards).
//
// The official base snippets are injected as they are, without their own PageView call (fired here instead, so a
// client-side navigation counts too). Their stubs queue calls until the network script arrives, so an event fired right
// after the boot is never lost.

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { captureVisitorSource, clearCookie, NEW_SIGNUP_COOKIE, readCookie, track } from "@/lib/track";

const META = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "";
const TIKTOK = process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID ?? "";
const SNAP = process.env.NEXT_PUBLIC_SNAP_PIXEL_ID ?? "";
// a pixel id is letters, digits, - or _ (the env value goes into a script: nothing else may pass)
const ID = /^[\w-]{1,64}$/;

/** Does any pixel exist? The source and the sign-up mark are still kept without one (the order keeps the source). */
export const PIXELS_ON = [META, TIKTOK, SNAP].some((id) => ID.test(id));

function inline(code: string) {
  const s = document.createElement("script");
  s.textContent = code;
  document.head.appendChild(s);
}

let booted = false;
function boot() {
  if (booted || typeof window === "undefined") return;
  booted = true;
  try {
    if (ID.test(META) && !window.fbq) {
      inline(
        `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${META}');`,
      );
    }
    if (ID.test(TIKTOK) && !window.ttq) {
      inline(
        `!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script");n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};ttq.load('${TIKTOK}');}(window,document,'ttq');`,
      );
    }
    if (ID.test(SNAP) && !window.snaptr) {
      inline(
        `(function(e,t,n){if(e.snaptr)return;var a=e.snaptr=function(){a.handleRequest?a.handleRequest.apply(a,arguments):a.queue.push(arguments)};a.queue=[];var s='script';var r=t.createElement(s);r.async=!0;r.src=n;var u=t.getElementsByTagName(s)[0];u.parentNode.insertBefore(r,u);})(window,document,'https://sc-static.net/scevent.min.js');snaptr('init','${SNAP}');`,
      );
    }
  } catch {
    /* a pixel that fails to boot changes nothing on the page */
  }
}

/** `?signup=1` on the address: true once, and the parameter is taken off the address. */
function signupParam(): boolean {
  try {
    const url = new URL(location.href);
    if (url.searchParams.get("signup") !== "1") return false;
    url.searchParams.delete("signup");
    history.replaceState(history.state, "", url.pathname + url.search + url.hash);
    return true;
  } catch {
    return false;
  }
}

export default function Pixels() {
  const path = usePathname() ?? "/";
  // once: the pixels' stubs, and the landing address's source (before anything else reads it)
  useEffect(() => {
    boot();
    captureVisitorSource();
  }, []);
  // every page (the first one included; the owner's pages are not an audience)
  useEffect(() => {
    if (path.startsWith("/admin") || path.startsWith("/jawad-ai/admin")) return;
    track("PageView");
    const fresh = readCookie(NEW_SIGNUP_COOKIE);
    if (fresh) clearCookie(NEW_SIGNUP_COOKIE);
    if (fresh || signupParam()) track("CompleteRegistration");
  }, [path]);
  return null;
}
