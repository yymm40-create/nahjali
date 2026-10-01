import Link from "next/link";
import { CONTACT_EMAIL, LEGAL_UPDATED, SITE_NAME } from "@config/site";

export const metadata = { title: "الشروط والأحكام" };

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "الخدمة",
    body: [
      `${SITE_NAME} يحوّل صورتك لشخصية كرتونية بالذكاء الاصطناعي، ويركّبها في كتيب عادات يومية تحمّله PDF.`,
      "الموقع حاليًا في فترة تجريبية مجانية. ممكن نغيّر الخدمة أو نوقف التجربة المجانية في أي وقت.",
      "لكل حساب عدد محدود من التجارب المجانية، وفيه حد يومي لعدد الطلبات على الموقع.",
    ],
  },
  {
    title: "الصور اللي ترفعها",
    body: [
      "ارفع صورتك أنت، أو صورة عندك إذن صاحبها، أو صورة طفل أنت ولي أمره.",
      "ممنوع رفع صور أشخاص بدون إذنهم، أو صور غير لائقة، أو صور فيها أكثر من شخص بغرض الإساءة.",
      "نقدر نرفض أو نوقف أي طلب يخالف هذي الشروط.",
    ],
  },
  {
    title: "النتيجة",
    body: [
      "الصور مولّدة بالذكاء الاصطناعي، وممكن تختلف عن الصورة الأصلية في بعض التفاصيل.",
      "عندك أكثر من محاولة لتوليد الشخصية، وتختار اللي تعجبك قبل ما تعتمدها.",
      "الكتيب لاستخدامك الشخصي والعائلي، مثل الطباعة في البيت أو إهداءه.",
    ],
  },
  {
    title: "المسؤولية",
    body: [
      "نقدم الخدمة \"كما هي\"، ونبذل جهدنا إنها تشتغل بدون مشاكل، لكن ما نضمن إنها تشتغل بدون انقطاع.",
      "تخضع هذي الشروط لأنظمة المملكة العربية السعودية.",
    ],
  },
];

export default function TermsPage() {
  return (
    <article className="card space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="display text-4xl">الشروط والأحكام</h1>
        <p className="text-sm font-bold text-ink/60">
          {SITE_NAME} · آخر تحديث: {LEGAL_UPDATED}
        </p>
      </header>
      {SECTIONS.map((s) => (
        <section key={s.title} className="space-y-2">
          <h2 className="text-xl font-extrabold">{s.title}</h2>
          <ul className="list-inside list-disc space-y-1 font-bold text-ink/80">
            {s.body.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </section>
      ))}
      <p className="font-bold">
        باستخدامك للموقع أنت موافق على هذي الشروط وعلى <Link href="/privacy" className="underline">سياسة الخصوصية</Link>. لأي سؤال:{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="underline" dir="ltr">{CONTACT_EMAIL}</a>
      </p>
    </article>
  );
}
