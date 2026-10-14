import { notFound } from "next/navigation";
import Studio from "@/components/jawad/studio/Studio";
import { coinBalance } from "@/lib/coins";
import { freeFor, jawadSession } from "@/lib/jawad/server/access";
import { accessOf, permForGenerator } from "@/lib/access";
import { generatorById } from "@config/jawad/generators";
import { loadRuntime } from "@/lib/jawad/server/runtime";
import { worksPage } from "@/lib/jawad/server/works";
import { signupFreeImageAvailable } from "@/lib/jawad/server/free-image";
import { STUDIO_SECTION_IDS } from "@config/jawad/sections";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function studioSection(id: string) {
  const rt = await loadRuntime();
  const s = rt.sections.find((x) => x.id === id && x.output !== null);
  return { rt, s };
}

export async function generateMetadata({ params }: PageProps<"/jawad-ai/[section]">) {
  const { s } = await studioSection((await params).section);
  const unified = s && STUDIO_SECTION_IDS.includes(s.id as (typeof STUDIO_SECTION_IDS)[number]);
  return { title: unified ? "الاستوديو الإبداعي" : s?.name ?? "غير موجود" };
}

/** A studio section (images, video, audio, or one the owner added): generation settings on the left, the user's works on the right. */
export default async function SectionPage({ params }: PageProps<"/jawad-ai/[section]">) {
  const { section } = await params;
  const [{ rt, s }, { user, owner }] = await Promise.all([studioSection(section), jawadSession()]);
  if (!s || s.output === null) notFound();

  const unified = STUDIO_SECTION_IDS.includes(s.id as (typeof STUDIO_SECTION_IDS)[number]);
  const studioRoot = rt.sections.find((item) => item.id === "images");
  if ((unified ? !studioRoot?.enabled : !s.enabled) && !owner) notFound();
  const studioSections = rt.sections.filter((item) => item.output !== null && (item.enabled || owner) && (unified ? STUDIO_SECTION_IDS.includes(item.id as (typeof STUDIO_SECTION_IDS)[number]) : item.id === s.id));
  const sectionIds = new Set(studioSections.map((item) => item.id));
  // The unified studio receives image, video and audio generators together. Legacy routes choose which kind appears first.
  const perms = await accessOf(user?.email);
  const generators = rt.generators
    .filter((generator) => sectionIds.has(generator.sectionId) && (generator.live || (owner && generator.keyConfigured && rt.migrated)))
    .filter((generator) => !user || perms.has(permForGenerator(generatorById(generator.id) ?? { id: generator.id, output: s.output! })))
    .map((generator) => ({ id: generator.id, name: generator.name, sectionId: generator.sectionId, sampleUrl: generator.sampleUrl, live: generator.live, reason: owner ? generator.reason : null }))
    .sort((a, b) => Number((generatorById(b.id)?.output ?? "") === s.output) - Number((generatorById(a.id)?.output ?? "") === s.output));
  const allowed = Boolean(user) && generators.length > 0;
  const [balance, initialWorks, free] = user && allowed ? await Promise.all([coinBalance(user.id), worksPage(user.id, "all", null).catch(() => null), freeFor(user)]) : [null, null, false];
  const hasImageGenerator = generators.some((generator) => generatorById(generator.id)?.output === "image");
  const freeImageAvailable = Boolean(user && allowed && !free && hasImageGenerator && await signupFreeImageAvailable(user.id, user.created_at));
  const directorGenerators = generators.flatMap((generator) => {
    const definition = generatorById(generator.id);
    if (!definition || (definition.output !== "image" && definition.output !== "video")) return [];
    const choices = (keys: string[]) => {
      const option = definition.options.find((item) => keys.includes(item.key));
      return option?.kind === "choice" ? option.values.map((item) => ({ value: item.value, label: item.label })) : [];
    };
    return [{ id: generator.id, name: generator.name, kind: definition.output, resolutions: choices(["resolution"]), aspects: choices(["ratio", "aspect"]) }];
  });

  return <Studio
      key={s.id}
      section={{ id: s.id, name: unified ? "الاستوديو الإبداعي" : s.name, output: s.output }}
      studioSections={studioSections.map((item) => ({ id: item.id, name: item.name, output: item.output! }))}
      generators={generators}
      directorGenerators={directorGenerators}
      prices={Object.fromEntries(generators.map((g) => [g.id, rt.prices[g.id]]))}
      user={user ? { id: user.id } : null}
      // free for the owners and the unlimited; everyone else sees riyal prices and pays from their wallet
      owner={owner || free}
      pricing={rt.pricing}
      allowed={allowed}
      balance={balance}
      initialWorks={initialWorks}
      freeImageAvailable={freeImageAvailable}
    />;
}
