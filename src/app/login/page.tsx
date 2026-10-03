import { EMAIL_LOGIN_ENABLED } from "@config/pricing";
import EmailLogin from "./EmailLogin";
import LoginButton from "./LoginButton";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;
  const nextPath = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/";

  return (
    <div className="card mt-6 space-y-6 p-6 text-center">
      <h1 className="display text-4xl">أهلًا فيك!</h1>
      <p className="text-lg font-bold text-muted">سجّل دخولك عشان نحفظ كتيباتك وترجع لها متى ما بغيت.</p>
      {error && <p className="error-box">ما قدرنا نسجّل دخولك. جرّب مرة ثانية.</p>}
      <LoginButton next={nextPath} />
      {EMAIL_LOGIN_ENABLED && (
        <>
          <div className="flex items-center gap-3 font-bold text-muted">
            <span className="h-[3px] flex-1 rounded bg-line" />
            أو بالإيميل
            <span className="h-[3px] flex-1 rounded bg-line" />
          </div>
          <EmailLogin next={nextPath} />
        </>
      )}
    </div>
  );
}
