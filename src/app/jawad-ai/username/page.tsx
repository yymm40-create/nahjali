import { redirect } from "next/navigation";
import UsernameStep from "@/app/username/UsernameStep";
import { createClient } from "@/lib/supabase/server";
import { getUsername, suggestionFor } from "@/lib/username";
import { requireJawadUser } from "@/lib/jawad/server/access";
import { JAWAD } from "@config/jawad/brand";

export const metadata = { title: "اسم المستخدم" };
export const dynamic = "force-dynamic";

const safe = (n: unknown) => (typeof n === "string" && (n === JAWAD.base || n.startsWith(`${JAWAD.base}/`)) && !n.includes("//") ? n : JAWAD.base);

/** A new account picks its unique username (the site-wide one), inside JAWAD AI. */
export default async function JawadUsername({ searchParams }: PageProps<"/jawad-ai/username">) {
  const next = safe((await searchParams).next);
  const { user } = await requireJawadUser(`${JAWAD.base}/username?next=${encodeURIComponent(next)}`);
  const supabase = await createClient();
  if (await getUsername(supabase, user.id)) redirect(next);
  return (
    <div className="px-4 py-8">
      <UsernameStep suggestion={suggestionFor(user)} next={next} intro="اختر اسمًا مميزًا لحسابك؛ لا يتكرر، ويُستخدم في كل خدمات حسابك. المسافة تصير _ ." />
    </div>
  );
}
