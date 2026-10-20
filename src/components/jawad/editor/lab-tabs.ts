// «مختبر الموشن» in tabs: what is kept on the device about them (the tabs themselves; each tab keeps its own work).

export interface Tab {
  id: string;
  title: string;
}

export const NEW_TITLE = "موشن جديد";
export const tabsKey = (projectId: string) => `jw-lab-tabs-${projectId}`;

/** What a tab keeps its work under (the first tab keeps the project's own key, as before there were tabs). */
export const storeOf = (projectId: string, tabId: string) => (tabId === "main" ? projectId : `${projectId}-${tabId}`);

/** The tabs the person left, made safe (an unknown active tab falls back to the first); null when there are none. */
export function readTabs(projectId: string): { tabs: Tab[]; active: string } | null {
  try {
    const v = JSON.parse(localStorage.getItem(tabsKey(projectId)) ?? "null") as { tabs?: { id?: unknown; title?: unknown }[]; active?: unknown } | null;
    const seen = new Set<string>();
    const tabs = (Array.isArray(v?.tabs) ? v.tabs : []).flatMap((t) => {
      const id = typeof t?.id === "string" ? t.id.replace(/[^a-z0-9]/gi, "").slice(0, 12) : "";
      if (!id || seen.has(id)) return [];
      seen.add(id);
      return [{ id, title: typeof t.title === "string" && t.title.trim() ? t.title.slice(0, 40) : NEW_TITLE }];
    });
    if (!tabs.length) return null;
    return { tabs, active: tabs.some((t) => t.id === v?.active) ? String(v?.active) : tabs[0].id };
  } catch {
    return null;
  }
}
