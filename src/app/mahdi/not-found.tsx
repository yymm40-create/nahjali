import Link from "next/link";
import { t } from "@/lib/mahdi/i18n";

export default function MahdiNotFound() {
  return (
    <main id="m-main" className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="m-display m-gold text-3xl">{t.notFound.title}</h1>
      <Link href="/mahdi" className="m-btn m-btn-primary">{t.notFound.back}</Link>
    </main>
  );
}
