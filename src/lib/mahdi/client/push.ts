// «لأجل المهدي» · this device and Web Push: can it get notifications, are they on, and turning them on or off.
// Shared by the notifications page and every «اجعله تنبيهًا» bell.
import { mahdiFetch } from "./fetch";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export type Device = "checking" | "unsupported" | "needs-install" | "not-configured" | "denied" | "off" | "on";

function keyToBytes(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Can this device get notifications, and are they on? */
export async function deviceState(): Promise<Device> {
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

/** Asks for permission, subscribes this device and tells the server. "on", or "denied" when the person said no. */
export async function enablePush(): Promise<"on" | "denied"> {
  const reg = await navigator.serviceWorker.register("/mahdi/sw.js", { scope: "/mahdi/" });
  await navigator.serviceWorker.ready;
  if ((await Notification.requestPermission()) !== "granted") return "denied";
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
  return "on";
}

/** Unsubscribes this device (here and on the server). */
export async function disablePush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration("/mahdi/");
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await mahdiFetch("/api/mahdi/notifications/subscribe", { method: "DELETE", json: { endpoint: sub.endpoint } });
    await sub.unsubscribe();
  }
}
