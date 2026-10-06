/**
 * «التعديل الذكي» of a finished video, opened in «حيدرة كت» (a new edit with its red and green tracks). Returns
 * the edit's address, or null when the editor isn't available (the page then opens its own window).
 */
export async function smartEditInEditor(jobId: string, outputId?: string): Promise<string | null> {
  const res = await fetch("/api/jawad/editor/smart", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId, outputId }) }).catch(() => null);
  const r = res ? await res.json().catch(() => ({})) : {};
  return res?.ok && typeof r.id === "string" ? `/jawad-ai/editor/${r.id}` : null;
}
