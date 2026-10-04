import Link from "next/link";
import Icon from "@/components/jawad/Icon";

/** JAWAD AI's own "not found" (stays in its identity; the way back is JAWAD AI's home). */
export default function JawadNotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-jw-surface-2 text-jw-muted"><Icon name="info" size={26} /></span>
      <h1 className="text-xl font-bold">الصفحة غير موجودة</h1>
      <p className="text-sm text-jw-muted">ربما تغيّر الرابط أو حُذف المحتوى.</p>
      <Link href="/jawad-ai" className="jw-btn jw-btn-primary">رئيسية JAWAD AI</Link>
    </div>
  );
}
