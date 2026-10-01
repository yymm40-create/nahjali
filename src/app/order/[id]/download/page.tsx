import { redirect } from "next/navigation";
import { requireOrder } from "@/lib/auth";
import { BUCKETS, createAdminClient, signedUrl } from "@/lib/supabase/admin";
import { stepPath } from "@/lib/types";

export default async function DownloadPage({ params }: PageProps<"/order/[id]/download">) {
  const { id } = await params;
  const order = await requireOrder(id, `/order/${id}/download`);
  if (order.status !== "ready") redirect(stepPath(order));

  const { data: booklet } = await createAdminClient().from("booklets").select("*").eq("order_id", order.id).single();
  // Short-lived links, created fresh on every visit
  const viewUrl = await signedUrl(BUCKETS.booklets, booklet!.pdf_path, 3600);
  const downloadUrl = await signedUrl(BUCKETS.booklets, booklet!.pdf_path, 3600, "كتيب-نهج-علي.pdf");

  return (
    <div className="space-y-5">
      <div className="card p-6 text-center">
        <h1 className="display text-4xl">كتيبك جاهز!</h1>
        <p className="mt-2 font-bold">حمّله واطبعه، وخلّ طفلك يبدأ رحلة العادات الطيبة.</p>
      </div>

      <a href={downloadUrl} className="btn btn-primary w-full text-xl">
        تحميل الكتيب PDF
      </a>

      <div className="card overflow-hidden p-0">
        <iframe src={viewUrl} title="معاينة الكتيب" className="h-[70vh] w-full" />
      </div>
      <a href={viewUrl} target="_blank" rel="noopener" className="block text-center font-bold underline">
        المعاينة ما تشتغل؟ افتح الكتيب في صفحة جديدة
      </a>
      <p className="text-center text-sm font-bold text-muted">الكتيب محفوظ في صفحة &quot;كتيباتي&quot; وتقدر تحمّله أي وقت.</p>
    </div>
  );
}
