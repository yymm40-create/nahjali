import { redirect } from "next/navigation";
import Image from "next/image";
import { EMAIL_LOGIN_ENABLED } from "@config/pricing";
import { JAWAD } from "@config/jawad/brand";
import EmailLogin from "@/app/login/EmailLogin";
import LoginButton from "@/app/login/LoginButton";
import { jawadSession } from "@/lib/jawad/server/access";
import { loadRuntime } from "@/lib/jawad/server/runtime";

export const metadata = { title: "تسجيل الدخول" };

const safe = (n: unknown) => (typeof n === "string" && (n === JAWAD.base || n.startsWith(`${JAWAD.base}/`)) && !n.includes("//") ? n : JAWAD.base);

/** Sign in without leaving JAWAD AI (same accounts as the rest of the site); afterwards back to where you were. */
export default async function JawadLogin({ searchParams }: PageProps<"/jawad-ai/login">) {
  const { next, error } = await searchParams;
  const nextPath = safe(next);
  const [{ user }, rt] = await Promise.all([jawadSession(), loadRuntime()]);
  if (user) redirect(nextPath);
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-var(--jw-header-h)-var(--jw-bar-h))] max-w-md flex-col justify-center px-4 py-10">
      <div className="jw-panel space-y-6 p-6 text-center sm:p-8">
        <Image src={rt.brand.logoUrl} alt="" width={72} height={72} unoptimized={rt.brand.customLogo} className="mx-auto size-18 rounded-full" />
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">تسجيل الدخول إلى <span dir="ltr">{JAWAD.nameEn}</span></h1>
          <p className="text-sm text-jw-muted">لحفظ أعمالك ورصيدك والرجوع لها من أي جهاز.</p>
        </div>
        {error && <p className="error-box text-sm">تعذّر تسجيل الدخول. جرّب مرة ثانية.</p>}
        <LoginButton next={nextPath} />
        {EMAIL_LOGIN_ENABLED && (
          <>
            <div className="flex items-center gap-3 text-xs text-jw-muted">
              <span className="h-px flex-1 bg-jw-line-strong" />
              أو بالإيميل
              <span className="h-px flex-1 bg-jw-line-strong" />
            </div>
            <EmailLogin next={nextPath} />
          </>
        )}
      </div>
    </div>
  );
}
