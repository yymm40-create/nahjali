import LibraryPage from "@/components/jawad/library/LibraryPage";
import { JAWAD_MESSAGES, requireJawadUser } from "@/lib/jawad/server/access";
import { loadRuntime } from "@/lib/jawad/server/runtime";
import { coinsOf, MINIMAX_CLONE_KEY, VOICE_CLONE_KEY, VOICE_DESIGN_KEY } from "@config/jawad/generators";

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
  // MiniMax («بصمة صوتك» with no slot limit) when its generator can run
  const mm = rt.generators.find((x) => x.id === "minimax-speech-2-8");
  const mmTable = rt.prices["minimax-speech-2-8"] ?? {};
  const cloneMinimax = mm && (mm.live || (owner && mm.keyConfigured)) ? (owner ? 0 : mmTable[MINIMAX_CLONE_KEY] == null ? null : coinsOf(mmTable[MINIMAX_CLONE_KEY]!)) : undefined;
  return <LibraryPage owner={owner} voiceCoins={{ design: coins(VOICE_DESIGN_KEY), clone: coins(VOICE_CLONE_KEY), ...(cloneMinimax !== undefined ? { cloneMinimax } : {}) }} voicesOn={Boolean(g && (g.live || (owner && g.keyConfigured)))} />;
}
