import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadRuntime } from "@/lib/jawad/server/runtime";
import { jawadVisibleTo } from "@/lib/jawad/server/access";

interface Branch {
  key: string;
  href: string;
  logo: string;
  name: string;
  nameEn?: string;
  pitch: string;
  cta: string;
  /** what is inside, each a way in */
  parts: { icon: string; title: string; text: string; href: string }[];
  bg: string;
  glow: string;
  accent: string;
  badge?: string;
}

/**
 * Home: نهج علي's two branches, big. «الجواد للذكاء الاصطناعي» holds the making (images, video, voice, the film, حيدرة
 * كت, the smart student, the children's booklet); «لأجل المهدي» is the daily path. Each says what is inside.
 */
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [jawad, jawadOpen] = await Promise.all([loadRuntime(), jawadVisibleTo(user)]);
  const name = (user?.user_metadata?.full_name as string | undefined)?.split(" ")[0] ?? null;

  const branches: Branch[] = [
    {
      key: "jawad",
      href: "/jawad-ai",
      logo: jawad.brand.logoUrl,
      name: "الجواد للذكاء الاصطناعي",
      nameEn: "JAWAD AI",
      pitch: "اصنع أي شي بالذكاء الاصطناعي: صور، فيديو، أصوات، أفلام، مونتاج، دروس، وكتيبات لأطفالك.",
      cta: jawadOpen ? "ادخل الجواد AI" : "اكتشف الجواد AI",
      badge: jawadOpen ? undefined : "قيد التطوير",
      parts: [
        { icon: "🖼️", title: "صور", text: "من وصف بالعربي", href: "/jawad-ai/images" },
        { icon: "🎥", title: "فيديو", text: "من نص أو صورة", href: "/jawad-ai/video" },
        { icon: "🎙️", title: "أصوات", text: "كلام بأصوات طبيعية", href: "/jawad-ai/audio" },
        { icon: "🎬", title: "فيلم سينمائي", text: "من الفكرة للفيلم", href: "/jawad-ai/film" },
        { icon: "✂️", title: "حيدرة كت", text: "مونتاج مع مساعد ذكي", href: "/jawad-ai/editor" },
        { icon: "🎒", title: "الطالب الذكي", text: "دروسك ملخصات واختبارات", href: "/jawad-ai/student" },
        { icon: "📖", title: "كتيب نهج علي", text: "طفلك بطل كتيبه", href: "/booklet" },
      ],
      bg: "radial-gradient(130% 100% at 100% 0%,#1d4ed8 0%,#0b1640 45%,#05070f 100%)",
      glow: "rgba(59,140,255,0.55)",
      accent: "#3b8cff",
    },
    {
      key: "mahdi",
      href: "/mahdi",
      logo: "/mahdi/icons/icon-512.png",
      name: "لأجل المهدي",
      pitch: "رحلتك اليومية بهدوء وثبات: عاداتك ومشاريعك، وين تقدّمت ووين تحتاج انتباه.",
      cta: "ابدأ رحلتك",
      parts: [
        { icon: "📿", title: "عاداتي", text: "تابعها يوم بيوم", href: "/mahdi" },
        { icon: "🎯", title: "مشاريعي", text: "خطوات واضحة", href: "/mahdi" },
        { icon: "📈", title: "تقدّمي", text: "وين وصلت", href: "/mahdi" },
        { icon: "👨‍👩‍👧", title: "مع عائلتي", text: "رحلة مشتركة", href: "/mahdi" },
      ],
      bg: "radial-gradient(130% 100% at 0% 0%,#14b8a6 0%,#0f766e 35%,#042f2e 100%)",
      glow: "rgba(20,184,166,0.55)",
      accent: "#e3a90f",
    },
  ];

  return (
    <div className="space-y-6">
      {/* welcome */}
      <section className="relative -mx-4 overflow-hidden sm:mx-0 sm:rounded-[2rem]">
        <Image src="/brand/hero.jpg" alt="مرقد أمير المؤمنين علي عليه السلام في النجف الأشرف" width={1600} height={1067} priority className="h-[260px] w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-page via-page/60 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 space-y-2 p-5 text-center">
          <h1 className="display text-[2.6rem] leading-tight text-ink [text-shadow:0_0_18px_var(--page),0_0_6px_var(--page)]">
            {name ? (
              <>
                هلا {name}! <span className="text-gold">من وين نبدأ؟</span>
              </>
            ) : (
              <>
                أهلًا بك في <span className="text-gold">نهج علي</span>
              </>
            )}
          </h1>
          <p className="text-lg font-bold text-muted">فرعين، وكل واحد عالم بحاله. اختر وابدأ.</p>
        </div>
      </section>

      {/* the two branches */}
      <div className="grid gap-5">
        {branches.map((b) => (
          <section
            key={b.key}
            aria-labelledby={`br-${b.key}`}
            className="relative flex flex-col overflow-hidden rounded-[2.2rem] p-6 text-white sm:p-8"
            style={{ background: b.bg, boxShadow: `0 30px 70px -30px ${b.glow}` }}
          >
            {/* light: a glow and a slow shine across */}
            <span aria-hidden className="pointer-events-none absolute -end-24 -top-24 size-72 rounded-full blur-3xl" style={{ background: b.glow }} />
            <span aria-hidden className="home-shine pointer-events-none absolute inset-0" />

            <div className="relative flex items-center gap-4">
              <Image src={b.logo} alt="" width={96} height={96} unoptimized={b.logo.startsWith("http")} className="size-24 shrink-0 rounded-full object-contain drop-shadow-[0_10px_25px_rgba(0,0,0,0.5)]" />
              <div className="min-w-0">
                {b.nameEn && (
                  <p dir="ltr" className="text-sm font-extrabold tracking-[0.3em] opacity-80" style={{ color: b.accent }}>
                    {b.nameEn}
                  </p>
                )}
                <h2 id={`br-${b.key}`} className="display text-[2.1rem] leading-tight sm:text-[2.5rem]">
                  {b.name}
                </h2>
                {b.badge && <span className="mt-1 inline-block rounded-full border border-white/40 px-2.5 py-0.5 text-xs font-extrabold">{b.badge}</span>}
              </div>
            </div>

            <p className="relative mt-4 text-lg font-bold text-white/90">{b.pitch}</p>

            <ul className={`relative mt-5 grid gap-2.5 ${b.parts.length > 4 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2"}`}>
              {b.parts.map((p) => (
                <li key={p.title}>
                  <Link href={p.href} className="flex h-full flex-col gap-0.5 rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/20">
                    <span className="text-2xl" aria-hidden>
                      {p.icon}
                    </span>
                    <b className="text-base leading-tight">{p.title}</b>
                    <span className="text-xs font-bold text-white/75">{p.text}</span>
                  </Link>
                </li>
              ))}
            </ul>

            <Link
              href={b.href}
              className="relative mt-6 flex min-h-16 items-center justify-center gap-2 rounded-2xl text-xl font-extrabold text-white shadow-xl transition active:scale-[0.97]"
              style={{ background: b.accent, color: b.accent === "#e3a90f" ? "#1b1405" : "#fff" }}
            >
              {b.cta} <span aria-hidden>←</span>
            </Link>
          </section>
        ))}
      </div>

      <Link href="/download" className="hide-in-app card flex items-center gap-4 p-4 transition hover:-translate-y-0.5">
        <span className="text-4xl" aria-hidden>
          📲
        </span>
        <span className="flex-1">
          <b className="block text-lg">حمّل نهج علي</b>
          <span className="text-sm font-bold text-muted">تطبيق الأندرويد، وبرنامج الجواد AI للماك والويندوز.</span>
        </span>
        <span className="chip">تحميل</span>
      </Link>
    </div>
  );
}
