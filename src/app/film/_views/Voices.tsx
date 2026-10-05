import Link from "next/link";
import { redirect } from "next/navigation";
import { requireFilmUser, requireProject } from "@/lib/film/access";
import { voiceLines } from "@/lib/film/voices";
import VoicesWorkspace from "../[id]/voices/VoicesWorkspace";

/** «الأصوات»: a voice for each speaker of the approved generations, and each Arabic line spoken (ElevenLabs Eleven v4). */
export default async function VoicesView({ id, base }: { id: string; base: string }) {
  const { user, allowed } = await requireFilmUser(`${base}/${id}/voices`);
  if (!allowed) redirect(base);
  const project = await requireProject(id, user.id);
  if (project.stage === "screenwriter") redirect(`${base}/${id}/script`);
  if (project.stage === "sheets") redirect(`${base}/${id}/sheets`);
  const lines = await voiceLines(id);
  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <Link href={`${base}/${id}`} className="text-sm font-bold text-muted">→ {project.title}</Link>
        <h1 className="display text-4xl">🎙️ الأصوات</h1>
        <p className="text-sm font-bold text-muted">
          لكل شخصية صوت، ولكل جملة كتبها المخرج ملف صوتي بـ Eleven v4. ولّدها قبل الفيديو: في صفحة «التوليد» تروح أصوات كل مقطع مع طلب الفيديو مرجعًا، فتتحرك شفاه الشخصيات عليها ويبقى صوتها كما هو. الأصوات من «مكتبتي» في «الجواد الذكي!» (صمّم صوتًا أو احفظ بصمة صوتك) أو من أصوات ElevenLabs الجاهزة.
        </p>
      </header>
      <VoicesWorkspace projectId={id} initialLines={lines} />
    </div>
  );
}
