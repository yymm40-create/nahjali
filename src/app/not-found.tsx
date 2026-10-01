import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card space-y-4 p-6 text-center">
      <h1 className="display text-4xl">الصفحة مو موجودة</h1>
      <Link href="/" className="btn btn-primary">الرئيسية</Link>
    </div>
  );
}
