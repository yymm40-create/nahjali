import { notFound } from "next/navigation";
import Studio from "@/components/jawad/studio/Studio";
import { coinBalance } from "@/lib/coins";
import { canUseJawad, jawadSession } from "@/lib/jawad/server/access";
import { loadRuntime, sectionGenerators } from "@/lib/jawad/server/runtime";
import { worksPage } from "@/lib/jawad/server/works";
import { isUnlimited } from "@config/site";

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

  const allowed = user ? await canUseJawad(user) : false;
  const generators = sectionGenerators(rt, s.id, owner).map((g) => ({ id: g.id, name: g.name, sampleUrl: g.sampleUrl, live: g.live, reason: owner ? g.reason : null }));
  const [balance, initialWorks] = user && allowed ? await Promise.all([coinBalance(user.id), worksPage(user.id, "all", null).catch(() => null)]) : [null, null];

  return (
    <Studio
      key={s.id}
      section={{ id: s.id, name: s.name, output: s.output }}
      generators={generators}
      prices={Object.fromEntries(generators.map((g) => [g.id, rt.prices[g.id]]))}
      user={user ? { id: user.id } : null}
      // a free guest is shown the studio without prices blocking them (charges are skipped on the server too)
      owner={owner || isUnlimited(user?.email)}
      allowed={allowed}
      balance={balance}
      initialWorks={initialWorks}
    />
  );
}
