import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getUsername, suggestionFor } from "@/lib/username";
import UsernameStep from "./UsernameStep";

export const metadata = { title: "اسم المستخدم | نهج علي" };
export const dynamic = "force-dynamic";

const safe = (n: unknown) => (typeof n === "string" && n.startsWith("/") && !n.startsWith("//") && !n.includes("\\") ? n : "/");

/** Right after creating an account (or when the old name is taken): every account picks a unique username. */
export default async function UsernamePage({ searchParams }: PageProps<"/username">) {
  const next = safe((await searchParams).next);
  const user = await requireUser(`/username?next=${encodeURIComponent(next)}`);
  const supabase = await createClient();
  if (await getUsername(supabase, user.id)) redirect(next);
  const { data: profile } = await supabase.from("mahdi_profiles").select("display_name").eq("user_id", user.id).maybeSingle();
  return <UsernameStep suggestion={suggestionFor(user, [profile?.display_name])} next={next} />;
}
