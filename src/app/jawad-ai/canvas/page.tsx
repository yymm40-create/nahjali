import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CanvasLoader from "@/components/jawad/canvas/CanvasLoader";
import { coinBalance } from "@/lib/coins";
import { freeFor, jawadSession } from "@/lib/jawad/server/access";
import { accessOf, permForGenerator } from "@/lib/access";
import { generatorById } from "@config/jawad/generators";
import { loadRuntime } from "@/lib/jawad/server/runtime";
import { STUDIO_SECTION_IDS } from "@config/jawad/sections";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "اللوحة — الاستوديو الإبداعي",
  description: "ابنِ وصفة إبداعية بالعقد والأسلاك: برومبت، صور، فيديو، صوت وأدوات الصورة — وشغّلها كلها بضغطة، وما تدفع إلا على اللي تغيّر.",
};

/** «اللوحة»: the creative studio's node canvas. The same generators, prices and jobs as the studio (/jawad-ai/images). */
export default async function CanvasPage() {
  const [rt, { user, owner }] = await Promise.all([loadRuntime(), jawadSession()]);
  const root = rt.sections.find((s) => s.id === "images");
  if (!root?.enabled && !owner) notFound();
  const sections = rt.sections.filter((s) => s.output !== null && (s.enabled || owner) && STUDIO_SECTION_IDS.includes(s.id as (typeof STUDIO_SECTION_IDS)[number]));
  const sectionIds = new Set(sections.map((s) => s.id));
  const perms = await accessOf(user?.email);
  const generators = rt.generators
    .filter((g) => sectionIds.has(g.sectionId) && (g.live || (owner && g.keyConfigured && rt.migrated)))
    .filter((g) => {
      const def = generatorById(g.id);
      return def && (!user || perms.has(permForGenerator(def)));
    })
    .map((g) => ({ id: g.id, name: g.name, sectionId: g.sectionId, sampleUrl: g.sampleUrl, live: g.live, reason: owner ? g.reason : null }));
  const allowed = Boolean(user) && generators.length > 0;
  const [balance, free] = user && allowed ? await Promise.all([coinBalance(user.id), freeFor(user)]) : [null, false];
  return (
    <CanvasLoader
      generators={generators}
      prices={Object.fromEntries(generators.map((g) => [g.id, rt.prices[g.id]]))}
      pricing={rt.pricing}
      user={user ? { id: user.id } : null}
      owner={owner || free}
      allowed={allowed}
      balance={balance}
    />
  );
}
