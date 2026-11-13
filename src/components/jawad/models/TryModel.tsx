"use client";

import { useRouter } from "next/navigation";
import { putCreativeUse } from "@/lib/jawad/creative-use";

/** «جرّبه الحين»: opens the Creative Studio with this generator already chosen (the same hand-off as «طرق إبداعية»). */
export default function TryModel({ id, name, className }: { id: string; name: string; className?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        putCreativeUse({ generatorId: id, settings: {}, prompt: "", label: name, refs: [] });
        router.push("/jawad-ai/images?use=1");
      }}
    >
      جرّب {name} الحين ←
    </button>
  );
}
