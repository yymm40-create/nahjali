// «الجواد AI» on the desktop (Mac and Windows): JAWAD AI and its editor «حيدرة كت» in a window of their own. Files from the computer are not
// uploaded: the program remembers where each one is and serves it to the editor from the disk (haidara-media://),
// so a large video is on the timeline at once and the preview, the cuts and the export all run on the computer.
// Only the timeline itself (a little text), the person's account and what is asked of حيدرة go over the internet.
// The editor's pages come from the live site, so every update reaches the program as soon as it is published.

const { app, BrowserWindow, Menu, dialog, ipcMain, protocol, session, shell } = require("electron");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { Readable } = require("node:stream");

const SITE = new URL(process.env.HAIDARA_URL || "https://nahjali.vercel.app");
const START = new URL("/jawad-ai?desktop=1", SITE).toString();
// the places sign-in passes through (Google, and the login service) stay inside the window
const SIGN_IN = [/(^|\.)accounts\.google\.com$/, /(^|\.)google\.com$/, /(^|\.)gstatic\.com$/, /\.supabase\.co$/, /(^|\.)appleid\.apple\.com$/];

process.env.HAIDARA_VERSION = app.getVersion();
// (the program was «حيدرة كت» before: its data folder keeps that name, so the sign-in and the computer's files that
// were added stay after the update)
app.setPath("userData", path.join(app.getPath("appData"), "حيدرة كت"));
app.setName("الجواد AI");

if (!app.requestSingleInstanceLock()) app.quit();

// the computer's files, served to the editor like files on the web (seeking, reading from the page, no limits)
const SCHEME = "haidara-media";
protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true, bypassCSP: true } },
]);

let win = null;

const ours = (u) => {
  try {
    const url = new URL(u);
    return url.origin === SITE.origin || SIGN_IN.some((r) => r.test(url.hostname));
  } catch {
    return false;
  }
};

// ---------- the window's size and place, kept between runs ----------
const stateFile = () => path.join(app.getPath("userData"), "window.json");
function readState() {
  try {
    return JSON.parse(fs.readFileSync(stateFile(), "utf8"));
  } catch {
    return { width: 1440, height: 900, maximized: true };
  }
}
function keepState(w) {
  const save = () => {
    if (w.isDestroyed()) return;
    const b = w.getNormalBounds();
    try {
      fs.writeFileSync(stateFile(), JSON.stringify({ ...b, maximized: w.isMaximized() }));
    } catch {
      /* not kept */
    }
  };
  w.on("close", save);
}

// ---------- the computer's files: id → where it is on the disk (kept between runs) ----------
const MEDIA_TYPES = {
  ".mp4": "video/mp4", ".m4v": "video/mp4", ".mov": "video/quicktime", ".webm": "video/webm", ".mkv": "video/x-matroska",
  ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".aac": "audio/aac", ".wav": "audio/wav", ".ogg": "audio/ogg", ".opus": "audio/ogg", ".flac": "audio/flac",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".heic": "image/heic", ".avif": "image/avif",
};
const mediaFile = () => path.join(app.getPath("userData"), "media.json");
let media = null;
function mediaList() {
  if (media) return media;
  try {
    media = JSON.parse(fs.readFileSync(mediaFile(), "utf8"));
  } catch {
    media = {};
  }
  return media;
}
function keepMedia(file) {
  const list = mediaList();
  const had = Object.keys(list).find((id) => list[id] === file);
  if (had) return had;
  const id = crypto.randomUUID();
  list[id] = file;
  try {
    fs.writeFileSync(mediaFile(), JSON.stringify(list));
  } catch {
    /* kept for this run */
  }
  return id;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges, Content-Type",
};

