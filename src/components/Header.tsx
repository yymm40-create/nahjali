import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "./SignOutButton";
import MenuDetails from "./MenuDetails";
import SmartCoin from "./SmartCoin";
import { coinBalance } from "@/lib/coins";
import ThemeSwitcher from "./ThemeSwitcher";
import { isAdmin } from "@config/site";
import { bookletOpenFor } from "@/lib/film/limits";
import { SECTIONS } from "@config/sections";

const ITEM = "rounded-xl px-3 py-2 hover:bg-surface-2";

export default async function Header() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const bookletOpen = user ? await bookletOpenFor(user.email) : false;
  // «النقود الذكية»: the user's balance (null until the coin tables exist)
  const coins = user ? await coinBalance(user.id) : null;

  return (
    <header className="sticky top-0 z-20 border-b border-line/60 bg-page/80 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-xl items-center justify-between gap-3 px-4 py-2">
        <Link href="/" className="flex items-center gap-2" aria-label="نهج علي، الرئيسية">
          <Image src="/brand/logo.png" alt="" width={44} height={50} priority className="h-12 w-auto drop-shadow" />
          <span className="display gold-text text-2xl">نهج علي</span>
        </Link>
        <div className="flex items-center gap-2">
          {user && coins !== null && (
            <Link
              href="/coins"
              className="flex items-center gap-1 rounded-full border border-sky-400/60 bg-sky-400/10 px-2.5 py-1.5 text-sm font-extrabold text-sky-500"
              aria-label={`النقود الذكية: ${isAdmin(user.email) ? "بلا حد" : coins}`}
            >
              <SmartCoin size={20} />
              <span dir="ltr">{isAdmin(user.email) ? "∞" : coins.toLocaleString("en")}</span>
            </Link>
          )}
          <ThemeSwitcher />
          {user ? (
            <MenuDetails className="relative">
              <summary className="grid size-11 cursor-pointer list-none place-items-center rounded-full border border-line bg-surface text-xl">
                ☰
              </summary>
              <nav className="card absolute end-0 mt-2 flex w-48 flex-col p-2 text-base font-extrabold">
                {SECTIONS.filter((s) => !(s.underDevelopment && !bookletOpen)).map((s) => (
                  <Link key={s.key} href={s.href} className={ITEM}>{s.icon} {s.title}</Link>
                ))}
                <Link href="/jawad-ai/student" className={ITEM}>🎒 الطالب الذكي</Link>
                <Link href="/jawad-ai/editor" className={ITEM}>✂️ حيدرة كت</Link>
                <Link href="/jawad-ai" className={ITEM}>✨ منصة الذكاء الاصطناعي</Link>
                <hr className="my-1 border-line" />
                {bookletOpen && <Link href="/my-booklets" className={ITEM}>📚 كتيباتي</Link>}
                {isAdmin(user.email) && (
                  <Link href="/admin" className={ITEM}>📊 لوحة التحكم</Link>
                )}
                <SignOutButton />
                <Link href="/account/delete" className="rounded-xl px-3 py-2 text-sm text-muted hover:bg-surface-2">🗑️ حذف حسابي</Link>
              </nav>
            </MenuDetails>
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
