// The page can tell it runs inside the desktop program «الجواد AI» (and which version), and hand it the computer's files to keep where they
// are (nothing uploaded): the program serves them back at haidara-media://file/<id>.
const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("haidaraDesktop", {
  platform: process.platform,
  version: (() => {
    try {
      return ipcRenderer.sendSync("app:version") || "";
    } catch {
      return "";
    }
  })(),
  async keepLocal(file) {
    let where = "";
    try {
      where = webUtils.getPathForFile(file);
    } catch {
      where = "";
    }
    if (!where) return null;
    const id = await ipcRenderer.invoke("media:keep", where);
    return id ? { id, url: `haidara-media://file/${id}` } : null;
  },
  /** «⬇️ من رابط»: a YouTube (or TikTok, X…) video downloaded on this computer and kept like its files. `onProgress`
   *  gets { stage, p, note }; resolves to { id, url, name, bytes } or { error }. */
  async fromLink(link, onProgress) {
    const listen = (_e, m) => {
      if (m && m.link === link && typeof onProgress === "function") onProgress({ stage: m.stage, p: m.p, note: m.note });
    };
    ipcRenderer.on("youtube:progress", listen);
    try {
      return await ipcRenderer.invoke("youtube:get", String(link ?? ""));
    } finally {
      ipcRenderer.removeListener("youtube:progress", listen);
    }
  },
});
