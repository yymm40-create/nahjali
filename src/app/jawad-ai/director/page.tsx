import { notFound } from "next/navigation";
import DirectorChat from "@/components/jawad/director/DirectorChat";
import { jawadLogin, jawadSession } from "@/lib/jawad/server/access";
import { accessOf, permForGenerator } from "@/lib/access";
import { generatorById } from "@config/jawad/generators";
import { directorGeneratorsOf } from "@/lib/jawad/server/director-generators";
import { loadRuntime } from "@/lib/jawad/server/runtime";

export const dynamic = "force-dynamic";
export const metadata = { title: "جواد المخرج" };

/** «جواد المخرج» as a section of its own: a full conversation page (chats on the side, the library, generation from the chat). */
export default async function DirectorPage() {
  const [{ user, owner }, rt] = await Promise.all([jawadSession(), loadRuntime()]);
  const section = rt.sections.find((s) => s.implementation === "director");
  if (!section || (!section.enabled && !owner)) notFound();
  if (!user) return <DirectorChat mode="page" open onOpen={() => {}} onClose={() => {}} loginHref={jawadLogin("/jawad-ai/director")} generators={[]} />;
  const perms = await accessOf(user.email);
  const live = rt.generators
    .filter((g) => (g.live || (owner && g.keyConfigured && rt.migrated)))
    .filter((g) => { const d = generatorById(g.id); return d && (d.output === "image" || d.output === "video") && perms.has(permForGenerator(d)); })
    .map((g) => ({ id: g.id, name: g.name }));
  return <DirectorChat mode="page" open onOpen={() => {}} onClose={() => {}} loginHref={null} generators={directorGeneratorsOf(live)} />;
}
