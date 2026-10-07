// «🩺 تشخيص» (the owner only): what «حيدرة» needs to find what went wrong in this browser — the errors the page met
// (uncaught, rejected, logged), the requests to the server that failed, the notes the editor itself writes, and what
// this device and browser can do. Kept in memory while the editor is open (the last 200), never sent by itself: only
// with a diagnosis the owner asks for.

export interface DiagEntry {
  /** ms since the editor opened */
  t: number;
  kind: "error" | "rejection" | "console" | "fetch" | "note" | "media";
  text: string;
}

const MAX = 200;
const log: DiagEntry[] = [];
let started = 0;

const cut = (s: string, n = 600) => (s.length > n ? `${s.slice(0, n)}…` : s);
const say = (v: unknown): string => {
  if (v instanceof Error) return `${v.name}: ${v.message}${v.stack ? `\n${v.stack.split("\n").slice(1, 5).join("\n")}` : ""}`;
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
};

/** Something the editor wants a diagnosis to know (a failed step, a message shown to the person). */
export function diagNote(text: string, kind: DiagEntry["kind"] = "note") {
  if (!started) return;
  log.push({ t: Math.round(performance.now() - started), kind, text: cut(text) });
  if (log.length > MAX) log.splice(0, log.length - MAX);
}

/** Starts listening (once per page). */
export function startDiag() {
  if (started || typeof window === "undefined") return;
  started = performance.now();
  window.addEventListener("error", (e) => {
    const target = e.target as HTMLElement | null;
    // a picture, video or script that failed to load (no message of its own)
    if (target && target !== (window as unknown) && "tagName" in target) diagNote(`${target.tagName.toLowerCase()} failed to load: ${cut(String((target as HTMLMediaElement).currentSrc || (target as HTMLImageElement).src || ""), 160)}`, "media");
    else diagNote(`${e.message} @ ${e.filename?.split("/").pop()}:${e.lineno}:${e.colno}${e.error ? `\n${say(e.error)}` : ""}`, "error");
  }, true);
  window.addEventListener("unhandledrejection", (e) => diagNote(say(e.reason), "rejection"));
  for (const level of ["error", "warn"] as const) {
    const orig = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      diagNote(`${level}: ${args.map(say).join(" ")}`, "console");
      orig(...args);
    };
  }
  const f = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const path = (() => {
      try {
        const u = new URL(url, location.href);
        return u.origin === location.origin ? u.pathname + u.search.slice(0, 80) : u.host + u.pathname.slice(0, 60);
      } catch {
        return url.slice(0, 120);
      }
    })();
    const method = init?.method ?? (input instanceof Request ? input.method : "GET");
    const action = (() => {
      try {
        return typeof init?.body === "string" ? (JSON.parse(init.body) as { action?: string }).action : undefined;
      } catch {
        return undefined;
      }
    })();
    const t0 = performance.now();
    try {
      const r = await f(input, init);
      if (!r.ok) {
        const raw = await r.clone().text().catch(() => "");
        // a whole HTML page (a 404 or an error page) says nothing more than its status
        const body = /^\s*<(!doctype|html)/i.test(raw) ? "(an HTML page)" : raw;
        diagNote(`${method} ${path}${action ? ` (${action})` : ""} → ${r.status} in ${Math.round(performance.now() - t0)} ms: ${cut(body, 300)}`, "fetch");
      }
      return r;
    } catch (e) {
      diagNote(`${method} ${path}${action ? ` (${action})` : ""} → network error after ${Math.round(performance.now() - t0)} ms: ${say(e)}`, "fetch");
      throw e;
    }
  };
}

/** What this device and browser can do (the usual reasons something works on one computer and not another). */
async function device() {
  const n = navigator as Navigator & { deviceMemory?: number; connection?: { effectiveType?: string; downlink?: number; saveData?: boolean } };
  let gl: Record<string, unknown> = { webgl2: false };
  try {
    const c = document.createElement("canvas");
    const g = c.getContext("webgl2");
    if (g) {
      const dbg = g.getExtension("WEBGL_debug_renderer_info");
      gl = {
        webgl2: true,
        renderer: dbg ? g.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER),
        maxTexture: g.getParameter(g.MAX_TEXTURE_SIZE),
        floatColour: !!g.getExtension("EXT_color_buffer_float"),
      };
      g.getExtension("WEBGL_lose_context")?.loseContext();
    }
  } catch {
    /* none */
  }
  const storage = await navigator.storage?.estimate?.().catch(() => null);
  const w = window as unknown as Record<string, unknown>;
  return {
    userAgent: n.userAgent,
    language: n.language,
    screen: `${screen.width}x${screen.height} @${devicePixelRatio}`,
    viewport: `${innerWidth}x${innerHeight}`,
    cores: n.hardwareConcurrency,
    memoryGB: n.deviceMemory,
    online: n.onLine,
    connection: n.connection ? { type: n.connection.effectiveType, mbps: n.connection.downlink, saveData: n.connection.saveData } : undefined,
    storage: storage ? { usedMB: Math.round((storage.usage ?? 0) / 1e6), quotaMB: Math.round((storage.quota ?? 0) / 1e6) } : undefined,
    ...gl,
    webcodecs: { VideoEncoder: "VideoEncoder" in w, VideoDecoder: "VideoDecoder" in w, AudioEncoder: "AudioEncoder" in w, AudioDecoder: "AudioDecoder" in w },
    offscreenCanvas: "OffscreenCanvas" in w,
    crossOriginIsolated: window.crossOriginIsolated,
    standalone: matchMedia("(display-mode: standalone)").matches,
  };
}

/** The editor's own media elements as they stand (loaded or stuck, and why). */
function mediaElements() {
  return Array.from(document.querySelectorAll("video, audio"))
    .slice(0, 20)
    .map((el) => {
      const m = el as HTMLMediaElement;
      return { tag: m.tagName.toLowerCase(), src: cut(m.currentSrc.split("?")[0].split("/").slice(-2).join("/"), 80), readyState: m.readyState, networkState: m.networkState, paused: m.paused, time: Math.round(m.currentTime * 10) / 10, error: m.error ? `${m.error.code}: ${m.error.message}` : null };
    });
}

/** The preview as it looks now (a small JPEG, base64), when the page has one. */
export function previewShot(): string | null {
  const c = document.querySelector("canvas.jw-screen") as HTMLCanvasElement | null;
  if (!c || !c.width) return null;
  try {
    const k = Math.min(1, 720 / Math.max(c.width, c.height));
    const s = document.createElement("canvas");
    s.width = Math.round(c.width * k);
    s.height = Math.round(c.height * k);
    s.getContext("2d")!.drawImage(c, 0, 0, s.width, s.height);
    return s.toDataURL("image/jpeg", 0.75).split(",")[1];
  } catch {
    return null;
  }
}

/** Everything gathered for one diagnosis. */
export async function diagReport(app: Record<string, unknown>) {
  return {
    openForSec: started ? Math.round((performance.now() - started) / 1000) : 0,
    device: await device(),
    app,
    media: mediaElements(),
    log: log.slice(-MAX),
  };
}
