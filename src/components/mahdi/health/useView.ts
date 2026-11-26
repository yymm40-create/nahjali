"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { withParams } from "@/lib/mahdi/health/route";

/**
 * A view of a «الصحة العلوية» page kept in the link (the day shown, the session picked, the table being edited, the
 * muscle being read…): read from it, and changed in place — a refresh or a shared link shows the same view, and
 * choosing a view adds no step to «رجوع».
 */
export function useView() {
  const router = useRouter();
  const path = usePathname() ?? "";
  const params = useSearchParams();
  return {
    get: (k: string) => params.get(k),
    set: (patch: Record<string, string | number | boolean | null>) => router.replace(withParams(path, params.toString(), patch), { scroll: false }),
  };
}
