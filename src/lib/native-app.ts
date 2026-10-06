// نهج علي as a phone app (mobile/ in the repository, Capacitor): the site runs inside the app, and these helpers use
// what the phone offers. A web page can't download a file there, so a file is written to the app's cache and the
// phone's share sheet opens («احفظ الفيديو»، واتساب، إنستقرام…).

interface CapPlugins {
  Filesystem?: {
    writeFile: (o: { path: string; data: string; directory: string; recursive?: boolean }) => Promise<{ uri: string }>;
    appendFile: (o: { path: string; data: string; directory: string }) => Promise<void>;
    getUri: (o: { path: string; directory: string }) => Promise<{ uri: string }>;
  };
  Share?: { share: (o: { title?: string; text?: string; url?: string; files?: string[]; dialogTitle?: string }) => Promise<unknown> };
}
interface Cap {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins?: CapPlugins;
}

const cap = (): Cap | null => (typeof window === "undefined" ? null : ((window as unknown as { Capacitor?: Cap }).Capacitor ?? null));

/** True inside the iPhone or Android app. */
export const inNativeApp = () => !!cap()?.isNativePlatform?.();

const base64 = (b: Blob) =>
  new Promise<string>((ok, fail) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(",")[1] ?? "");
    r.onerror = () => fail(r.error);
    r.readAsDataURL(b);
  });

/** Saves or sends a file from inside the app: written in pieces (a long video too), then the share sheet. */
export async function nativeSave(blob: Blob, name: string) {
  const p = cap()?.Plugins;
  if (!p?.Filesystem || !p.Share) throw new Error("الحفظ غير متاح في هذا الإصدار من التطبيق.");
  const path = `shared/${Date.now()}-${name.replace(/[\\/:*?"<>|]+/g, "_").slice(-80) || "file"}`;
  const PIECE = 3 * 1024 * 1024;
  await p.Filesystem.writeFile({ path, data: await base64(blob.slice(0, PIECE)), directory: "CACHE", recursive: true });
  for (let at = PIECE; at < blob.size; at += PIECE) await p.Filesystem.appendFile({ path, data: await base64(blob.slice(at, at + PIECE)), directory: "CACHE" });
  const { uri } = await p.Filesystem.getUri({ path, directory: "CACHE" });
  await p.Share.share({ files: [uri], title: name, dialogTitle: "احفظ أو أرسل" });
}
