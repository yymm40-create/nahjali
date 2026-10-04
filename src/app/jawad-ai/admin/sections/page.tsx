import SectionsAdmin from "@/components/jawad/admin/SectionsAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadRuntime } from "@/lib/jawad/server/runtime";
import { DEFAULT_SECTIONS, SECTION_ICONS, SECTION_IMPLEMENTATIONS } from "@config/jawad/sections";
import { requireJawadOwnerPage } from "@/lib/jawad/server/access";

export const metadata = { title: "الأقسام" };

export default async function SectionsPage() {
  await requireJawadOwnerPage("/jawad-ai/admin/sections");
  const rt = await loadRuntime();
  const { data } = await createAdminClient().from("jawad_sections").select("id");
  const stored = new Set((data ?? []).map((r) => r.id as string));
  return (
    <SectionsAdmin
      sections={rt.sections.map((s) => ({
        id: s.id,
        name: s.name,
        icon: s.icon,
        implementation: s.implementation,
        sort: s.sort,
        enabled: s.enabled,
        builtIn: DEFAULT_SECTIONS.some((d) => d.id === s.id),
        overridden: stored.has(s.id),
      }))}
      icons={[...SECTION_ICONS]}
      implementations={Object.entries(SECTION_IMPLEMENTATIONS).map(([key, v]) => ({ key, label: v.label }))}
    />
  );
}
