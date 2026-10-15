import LegacyPage from "@/app/admin/mahdi/users/page";

export default function MahdiUsersAdminPage(props: { searchParams: Promise<{ show?: string; q?: string }> }) {
  return LegacyPage(props as Parameters<typeof LegacyPage>[0]);
}
