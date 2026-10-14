import DirectorChat, { type DirectorGenerator } from "@/components/jawad/director/DirectorChat";
import { jawadLogin, jawadSession } from "@/lib/jawad/server/access";
import { loadRuntime } from "@/lib/jawad/server/runtime";
import { GENERATORS } from "@config/jawad/generators";
import type { GeneratorDef } from "@config/jawad/types";
import "./director.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "جواد المخرج" };

const choices = (generator: GeneratorDef, keys: string[]) => {
  const option = generator.options.find((item) => keys.includes(item.key));
  return option?.kind === "choice" ? option.values.map((item) => ({ value: item.value, label: item.label })) : [];
};

export default async function DirectorPage() {
  const [{ user, owner }, runtime] = await Promise.all([jawadSession(), loadRuntime()]);
  const live = new Map(runtime.generators.filter((item) => item.live || owner).map((item) => [item.id, item.name]));
  const generators: DirectorGenerator[] = GENERATORS
    .filter((generator) => (generator.output === "image" || generator.output === "video") && live.has(generator.id))
    .map((generator) => ({
      id: generator.id,
      name: live.get(generator.id) ?? generator.name,
      kind: generator.output as "image" | "video",
      resolutions: choices(generator, ["resolution"]),
      aspects: choices(generator, ["ratio", "aspect"]),
    }));
  return <DirectorChat loginHref={user ? null : jawadLogin("/jawad-ai/director")} generators={generators} />;
}
