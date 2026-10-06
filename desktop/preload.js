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
});
