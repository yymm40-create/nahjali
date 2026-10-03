import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { canUseFilm } from "@/lib/film/access";
import SignOutButton from "./SignOutButton";
import ThemeSwitcher from "./ThemeSwitcher";
import { isAdmin } from "@config/site";
import { SECTIONS } from "@config/sections";
import { isAdmin } from "@config/site";

const ITEM = "rounded-xl px-3 py-2 hover:bg-surface-2";

export default async function Header() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const filmAllowed = user ? await canUseFilm(user.email) : false;

  return (
    <header className="sticky top-0 z-20 border-b border-line/60 bg-page/80 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-xl items-center justify-between gap-3 px-4 py-2">
        <Link href="/" className="flex items-center gap-2" aria-label="نهج علي، الرئيسية">
          <Image src="/brand/logo.png" alt="" width={44} height={50} priority className="h-12 w-auto drop-shadow" />
          <span className="display gold-text text-2xl">نهج علي</span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeSwitcher />
          {user ? (
            <details className="relative">
              <summary className="grid size-11 cursor-pointer list-none place-items-center rounded-full border border-line bg-surface text-xl">
                ☰
              </summary>
              <nav className="card absolute end-0 mt-2 flex w-48 flex-col p-2 text-base font-extrabold">
                {SECTIONS.filter((s) => !s.requiresFilmAccess || (filmAllowed && isAdmin(user?.email))).map((s) => (
                  <Link key={s.key} href={s.href} className={ITEM}>{s.icon} {s.title}</Link>
                ))}
                <hr className="my-1 border-line" />
                <Link href="/my-booklets" className={ITEM}>📚 كتيباتي</Link>
                {filmAllowed && isAdmin(user?.email) && <Link href="/film" className={ITEM}>🎞️ مشاريع أفلامي</Link>}
                {isAdmin(user.email) && (
                  <Link href="/admin" className={ITEM}>📊 لوحة التحكم</Link>
                )}
                <SignOutButton />
              </nav>
            </details>
          ) : (
            <Link href="/login" className="btn btn-ghost min-h-11 px-4 text-base">
              دخول
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
