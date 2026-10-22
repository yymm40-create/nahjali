import type { Metadata } from "next";
import { contactOf } from "@/lib/contact";
import { requireJawadUser } from "@/lib/jawad/server/access";
import { createClient } from "@/lib/supabase/server";
import { getUsername } from "@/lib/username";
import { JAWAD } from "@config/jawad/brand";
import ContactForm from "./ContactForm";

export const metadata: Metadata = { title: "الحساب الشخصي" };
export const dynamic = "force-dynamic";

const safe = (n: unknown) => (typeof n === "string" && (n === JAWAD.base || n.startsWith(`${JAWAD.base}/`)) && !n.includes("//") && !n.startsWith(`${JAWAD.base}/account`) ? n : JAWAD.base);

/**
 * «الحساب الشخصي»: the name and WhatsApp number the payments and support use (kept on the account, src/lib/contact.ts). A new
 * account lands here once after its username (?first=1, no way around it); later it is the place to change them, and the credits
 * page sends here anyone who pays without them.
 */
export default async function AccountPage({ searchParams }: PageProps<"/jawad-ai/account">) {
  const sp = await searchParams;
  const next = safe(sp.next);
  const first = sp.first === "1";
  const { user } = await requireJawadUser(`${JAWAD.base}/account${first ? "?first=1&" : "?"}next=${encodeURIComponent(next)}`);
  const c = contactOf(user);
  const username = await getUsername(await createClient(), user.id).catch(() => null);
  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <div className="jw-panel space-y-6 p-6 sm:p-8">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">{first ? "خطوة أخيرة وتبدأ ✨" : "الحساب الشخصي"}</h1>
          <p className="text-sm text-jw-muted">{first ? "اسمك ورقم جوالك، مرة وحدة بس. نستخدمهم في إيصالات الدفع وإذا احتجت مساعدة." : "اسمك ورقم جوالك يُستخدمون في إيصالات الدفع والتواصل معك."}</p>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-jw-muted">الإيميل</dt>
          <dd dir="ltr" className="truncate text-end">{user.email}</dd>
          {username && (
            <>
              <dt className="text-jw-muted">اسم المستخدم</dt>
              <dd dir="auto" className="text-end">@{username}</dd>
            </>
          )}
        </dl>
        <ContactForm name={c.name} phone={c.phone} next={next} first={first} />
        <p className="text-xs text-jw-faint">ما ننشر شي باسمك ولا نشارك بياناتك.</p>
      </div>
    </div>
  );
}
