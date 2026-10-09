import { notFound } from "next/navigation";
import Studio from "@/components/jawad/studio/Studio";
import { coinBalance } from "@/lib/coins";
import { freeFor, jawadSession } from "@/lib/jawad/server/access";
import { accessOf, permForGenerator } from "@/lib/access";
import { generatorById } from "@config/jawad/generators";
import { loadRuntime, sectionGenerators } from "@/lib/jawad/server/runtime";
import { worksPage } from "@/lib/jawad/server/works";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function studioSection(id: string) {
  const rt = await loadRuntime();
  const s = rt.sections.find((x) => x.id === id && x.output !== null);
  return { rt, s };
}

export async function generateMetadata({ params }: PageProps<"/jawad-ai/[section]">) {
  const { s } = await studioSection((await params).section);
  return { title: s?.name ?? "غير موجود" };
}

/** A studio section (images, video, audio, or one the owner added): generation settings on the left, the user's works on the right. */
export default async function SectionPage({ params }: PageProps<"/jawad-ai/[section]">) {
  const { section } = await params;
  const [{ rt, s }, { user, owner }] = await Promise.all([studioSection(section), jawadSession()]);
  if (!s || s.output === null || (!s.enabled && !owner)) notFound();

  // the dashboard's list: each branch (images, video, voices, music) for this email
  const perms = await accessOf(user?.email);
  const generators = sectionGenerators(rt, s.id, owner).filter((g) => !user || perms.has(permForGenerator(generatorById(g.id) ?? { id: g.id, output: s.output! }))).map((g) => ({ id: g.id, name: g.name, sampleUrl: g.sampleUrl, live: g.live, reason: owner ? g.reason : null }));
  const allowed = Boolean(user) && generators.length > 0;
  const [balance, initialWorks, free] = user && allowed ? await Promise.all([coinBalance(user.id), worksPage(user.id, "all", null).catch(() => null), freeFor(user)]) : [null, null, false];

  return (
    // each section has its own look (sections.css), by its output type
    <div className="jw-sec" data-jw-section={s.output}>
    <Studio
      key={s.id}
      section={{ id: s.id, name: s.name, output: s.output }}
      generators={generators}
      prices={Object.fromEntries(generators.map((g) => [g.id, rt.prices[g.id]]))}
      user={user ? { id: user.id } : null}
      // free for the owners and the unlimited; everyone else sees riyal prices and pays from their wallet
      owner={owner || free}
      pricing={rt.pricing}
      allowed={allowed}
      balance={balance}
      initialWorks={initialWorks}
    />
    </div>
  );
}
