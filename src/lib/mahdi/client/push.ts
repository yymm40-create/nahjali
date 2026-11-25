// «لأجل المهدي» · this device and Web Push: can it get notifications, are they on, and turning them on or off.
// Shared by the notifications page and every «اجعله تنبيهًا» bell.
import { mahdiFetch } from "./fetch";
import { bookAlerts, inNativeApp, nativeNotifications } from "./native";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export type Device = "checking" | "unsupported" | "needs-install" | "not-configured" | "denied" | "off" | "on";

function keyToBytes(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Can this device get notifications, and are they on? */
export async function deviceState(): Promise<Device> {
  // inside the «لأجل المهدي» app: its own notifications (booked on the phone), not the web's push
  if (inNativeApp()) return nativeNotifications();
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

/** Rejects when a step of the browser never answers (a service worker that never gets ready, a permission prompt that
 *  never shows), so «احفظ» never hangs (a member's report, 24 November 2026). */
function inTime<T>(p: Promise<T>, ms = 12_000): Promise<T> {
  return Promise.race([p, new Promise<T>((_, no) => setTimeout(() => no(new Error("المتصفح ما ردّ على تفعيل الإشعارات. سكّر التطبيق وافتحه من جديد وجرّب مرة ثانية.")), ms))]);
}

/** Resolves once the registration has an active worker (installing → activated). */
function activated(reg: ServiceWorkerRegistration): Promise<void> {
  if (reg.active) return Promise.resolve();
  const w = reg.installing ?? reg.waiting;
  if (!w) return Promise.resolve();
  return new Promise((done, fail) => {
    w.addEventListener("statechange", () => {
      if (w.state === "activated") done();
      else if (w.state === "redundant") fail(new Error("service worker failed"));
    });
  });
}

/** Asks for permission, subscribes this device and tells the server. "on", or "denied" when the person said no. Call it
 *  straight from the tap: the permission is asked first, while the tap still counts (iPhone needs that). */
export async function enablePush(): Promise<"on" | "denied"> {
  if (inNativeApp()) return (await nativeNotifications(true)) === "on" ? "on" : "denied";
  const permission = Notification.permission === "granted" ? "granted" : await inTime(Notification.requestPermission(), 60_000);
  if (permission !== "granted") return "denied";
  const reg = await inTime(navigator.serviceWorker.register("/mahdi/sw.js", { scope: "/mahdi/" }));
  // not `navigator.serviceWorker.ready`: it waits for a worker of THIS page's scope, and the home page /mahdi (no slash) is
  // outside /mahdi/ — so on the home page it never came (a member's report, 24 November 2026). Wait for this one instead.
  await inTime(activated(reg));
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    try {
      sub = await inTime(reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(VAPID_PUBLIC) }));
    } catch {
      // An old subscription made with other keys: drop it and try once more
      await (await reg.pushManager.getSubscription())?.unsubscribe();
      sub = await inTime(reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(VAPID_PUBLIC) }));
    }
  }
  await inTime(mahdiFetch("/api/mahdi/notifications/subscribe", { method: "POST", json: sub.toJSON() }));
  return "on";
}

/** Unsubscribes this device (here and on the server). */
export async function disablePush(): Promise<void> {
  if (inNativeApp()) return bookAlerts([]);
  const reg = await navigator.serviceWorker.getRegistration("/mahdi/");
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await mahdiFetch("/api/mahdi/notifications/subscribe", { method: "DELETE", json: { endpoint: sub.endpoint } });
    await sub.unsubscribe();
  }
}
