import Link from "next/link";
import { redirect } from "next/navigation";
import { getMahdiSession } from "@/lib/mahdi/server/session";
import { t } from "@/lib/mahdi/i18n";

export const metadata = { title: t.brand };

/** Visitors' page: what «لأجل المهدي» is, with sign-up and sign-in. */
export default async function MahdiStart() {
  const { user } = await getMahdiSession();
  if (user) redirect("/mahdi");
  return (
    <main id="m-main" className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-end gap-8 px-5 pb-12 pt-[38vh]">
      <div className="space-y-4">
        <h1 className="m-display m-gold m-shadow-text text-6xl">{t.brand}</h1>
        <p className="m-shadow-text text-lg">{t.auth.tagline}</p>
        <ul className="space-y-2">
          {t.auth.points.map((p) => (
            <li key={p} className="m-shadow-text flex items-center gap-2">
              <span className="m-dot" style={{ background: "var(--m-gold)" }} /> {p}
            </li>
          ))}
        </ul>
      </div>
      <div className="grid gap-3">
        <Link href="/mahdi/signup" className="m-btn m-btn-primary text-lg">{t.auth.signup}</Link>
        <Link href="/mahdi/login" className="m-btn m-btn-ghost text-lg">{t.auth.login}</Link>
        <Link href="/" className="m-btn m-btn-quiet m-shadow-text">{t.backToSite}</Link>
      </div>
      <p className="m-chip mx-auto">{t.testing}</p>
    </main>
  );
}
