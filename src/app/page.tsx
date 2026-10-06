import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SECTIONS } from "@config/sections";
import { accessMode, bookletOpenFor } from "@/lib/film/limits";
import { loadRuntime } from "@/lib/jawad/server/runtime";
import { jawadVisibleTo } from "@/lib/jawad/server/access";

/** Home: the site's sections (config/sections.ts). */
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // «كتيب نهج علي»: who may open it is set on /admin/limits
  const [bookletMode, bookletOpen, jawad, jawadOpen] = await Promise.all([accessMode("booklet"), bookletOpenFor(user?.email), loadRuntime(), jawadVisibleTo(user)]);

  return (
    <div className="space-y-8">
      <section className="relative -mx-4 overflow-hidden sm:mx-0 sm:rounded-3xl">
        <Image src="/brand/hero.jpg" alt="مرقد أمير المؤمنين علي عليه السلام في النجف الأشرف" width={1600} height={1067} priority className="h-[220px] w-full object-cover" />
        <div className="absolute inset-0" style={{ background: "var(--hero-tint)" }} />
        <h1 className="display absolute inset-x-0 bottom-2 text-center text-[2.6rem] leading-tight text-ink [text-shadow:0_0_18px_var(--page),0_0_6px_var(--page)]">
          أهلًا بك في <span className="text-gold">نهج علي</span>
        </h1>
      </section>

      <section className="space-y-3">
        <h2 className="display text-3xl">وش تبي تسوي اليوم؟</h2>
        {/* «الطالب الذكي» (a JAWAD AI section, open to every visitor; making something needs signing in) */}
        <Link
          href="/jawad-ai/student"
          className="relative flex items-center gap-4 overflow-hidden rounded-3xl p-4 text-white shadow-[0_14px_34px_-14px_rgba(219,39,119,0.7)] transition hover:-translate-y-0.5"
          style={{ background: "linear-gradient(120deg,#7c3aed 0%,#db2777 55%,#f97316 100%)" }}
        >
          <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-white/20 text-4xl" aria-hidden>
            🎒
          </span>
          <div className="flex-1">
            <h3 className="flex flex-wrap items-center gap-2 text-xl font-extrabold">
              الطالب الذكي
              <span className="rounded-full bg-white/25 px-2 py-0.5 text-xs font-bold">جديد ✨</span>
            </h3>
            <p className="text-sm font-bold text-white/90">ارفع دروسك وحوّلها إلى ملخصات وكتب وعروض وتسجيلات صوتية واختبارات.</p>
          </div>
        </Link>
        {/* «حيدر كات» (open to every visitor like «الطالب الذكي»; editing needs signing in) */}
        <Link
          href="/jawad-ai/editor"
          className="relative flex items-center gap-4 overflow-hidden rounded-3xl bg-[#0c0d0c] p-4 text-[#eef3ec] shadow-[0_14px_34px_-14px_rgba(184,245,61,0.55)] ring-1 ring-[#b8f53d]/40 transition hover:-translate-y-0.5"
        >
          <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-[#b8f53d] text-4xl text-[#121a03]" aria-hidden>
            ✂️
          </span>
          <div className="flex-1">
            <h3 className="flex flex-wrap items-center gap-2 text-xl font-extrabold">
              حيدر كات
              <span className="rounded-full bg-[#b8f53d]/20 px-2 py-0.5 text-xs font-bold text-[#b8f53d]">جديد ✨</span>
            </h3>
            <p className="text-sm font-bold text-[#a5b0a2]">مونتاج من جوالك أو كمبيوترك: قص وترتيب ونصوص، وتصدير 720p و1080p.</p>
          </div>
        </Link>
        {/* «الجواد الذكي!» | JAWAD AI: its own identity, also on this card */}
        <Link
          href="/jawad-ai"
          className="flex items-center gap-4 overflow-hidden rounded-3xl border border-[#2a3550] bg-[#0b0c0f] p-4 text-[#eef1f6] shadow-[0_10px_30px_-12px_rgba(59,140,255,0.45)] transition hover:-translate-y-0.5"
        >
          <Image src={jawad.brand.logoUrl} alt="" width={64} height={64} unoptimized={jawad.brand.customLogo} className="size-16 shrink-0 rounded-full" />
          <div className="flex-1">
            <h3 className="flex flex-wrap items-center gap-2 text-xl font-extrabold">
              منصة الذكاء الاصطناعي
              {/* In development for everyone but the owner (and invited emails): the card explains what's coming */}
              {!jawadOpen && <span className="rounded-full border border-[#e9b546]/50 px-2 py-0.5 text-xs font-bold text-[#e9b546]">قيد التطوير</span>}
            </h3>
            <p className="text-sm font-bold text-[#a3abb9]">
              <span dir="ltr" className="text-[#3b8cff]">JAWAD AI</span> · الجواد الذكي! — {jawadOpen ? "صور وفيديو وصوت وأفلام بالذكاء الاصطناعي." : "منصة لصناعة الصور والفيديو والصوت والأفلام بالذكاء الاصطناعي، نجهّزها الآن. اضغط لتعرف وش فيها."}
            </p>
          </div>
        </Link>
        <ul className="space-y-3">
          {SECTIONS.map((s) => {
            // «تحت التطوير»: shown, but only the owner can open it
            const dev = s.underDevelopment && bookletMode !== "open";
            const closed = s.underDevelopment && !bookletOpen;
            const body = (
              <>
                <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-surface-2 text-4xl">{s.icon}</span>
                <div className="flex-1">
                  <h3 className="flex items-center gap-2 text-xl font-extrabold">
                    {s.title}
                    {dev && <span className="chip text-xs">تحت التطوير</span>}
                  </h3>
                  <p className="font-bold text-muted">{s.description}</p>
                </div>
              </>
            );
            return (
              <li key={s.key}>
                {closed ? (
                  <div className="card flex items-center gap-4 p-4 opacity-70" aria-disabled="true">
                    {body}
                  </div>
                ) : (
                  <Link href={s.href} className="card flex items-center gap-4 p-4 transition hover:-translate-y-0.5">
                    {body}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
