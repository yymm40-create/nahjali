import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { jawadSession, jawadLogin } from "@/lib/jawad/server/access";
import { MCP_PATH } from "@/lib/mcp/meta";
import { MCP_TOOLS_SUMMARY } from "@/lib/mcp/summary";
import { SITE_URL } from "@config/site";
import { CopyLink, Disconnect } from "./ConnectTools";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "الجواد في كلاود وشات جي بي تي",
  description: "اربط حسابك في الجواد بكلاود أو شات جي بي تي، واطلب الكاروسيل والتصاميم والصور والفيديو من داخل المحادثة.",
};

/** «الجواد في كلاود وشات جي بي تي»: the connector's address and how to add it (no store listing needed). */
export default async function ConnectPage() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const origin = host ? `${proto}://${host}` : SITE_URL;
  const url = `${origin}${MCP_PATH}`;
  const { user } = await jawadSession();
  return (
    <section className="mx-auto max-w-2xl space-y-5 p-4 py-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-extrabold">الجواد في كلاود وشات جي بي تي</h1>
        <p className="font-bold text-muted">أضف الجواد عندك مرة وحدة، وبعدها اطلب من داخل المحادثة. كل شي ينحسب من رصيدك بنفس أسعار الموقع.</p>
      </header>

      <div className="card space-y-3 p-5">
        <h2 className="text-xl font-extrabold">١. انسخ رابط الجواد</h2>
        <CopyLink url={url} />
      </div>

      <div className="card space-y-3 p-5">
        <h2 className="text-xl font-extrabold">٢. أضفه في كلاود</h2>
        <ol className="list-decimal space-y-1 ps-6 font-bold">
          <li>افتح claude.ai ← الإعدادات ← Connectors.</li>
          <li>اضغط «Add custom connector».</li>
          <li>اكتب الاسم «الجواد» والصق الرابط، واضغط Add.</li>
          <li>اضغط «Connect»: تفتح لك صفحة الجواد، سجّل دخولك واضغط «اسمح».</li>
        </ol>
      </div>

      <div className="card space-y-3 p-5">
        <h2 className="text-xl font-extrabold">٣. أو في شات جي بي تي</h2>
        <ol className="list-decimal space-y-1 ps-6 font-bold">
          <li>افتح chatgpt.com ← الإعدادات ← Apps &amp; Connectors.</li>
          <li>من «Advanced settings» شغّل «Developer mode».</li>
          <li>اضغط «Create»، اكتب الاسم «الجواد» والصق الرابط، واختر OAuth.</li>
          <li>يطلع لك تنبيه إنه «غير موثّق»: هذا طبيعي لأنه مو من متجرهم. وافق، وسجّل دخولك في الجواد واضغط «اسمح».</li>
        </ol>
        <p className="text-sm font-bold text-muted">الخاصية هذي تحتاج غالبًا اشتراك مدفوع في كلاود أو شات جي بي تي.</p>
      </div>

      <div className="card space-y-3 p-5">
        <h2 className="text-xl font-extrabold">وش يقدر يسوي؟</h2>
        <ul className="list-disc space-y-1 ps-6 font-bold">
          {MCP_TOOLS_SUMMARY.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <p className="text-sm font-bold text-muted">قبل أي توليد من الاستوديو يقولك السعر وينتظر موافقتك. والتصاميم ومونتاج حيدرة كت وخطوات الطالب الذكي تكمل هنا بالموقع: يعطيك رابط يفتحها وتكمل لحالها.</p>
      </div>

      <div className="card space-y-3 p-5">
        <h2 className="text-xl font-extrabold">فصل الربط</h2>
        {user ? (
          <>
            <p className="font-bold text-muted">يوقف كل ربط بحسابك في كلاود وشات جي بي تي على طول.</p>
            <Disconnect />
          </>
        ) : (
          <Link href={jawadLogin("/jawad-ai/connect")} className="btn btn-ghost min-h-11 px-5 text-base">
            سجّل دخولك أول
          </Link>
        )}
      </div>
    </section>
  );
}
