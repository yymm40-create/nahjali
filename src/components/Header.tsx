import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "./SignOutButton";

export default async function Header() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="mx-auto flex w-full max-w-xl items-center justify-between px-4 py-4">
      <Link href="/" className="display -rotate-2 rounded-2xl border-[3px] border-ink bg-sun px-3 pt-1 text-2xl shadow-[3px_3px_0_var(--color-ink)]">
        عاداتي الخارقة
      </Link>
      <nav className="flex items-center gap-3 text-sm font-extrabold">
        {user ? (
          <>
            <Link href="/my-booklets" className="underline">كتيباتي</Link>
            <SignOutButton />
          </>
        ) : (
          <Link href="/login" className="underline">تسجيل الدخول</Link>
        )}
      </nav>
    </header>
  );
}
