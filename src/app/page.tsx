import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { canUseFilm } from "@/lib/film/access";
import { SECTIONS } from "@config/sections";
import { isAdmin } from "@config/site";

/** Home: the site's sections (config/sections.ts). */
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const filmAllowed = user ? await canUseFilm(user) : false;

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
        <ul className="space-y-3">
          {SECTIONS.filter((s) => !s.requiresFilmAccess || isAdmin(user?.email)).map((s) => {
            // The film section is shown to the owner only (for now)
            const locked = s.requiresFilmAccess && user && !filmAllowed;
            const body = (
              <>
                <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-surface-2 text-4xl">{s.icon}</span>
                <div className="flex-1">
                  <h3 className="flex items-center gap-2 text-xl font-extrabold">
                    {s.title}
                    {locked && <span className="chip text-xs">قريبًا</span>}
                  </h3>
                  <p className="font-bold text-muted">{s.description}</p>
                </div>
              </>
            );
            return (
              <li key={s.key}>
                {locked ? (
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
