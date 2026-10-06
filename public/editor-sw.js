// «حيدرة كت» as an installed app: this worker only makes it installable. Every request goes to the network as
// usual (nothing is cached: an edit must always see the latest version of its project).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
