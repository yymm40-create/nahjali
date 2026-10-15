import LegacyPage from "@/app/admin/film/[id]/page";

export default function FilmAdminPage(props: { params: Promise<{ id: string }> }) {
  return LegacyPage(props as Parameters<typeof LegacyPage>[0]);
}
