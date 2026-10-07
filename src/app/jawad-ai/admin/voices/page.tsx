import VoiceSlots from "@/components/jawad/admin/VoiceSlots";

export const metadata = { title: "خانات الأصوات" };

/** The ElevenLabs account's voice slots: how many are used, by whom, and freeing the ones nobody needs. */
export default function VoiceSlotsPage() {
  return <VoiceSlots />;
}
