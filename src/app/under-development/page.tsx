import Link from "next/link";

export const metadata = { title: "تحت التطوير | نهج علي" };

/** Where the closed «كتيب نهج علي» pages send visitors (see BOOKLET_LOCKED in config/site.ts). */
export default function UnderDevelopment() {
  return (
    <div className="card space-y-4 p-6 text-center">
      <p className="text-5xl">📖</p>
      <h1 className="display text-4xl">كتيب نهج علي تحت التطوير</h1>
      <p className="font-bold text-muted">نشتغل على تحسينه، ويرجع قريبًا إن شاء الله.</p>
      <Link href="/" className="btn btn-primary">الرئيسية</Link>
    </div>
  );
}
