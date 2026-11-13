import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { jawadSession, jawadLogin } from "@/lib/jawad/server/access";
import { MCP_PATH } from "@/lib/mcp/meta";
import { SITE_URL } from "@config/site";
import { CopyLink, Disconnect } from "./ConnectTools";
import { ChatDemo, LivingBg } from "./Scene";
import "./connect.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "الجواد في كلاود وشات جي بي تي",
  description: "اربط حسابك في الجواد بكلاود أو شات جي بي تي، واطلب الكاروسيل والتصاميم والصور والفيديو من داخل المحادثة.",
};

const CAN = [
  { i: "🎠", t: "كاروسيل كامل مع محمد باقر، والشرائح ترجع لك روابط" },
  { i: "🎨", t: "الاستوديو الإبداعي: صور وفيديو وأصوات وموسيقى" },
  { i: "🖼️", t: "تصاميم كاظم، وحيدرا ماكس يرسمها" },
  { i: "🎬", t: "مونتاج وموشن في حيدرة كت" },
  { i: "📚", t: "مادة جديدة في الطالب الذكي من نص أو PDF" },
  { i: "📎", t: "ملفاتك (صور، فيديو، صوت، PDF) بكل الأقسام" },
];

/** «الجواد في كلاود وشات جي بي تي»: the connector's address and how to add it (no store listing needed). */
export default async function ConnectPage() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const origin = host ? `${proto}://${host}` : SITE_URL;
  const url = `${origin}${MCP_PATH}`;
  const { user } = await jawadSession();
  return (
    <div className="cn" dir="rtl">
      <LivingBg />
      <div className="cn-in">
        <span className="cn-eyebrow cn-glass cn-rise">
          <b aria-hidden /> جديد في الجواد
        </span>
        <h1 className="cn-h1 cn-rise" style={{ ["--d" as string]: 1 }}>
          الجواد صار <span className="cn-grad">داخل محادثتك</span>
        </h1>
        <p className="cn-lead cn-rise" style={{ ["--d" as string]: 2 }}>
          أضفه مرة وحدة في كلاود أو شات جي بي تي، وبعدها اطلب وانت تسولف. كل شي من رصيدك بنفس أسعار الموقع، ويسألك قبل أي خصم.
        </p>
        <div className="cn-chips cn-rise" style={{ ["--d" as string]: 3 }}>
          <span className="cn-chip cn-glass">
            <i style={{ background: "#d97757" }} /> Claude
          </span>
          <span className="cn-chip cn-glass">
            <i style={{ background: "#10a37f" }} /> ChatGPT
          </span>
        </div>

        <div className="cn-rise" style={{ ["--d" as string]: 4 }}>
          <ChatDemo />
        </div>

        <section className="cn-card cn-glass cn-rise" style={{ ["--d" as string]: 5 }}>
          <h2>
            <span className="cn-num">١</span> انسخ رابط الجواد
          </h2>
          <CopyLink url={url} />
        </section>

        <section className="cn-card cn-glass cn-rise" style={{ ["--d" as string]: 6 }}>
          <h2>
            <span className="cn-num">٢</span> أضفه في كلاود
          </h2>
          <ol className="cn-steps">
            <li>افتح claude.ai ← الإعدادات ← Connectors.</li>
            <li>اضغط «Add custom connector».</li>
            <li>اكتب الاسم «الجواد» والصق الرابط، واضغط Add.</li>
            <li>اضغط «Connect»، تفتح لك صفحة الجواد: سجّل دخولك واضغط «اسمح».</li>
          </ol>
        </section>

        <section className="cn-card cn-glass cn-rise" style={{ ["--d" as string]: 7 }}>
          <h2>
            <span className="cn-num">٣</span> أو في شات جي بي تي
          </h2>
          <ol className="cn-steps">
            <li>افتح chatgpt.com ← الإعدادات ← Apps &amp; Connectors.</li>
            <li>من «Advanced settings» شغّل «Developer mode».</li>
            <li>اضغط «Create»، اكتب «الجواد» والصق الرابط، واختر OAuth.</li>
            <li>يطلع تنبيه «غير موثّق»: طبيعي لأنه مو من متجرهم. وافق، وسجّل دخولك واضغط «اسمح».</li>
          </ol>
          <p className="cn-note">الخاصية هذي تحتاج غالبًا اشتراك مدفوع في كلاود أو شات جي بي تي.</p>
        </section>

        <section className="cn-card cn-glass cn-rise" style={{ ["--d" as string]: 8 }}>
          <h2>وش تقدر تطلب؟</h2>
          <div className="cn-grid">
            {CAN.map((c) => (
              <div key={c.t} className="cn-tile">
                <span aria-hidden>{c.i}</span>
                {c.t}
              </div>
            ))}
          </div>
          <p className="cn-note">
            التصاميم ومونتاج حيدرة كت وخطوات الطالب الذكي تكمل هنا بالموقع: يعطيك رابط يفتحها وتكمل لحالها. والملفات: في شات جي بي تي ترفقها بالمحادثة، وفي كلاود ترفعها من{" "}
            <Link href="/jawad-ai/connect/upload">صفحة الرفع</Link>.
          </p>
        </section>

        <section className="cn-card cn-glass cn-rise" style={{ ["--d" as string]: 9 }}>
          <h2>فصل الربط</h2>
          {user ? (
            <>
              <p className="cn-note" style={{ marginTop: 0, marginBottom: 12 }}>يوقف كل ربط بحسابك في كلاود وشات جي بي تي على طول.</p>
              <Disconnect />
            </>
          ) : (
            <Link href={jawadLogin("/jawad-ai/connect")} className="cn-btn-soft inline-flex items-center">
              سجّل دخولك أول
            </Link>
          )}
        </section>
      </div>
    </div>
  );
}
