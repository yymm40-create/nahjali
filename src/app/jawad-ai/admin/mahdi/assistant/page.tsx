import LegacyPage from "@/app/admin/mahdi/assistant/page";

export default function MahdiAssistantAdminPage(props: { searchParams: Promise<{ u?: string }> }) {
  return LegacyPage(props as Parameters<typeof LegacyPage>[0]);
}
