import { redirect } from "next/navigation";
import Image from "next/image";
import { EMAIL_LOGIN_ENABLED } from "@config/pricing";
import { JAWAD } from "@config/jawad/brand";
import EmailLogin from "@/app/login/EmailLogin";
import LoginButton from "@/app/login/LoginButton";
import AppleButton from "@/app/login/AppleButton";
import { appleLoginOn } from "@/lib/auth-providers";
import { jawadSession } from "@/lib/jawad/server/access";
import { signupFreeImageEligible } from "@/lib/jawad/server/free-image";
import { loadRuntime } from "@/lib/jawad/server/runtime";

export const metadata = { title: "تسجيل الدخول" };

// back to JAWAD AI or to another page of the site (the dashboard…): only a path on this site, never another address
const safe = (n: unknown) => (typeof n === "string" && n.startsWith("/") && !n.includes("//") && !n.includes("\\") ? n : JAWAD.base);

/**
 * Sign in without leaving JAWAD AI (same accounts as the rest of the site); afterwards back to where you were. Written for a
 * visitor who came from an ad: fast, no card, and the free first picture when that offer is on for an account made today.
 */
export default async function JawadLogin({ searchParams }: PageProps<"/jawad-ai/login">) {
  const { next, error } = await searchParams;
  const nextPath = safe(next);
  const [{ user }, rt, freeImageOn] = await Promise.all([jawadSession(), loadRuntime(), signupFreeImageEligible(new Date().toISOString()).catch(() => false)]);
  if (user) redirect(nextPath);
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-var(--jw-header-h)-var(--jw-bar-h))] max-w-md flex-col justify-center px-4 py-10">
      <div className="jw-panel space-y-6 p-6 text-center sm:p-8">
        <Image src={rt.brand.logoUrl} alt="" width={72} height={72} unoptimized={rt.brand.customLogo} className="mx-auto size-18 rounded-full" />
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">{freeImageOn ? "ادخل في ثواني وخذ أول صورة مجانًا 🎁" : "ادخل في ثواني"}</h1>
          <p className="text-sm text-jw-muted">{EMAIL_LOGIN_ENABLED ? "حساب جوجل أو إيميلك" : "حساب جوجل"} — بدون بطاقة ولا اشتراك. أعمالك ورصيدك تنحفظ وترجع لها من أي جهاز.</p>
        </div>
        {error && <p className="error-box text-sm">تعذّر تسجيل الدخول. جرّب مرة ثانية.</p>}
        <LoginButton next={nextPath} />
        {(await appleLoginOn()) && <AppleButton next={nextPath} />}
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
        <p className="text-xs text-jw-faint">ما ننشر شي باسمك ولا نشارك بياناتك.</p>
      </div>
    </div>
  );
}