/** One kept file, whole or the part asked for (the player and the decoder read pieces as they seek). */
async function serveMedia(req) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const id = new URL(req.url).pathname.replace(/^\/+/, "");
  const file = mediaList()[id];
  let stat = null;
  try {
    stat = file ? await fs.promises.stat(file) : null;
  } catch {
    stat = null;
  }
  if (!stat || !stat.isFile()) return new Response("ما لقينا الملف على الجهاز (انتقل أو انحذف).", { status: 404, headers: { ...CORS, "Content-Type": "text/plain; charset=utf-8" } });
  const type = MEDIA_TYPES[path.extname(file).toLowerCase()] || "application/octet-stream";
  const size = stat.size;
  const head = { ...CORS, "Content-Type": type, "Accept-Ranges": "bytes", "Cache-Control": "no-store" };
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") || "");
  let start = 0;
  let end = size - 1;
  let status = 200;
  if (range) {
    if (range[1] === "" && range[2] !== "") start = Math.max(0, size - Number(range[2]));
    else {
      start = Number(range[1] || 0);
      if (range[2] !== "") end = Math.min(size - 1, Number(range[2]));
    }
    if (start >= size || start > end) return new Response(null, { status: 416, headers: { ...head, "Content-Range": `bytes */${size}` } });
    status = 206;
    head["Content-Range"] = `bytes ${start}-${end}/${size}`;
  }
  head["Content-Length"] = String(end - start + 1);
  if (req.method === "HEAD") return new Response(null, { status, headers: head });
  const body = Readable.toWeb(fs.createReadStream(file, { start, end }));
  return new Response(body, { status, headers: head });
}

