import { redirect } from "next/navigation";
import { requireOrder } from "@/lib/auth";
import { BUCKETS, createAdminClient, signedUrl } from "@/lib/supabase/admin";
import { bookletStep, specOf } from "@/lib/tables-booklet/server";
import { TB } from "@config/tables-booklet";

export const dynamic = "force-dynamic";

/** The finished booklet: download it (short-lived links, made fresh on every visit) and see it here. */
export default async function BookletDownloadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await requireOrder(id, `${TB.base}/${id}/download`);
  if (order.status !== "ready") redirect(bookletStep(order));

  const { data: booklet } = await createAdminClient().from("booklets").select("pdf_path").eq("order_id", order.id).maybeSingle();
  if (!booklet) redirect(TB.base);
  const title = specOf(order)?.design?.title || `كتيب ${order.child_name ?? ""}`.trim();
  const file = `${title.replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, "-")}.pdf`;
  const viewUrl = await signedUrl(BUCKETS.booklets, booklet.pdf_path, 3600);
  const downloadUrl = await signedUrl(BUCKETS.booklets, booklet.pdf_path, 3600, file);

  return (
    <div className="space-y-5">
      <div className="card p-6 text-center">
        <h1 className="display text-4xl">كتيبك جاهز! 🎉</h1>
        <p className="mt-2 font-bold">حمّله واطبعه، وابدأ الجداول من اليوم.</p>
      </div>
      <a href={downloadUrl} className="btn btn-primary w-full text-xl">تحميل الكتيب PDF</a>
      <div className="card overflow-hidden p-0">
        <iframe src={viewUrl} title="معاينة الكتيب" className="h-[70vh] w-full" />
      </div>
      <a href={viewUrl} target="_blank" rel="noopener" className="block text-center font-bold underline">المعاينة ما تشتغل؟ افتح الكتيب في صفحة جديدة</a>
      <p className="text-center text-sm font-bold">الكتيب محفوظ في «{TB.name}» وتقدر تحمّله أي وقت.</p>
    </div>
  );
}
