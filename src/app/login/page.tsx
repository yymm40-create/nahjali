import LoginButton from "./LoginButton";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;
  const nextPath = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/new";

  return (
    <div className="card mt-6 space-y-6 p-6 text-center">
      <h1 className="display text-4xl">أهلًا فيك!</h1>
      <p className="text-lg font-bold text-ink/70">سجّل دخولك عشان نحفظ كتيباتك وترجع لها متى ما بغيت.</p>
      {error && <p className="error-box">ما قدرنا نسجّل دخولك. جرّب مرة ثانية.</p>}
      <LoginButton next={nextPath} />
    </div>
  );
}
