import LegacyPage from "@/app/admin/users/[id]/page";

export default function UserAdminPage(props: { params: Promise<{ id: string }> }) {
  return LegacyPage(props as Parameters<typeof LegacyPage>[0]);
}