function createWindow() {
  const s = readState();
  win = new BrowserWindow({
    x: s.x,
    y: s.y,
    width: s.width || 1440,
    height: s.height || 900,
    minWidth: 960,
    minHeight: 600,
    title: "الجواد AI",
    backgroundColor: "#0c0d0c",
    show: false,
    icon: path.join(__dirname, "build", "icon.png"),
    autoHideMenuBar: process.platform !== "darwin",
    webPreferences: {
      partition: "persist:haidara",
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      sandbox: true,
      spellcheck: false,
      backgroundThrottling: false,
    },
  });
  keepState(win);
  win.once("ready-to-show", () => {
    if (s.maximized) win.maximize();
    win.show();
  });

  const wc = win.webContents;
  // links to other sites open in the person's browser; the site's own pages and sign-in stay here
  wc.setWindowOpenHandler(({ url }) => {
    if (ours(url) && new URL(url).origin === SITE.origin) {
      wc.loadURL(url);
      return { action: "deny" };
    }
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  wc.on("will-navigate", (e, url) => {
    if (url.startsWith("retry://")) {
      e.preventDefault();
      wc.loadURL(START);
      return;
    }
    if (!ours(url) && !url.startsWith("file:")) {
      e.preventDefault();
      if (/^https?:/.test(url)) shell.openExternal(url);
    }
  });
  // no internet: a page that says so (and tries again)
  wc.on("did-fail-load", (_e, code, _desc, url, isMain) => {
    if (!isMain || code === -3 /* aborted: a page moving on */) return;
    if (url && url.startsWith("file:")) return;
    win.loadFile(path.join(__dirname, "offline.html"));
  });

  win.loadURL(START);
}

// ---------- the session: who the site sees, what it may use, where files go ----------
function setupSession() {
  const ses = session.fromPartition("persist:haidara");
  ses.protocol.handle(SCHEME, serveMedia);
  // a file dropped or picked in the editor: kept where it is (only the site's own pages may ask)
  ipcMain.on("app:version", (e) => {
    e.returnValue = app.getVersion();
  });
  ipcMain.handle("media:keep", (e, file) => {
    let origin = "";
    try {
      origin = new URL(e.senderFrame.url).origin;
    } catch {
      /* none */
    }
    if (origin !== SITE.origin || typeof file !== "string" || !path.isAbsolute(file)) return null;
    try {
      if (!fs.statSync(file).isFile()) return null;
    } catch {
      return null;
    }
    return keepMedia(file);
  });
  // a plain Chrome to the sites (Google's sign-in refuses windows that say «Electron»), plus our own name
  // (the app's own name, in Arabic, would be in it too and is not allowed in a request header)
  const ua = ses
    .getUserAgent()
    .split(" ")
    .filter((part) => /^[\x20-\x7e]+$/.test(part) && !/^(Electron|haidara-cut|HaidaraCut)\//i.test(part) && !part.startsWith(`${app.getName()}/`))
    .join(" ");
  ses.setUserAgent(`${ua} JawadAI/${app.getVersion()}`);

  // the microphone and camera (recording), notifications, full screen and the clipboard, for the site itself
  ses.setPermissionRequestHandler((wc, permission, done, details) => {
    const allowed = ["media", "notifications", "fullscreen", "clipboard-sanitized-write", "clipboard-read", "display-capture", "window-management"];
    const origin = details.requestingUrl ? new URL(details.requestingUrl).origin : "";
    done(origin === SITE.origin && allowed.includes(permission));
  });
  ses.setPermissionCheckHandler((_wc, permission, origin) => origin === SITE.origin && ["media", "notifications", "fullscreen", "clipboard-sanitized-write", "clipboard-read"].includes(permission));

  // a finished video, captions or a sound: saved where the person picks (the Downloads folder first)
  ses.on("will-download", (_e, item) => {
    item.setSaveDialogOptions({ title: "احفظ الملف", defaultPath: path.join(app.getPath("downloads"), item.getFilename()) });
    item.on("updated", () => {
      const total = item.getTotalBytes();
      if (win && !win.isDestroyed() && total > 0) win.setProgressBar(item.getReceivedBytes() / total);
    });
    item.once("done", (_ev, state) => {
      if (!win || win.isDestroyed()) return;
      win.setProgressBar(-1);
      if (state === "completed") {
        if (process.platform === "darwin") app.dock?.downloadFinished(item.getSavePath());
        shell.showItemInFolder(item.getSavePath());
      } else if (state === "interrupted") {
        dialog.showMessageBox(win, { type: "warning", message: "ما اكتمل حفظ الملف", detail: "انقطع التنزيل. جرّب التصدير أو التنزيل مرة ثانية." });
      }
    });
  });
}

// ---------- menus (Arabic), with the editing keys every app has ----------
function setupMenu() {
  const mac = process.platform === "darwin";
  const go = (p) => () => win && win.loadURL(new URL(p, SITE).toString());
  const template = [
    ...(mac
      ? [
          {
            label: "الجواد AI",
            submenu: [
              { role: "about", label: "عن الجواد AI" },
              { type: "separator" },
              { role: "hide", label: "إخفاء الجواد AI" },
              { role: "hideOthers", label: "إخفاء البقية" },
              { role: "unhide", label: "إظهار الكل" },
              { type: "separator" },
              { role: "quit", label: "إنهاء الجواد AI" },
            ],
          },
        ]
      : []),
    {
      label: "ملف",
      submenu: [
        { label: "الرئيسية", accelerator: "CmdOrCtrl+Shift+H", click: go("/jawad-ai?desktop=1") },
        { label: "حيدرة كت (المونتاج)", accelerator: "CmdOrCtrl+Shift+E", click: go("/jawad-ai/editor?app=1&desktop=1") },
        { label: "مكتبتي", click: go("/jawad-ai/library") },
        { type: "separator" },
        mac ? { role: "close", label: "إغلاق النافذة" } : { role: "quit", label: "خروج" },
      ],
    },
    {
      label: "تحرير",
      submenu: [
        { role: "undo", label: "تراجع" },
        { role: "redo", label: "إعادة" },
        { type: "separator" },
        { role: "cut", label: "قص" },
        { role: "copy", label: "نسخ" },
        { role: "paste", label: "لصق" },
        { role: "selectAll", label: "تحديد الكل" },
      ],
    },
    {
      label: "عرض",
      submenu: [
        { role: "reload", label: "إعادة تحميل" },
        { type: "separator" },
        { role: "resetZoom", label: "الحجم الطبيعي" },
        { role: "zoomIn", label: "تكبير" },
        { role: "zoomOut", label: "تصغير" },
        { type: "separator" },
        { role: "togglefullscreen", label: "ملء الشاشة" },
        { role: "toggleDevTools", label: "أدوات المطوّر", visible: false },
      ],
    },
    { role: "windowMenu", label: "نافذة" },
    {
      role: "help",
      label: "مساعدة",
      submenu: [{ label: "افتح الموقع في المتصفح", click: () => shell.openExternal(START.replace("&desktop=1", "")) }],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.on("second-instance", () => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
});

app.whenReady().then(() => {
  app.setAboutPanelOptions?.({ applicationName: "الجواد AI", applicationVersion: app.getVersion(), copyright: "© 2026 نهج علي" });
  setupSession();
  setupMenu();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
