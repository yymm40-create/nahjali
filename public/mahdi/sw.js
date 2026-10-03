/* «لأجل المهدي» service worker. Scope: /mahdi/
 *  - Offline: when a page cannot be loaded, shows the offline page. Pages of the signed-in user are NEVER stored.
 *  - Speed: keeps the app's own static files (scripts, styles, fonts, icons, the shrine picture) after first use.
 *  - Web Push: shows the reminder sent by the server and opens the app when it is tapped.
 */
const VERSION = "v1";
const STATIC = `mahdi-static-${VERSION}`;
const OFFLINE_URL = "/mahdi/offline";
const BRAND = "لأجل المهدي";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC)
      .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: "reload" })))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("mahdi-") && k !== STATIC).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// On a developer's machine, files under /_next/static/ change without new names, so nothing is kept there
const DEV = self.location.hostname === "localhost" || self.location.hostname === "127.0.0.1";
const isStaticAsset = (url) => !DEV && url.pathname.startsWith("/_next/static/") || /^\/mahdi\/(icons|shrines)\//.test(url.pathname);

// Old builds leave old files behind: keep the newest ones only
const MAX_FILES = 150;
function trim(cache) {
  cache.keys().then((all) => {
    const keys = all.filter((k) => new URL(k.url).pathname !== OFFLINE_URL); // the offline page always stays
    keys.slice(0, Math.max(0, keys.length - MAX_FILES)).forEach((k) => cache.delete(k));
  });
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // data always comes from the network

  if (req.mode === "navigate") {
    if (!url.pathname.startsWith("/mahdi")) return;
    event.respondWith(
      fetch(req).catch(() => caches.match(OFFLINE_URL).then((r) => r || new Response("", { status: 503 }))),
    );
    return;
  }

  if (isStaticAsset(url)) {
    // Files under /_next/static/ have a hash in their name, so a stored copy never goes stale
    event.respondWith(
      caches.open(STATIC).then((cache) =>
        cache.match(req).then(
          (hit) =>
            hit ||
            fetch(req).then((res) => {
              if (res.ok) {
                cache.put(req, res.clone());
                trim(cache);
              }
              return res;
            }),
        ),
      ),
    );
  }
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {}
  const title = data.title || BRAND;
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/mahdi/icons/icon-192.png",
      badge: "/mahdi/icons/icon-192.png",
      tag: data.tag || "mahdi",
      lang: "ar",
      dir: "rtl",
      data: { url: data.url || "/mahdi" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || "/mahdi", self.location.origin);
  // Only open pages inside the app
  const path = target.origin === self.location.origin && target.pathname.startsWith("/mahdi") ? target.href : new URL("/mahdi", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => c.url.startsWith(new URL("/mahdi", self.location.origin).href));
      if (open) return open.focus();
      return self.clients.openWindow(path);
    }),
  );
});
