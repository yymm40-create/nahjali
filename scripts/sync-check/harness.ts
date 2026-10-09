// Runs INSIDE the browser: «زامن الصوت» on two real files (decoded by the browser, not synthetic arrays).
import { monoOf, SYNC_RATE } from "@/components/jawad/editor/sync";
import { findLag } from "@/lib/editor/sync";

declare global {
  interface Window {
    go: (a: string, b: string) => Promise<unknown>;
  }
}

window.go = async (a, b) => {
  const [ma, mb] = await Promise.all([monoOf("a", a), monoOf("b", b)]);
  if (!ma || !mb) return { error: "could not read", a: !!ma, b: !!mb };
  const t0 = performance.now();
  const f = findLag(ma, mb, SYNC_RATE);
  return { ...f, secondsA: ma.length / SYNC_RATE, secondsB: mb.length / SYNC_RATE, ms: Math.round(performance.now() - t0) };
};
