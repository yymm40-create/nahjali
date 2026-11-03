// حيدرا ماكس's conversations open on this device (they were «مختبر الموشن»'s tabs, and keep their place: the lab's old
// tabs open as conversations): what is kept about them (which ones, the server conversation each one is, and the one
// on show; each keeps its own work under `storeOf`). The first one, "main", is the project's main conversation.

export interface Tab {
  id: string;
  title: string;
  /** the conversation kept on the server this tab shows (null until it is first kept) */
  chatId?: string | null;
  /** a name the person gave it («✏️»): kept over the one it takes from its work */
  named?: string | null;
}

export const NEW_TITLE = "محادثة جديدة";
export const tabsKey = (projectId: string) => `jw-lab-tabs-${projectId}`;

/** What a tab keeps its work under (the first tab keeps the project's own key, as before there were tabs). */
export const storeOf = (projectId: string, tabId: string) => (tabId === "main" ? projectId : `${projectId}-${tabId}`);

/** The tabs the person left, made safe (an unknown active tab falls back to the first); null when there are none. */
export function readTabs(projectId: string): { tabs: Tab[]; active: string } | null {
  try {
    const v = JSON.parse(localStorage.getItem(tabsKey(projectId)) ?? "null") as { tabs?: { id?: unknown; title?: unknown; chatId?: unknown }[]; active?: unknown } | null;
    const seen = new Set<string>();
    const tabs = (Array.isArray(v?.tabs) ? v.tabs : []).flatMap((t) => {
      const id = typeof t?.id === "string" ? t.id.replace(/[^a-z0-9]/gi, "").slice(0, 12) : "";
      if (!id || seen.has(id)) return [];
      seen.add(id);
      const chatId = typeof t.chatId === "string" && /^[0-9a-f-]{36}$/i.test(t.chatId) ? t.chatId : null;
      const named = typeof (t as { named?: unknown }).named === "string" ? String((t as { named: string }).named).trim().slice(0, 120) : "";
      return [{ id, title: typeof t.title === "string" && t.title.trim() ? t.title.slice(0, 40) : NEW_TITLE, ...(chatId ? { chatId } : {}), ...(named ? { named } : {}) }];
    });
    if (!tabs.length) return null;
    return { tabs, active: tabs.some((t) => t.id === v?.active) ? String(v?.active) : tabs[0].id };
  } catch {
    return null;
  }
}
