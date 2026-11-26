// «لأجل المهدي» inside its phone app (mahdi-app/, Capacitor): the app opens these same pages, and gives them the phone's
// own notifications. There a reminder is BOOKED on the phone at its time (like an alarm) and comes even with no internet —
// the web's push doesn't reach a page inside an app. Nothing here runs in a browser.

interface LocalNotificationsPlugin {
  checkPermissions(): Promise<{ display: string }>;
  requestPermissions(): Promise<{ display: string }>;
  getPending(): Promise<{ notifications: { id: number }[] }>;
  cancel(o: { notifications: { id: number }[] }): Promise<void>;
  schedule(o: { notifications: NativeAlert[] }): Promise<unknown>;
  addListener?(event: "localNotificationActionPerformed", fn: (a: { notification?: { extra?: Record<string, string> } }) => void): Promise<{ remove: () => void }> | { remove: () => void };
}

export interface NativeAlert {
  id: number;
  title: string;
  body: string;
  schedule: { at: Date; allowWhileIdle: boolean };
  extra?: Record<string, string>;
}

type Cap = { isNativePlatform?: () => boolean; Plugins?: { LocalNotifications?: LocalNotificationsPlugin } };

function plugin(): LocalNotificationsPlugin | null {
  if (typeof window === "undefined") return null;
  const cap = (window as unknown as { Capacitor?: Cap }).Capacitor;
  return cap?.isNativePlatform?.() ? (cap.Plugins?.LocalNotifications ?? null) : null;
}

/** Inside the «لأجل المهدي» app (with its notifications), not a browser. */
export const inNativeApp = () => plugin() !== null;

/** "on", "denied" or "off" for the app's own notifications. */
export async function nativeNotifications(ask = false): Promise<"on" | "denied" | "off"> {
  const p = plugin();
  if (!p) return "off";
  const r = ask ? await p.requestPermissions() : await p.checkPermissions();
  return r.display === "granted" ? "on" : r.display === "denied" ? "denied" : "off";
}

/** Ids of the alerts this app books (so it only ever cancels its own). */
const FIRST_ID = 700_000;
export const alertId = (key: string) => {
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) | 0;
  return FIRST_ID + (Math.abs(h) % 1_000_000);
};

/** Replaces every alert booked before with `alerts` (the ones still ahead). */
export async function bookAlerts(alerts: NativeAlert[]): Promise<void> {
  const p = plugin();
  if (!p) return;
  const pending = await p.getPending();
  const mine = pending.notifications.filter((n) => n.id >= FIRST_ID);
  if (mine.length) await p.cancel({ notifications: mine.map((n) => ({ id: n.id })) });
  if (!alerts.length || (await p.checkPermissions()).display !== "granted") return;
  const ahead = alerts.filter((a) => a.schedule.at.getTime() > Date.now() + 5_000).slice(0, 60);
  if (ahead.length) await p.schedule({ notifications: ahead });
}

/** Only the app's own screens open from a reminder (anything else goes to the home). */
export const safeAlertPath = (url: unknown) => (typeof url === "string" && /^\/mahdi(\/|$|\?)/.test(url) && !url.startsWith("//") ? url : "/mahdi");

/** A tap on one of the app's reminders: `go` gets the screen it is for (the habit itself, the day of a task). Returns
 *  the way to stop listening. */
export function onAlertTap(go: (path: string) => void): () => void {
  const p = plugin();
  if (!p?.addListener) return () => {};
  let handle: { remove: () => void } | null = null;
  let gone = false;
  Promise.resolve(p.addListener("localNotificationActionPerformed", (a) => go(safeAlertPath(a.notification?.extra?.url))))
    .then((h) => {
      if (gone) h.remove();
      else handle = h;
    })
    .catch(() => {});
  return () => {
    gone = true;
    handle?.remove();
  };
}
