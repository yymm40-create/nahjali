import { redirect } from "next/navigation";
import { getMahdiSession } from "@/lib/mahdi/server/session";
import { safeNext } from "@/lib/mahdi/client/derive";
import { t } from "@/lib/mahdi/i18n";
import LoginForm from "./LoginForm";

export const metadata = { title: t.auth.login };

export default async function MahdiLogin({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { next, error } = await searchParams;
  const target = safeNext(next);
  const { user } = await getMahdiSession();
  if (user) redirect(target);
  return <LoginForm next={target} failed={Boolean(error)} />;
}
