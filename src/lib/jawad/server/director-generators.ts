// «جواد المخرج»: the image and video generators the director may propose, with the sizes and qualities each one takes.

import { generatorById } from "@config/jawad/generators";

export interface DirectorGeneratorView {
  id: string;
  name: string;
  kind: "image" | "video";
  resolutions: { value: string; label: string }[];
  aspects: { value: string; label: string }[];
}

export function directorGeneratorsOf(generators: { id: string; name: string }[]): DirectorGeneratorView[] {
  return generators.flatMap((generator) => {
    const definition = generatorById(generator.id);
    if (!definition || (definition.output !== "image" && definition.output !== "video")) return [];
    const choices = (keys: string[]) => {
      const option = definition.options.find((item) => keys.includes(item.key));
      return option?.kind === "choice" ? option.values.map((item) => ({ value: item.value, label: item.label })) : [];
    };
    return [{ id: generator.id, name: generator.name, kind: definition.output, resolutions: choices(["resolution"]), aspects: choices(["ratio", "aspect"]) }];
  });
}
