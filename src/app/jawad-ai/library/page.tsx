import LibraryPage from "@/components/jawad/library/LibraryPage";
import { JAWAD_MESSAGES, requireJawadUser } from "@/lib/jawad/server/access";
import { loadRuntime } from "@/lib/jawad/server/runtime";
import { coinsOf, VOICE_CLONE_KEY, VOICE_DESIGN_KEY } from "@config/jawad/generators";

export const metadata = { title: "مكتبتي" };
export const dynamic = "force-dynamic";

const V4 = "elevenlabs-eleven-v4";

/** «مكتبتي» (the «المكتبة» add-on): the person's own voices, characters and places. */
export default async function Library() {
  const { owner, allowed } = await requireJawadUser("/jawad-ai/library");
  if (!allowed) return <p className="mx-auto max-w-md px-4 py-24 text-center text-jw-muted">{JAWAD_MESSAGES.closed}</p>;
  const rt = await loadRuntime();
  const g = rt.generators.find((x) => x.id === V4);
  const table = rt.prices[V4] ?? {};
  const coins = (k: string) => (owner ? 0 : table[k] == null ? null : coinsOf(table[k]!));
  return <LibraryPage owner={owner} voiceCoins={{ design: coins(VOICE_DESIGN_KEY), clone: coins(VOICE_CLONE_KEY) }} voicesOn={Boolean(g && (g.live || (owner && g.keyConfigured)))} />;
}
