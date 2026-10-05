import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getMahdiSession } from "@/lib/mahdi/server/session";
import { isPrivate, personByUsername } from "@/lib/mahdi/server/social";
import { t } from "@/lib/mahdi/i18n";

export const dynamic = "force-dynamic";

const I = t.social.invite;
const handleOf = (raw: string) => decodeURIComponent(raw).trim().replace(/^@/, "").slice(0, 30);

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }) {
  const person = await personByUsername(handleOf((await params).username)).catch(() => null);
  const title = person ? I.title(person.displayName) : I.anonymous;
  return { title, description: t.auth.tagline, openGraph: { title, description: t.auth.tagline } };
}

/**
 * The link people put in their Instagram story: «تابِعني في لأجل المهدي». Someone already in the app goes straight to
 * the person's page; a visitor sees who invited them and what the app is, and signs up (or in) to land back on that
 * person's page, ready to follow. Someone outside the community with a locked account (or a family member) shows no
 * name or picture; a locked account says that following it waits for approval.
 */
export default async function Join({ params }: { params: Promise<{ username: string }> }) {
  const handle = handleOf((await params).username);
  const { user, profile } = await getMahdiSession();
  if (user && profile) redirect(`/mahdi/u/${encodeURIComponent(handle)}?invited=1`);
  const person = handle ? await personByUsername(handle).catch(() => null) : null;
  const locked = person ? await isPrivate(person.id).catch(() => false) : Boolean(handle);
  const go = (to: "signup" | "login" | "app") => `/api/mahdi/invite?u=${encodeURIComponent(handle)}&to=${to}`;

  return (
    <main id="m-main" className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center gap-6 px-5 py-10">
      <div className="flex items-center gap-3">
        <Image src="/brand/logo.png" alt="نهج علي" width={52} height={59} priority className="h-14 w-auto drop-shadow" />
        <div>
          <p className="m-display m-gold m-shadow-text text-3xl leading-none">{t.brand}</p>
          <p className="m-shadow-text text-sm">نهج علي</p>
        </div>
      </div>

      <section className="m-card space-y-4 p-5 text-center">
        {person?.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={person.avatarUrl} alt="" className="mx-auto size-24 rounded-full object-cover ring-4 ring-[var(--m-gold)]" />
        ) : (
          <span className="mx-auto grid size-24 place-items-center rounded-full bg-[var(--m-gold)] text-4xl font-bold text-[#2b2110]">{[...(person?.displayName ?? handle ?? "؟")][0]}</span>
        )}
        <div className="space-y-1">
          <h1 className="m-display text-2xl">{person ? I.title(person.displayName) : I.anonymous}</h1>
          {handle && <p className="m-gold text-sm" dir="ltr">@{handle}</p>}
        </div>
        <p className="m-muted">{person ? I.lead(person.displayName) : I.leadAnonymous}</p>
        {locked && <p className="text-xs m-muted">{I.private}</p>}
      </section>

      <section className="space-y-2">
        <p className="m-shadow-text">{t.auth.tagline}</p>
        <ul className="space-y-1.5">
          {t.auth.points.map((p) => (
            <li key={p} className="m-shadow-text flex items-center gap-2 text-sm">
              <span className="m-dot" style={{ background: "var(--m-gold)" }} /> {p}
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-3">
        <Link href={go(user ? "app" : "signup")} className="m-btn m-btn-primary text-lg">{person ? I.signup(person.displayName) : I.signupAnonymous}</Link>
        {!user && <Link href={go("login")} className="m-btn m-btn-ghost text-lg">{I.login}</Link>}
      </div>
    </main>
  );
}
