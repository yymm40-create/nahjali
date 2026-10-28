import Link from "next/link";
import { CONTACT_EMAIL, LEGAL_UPDATED, SITE_NAME } from "@config/site";

export const metadata = { title: "سياسة الاسترجاع والاستبدال" };

/**
 * «سياسة الاسترجاع والاستبدال»: the payment gateway asks for one. It follows the terms (/terms): a failed generation goes
 * back by itself, a completed one is a consumed digital service, and the cases where money does go back are written out.
 */
const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "طبيعة الخدمة",
    body: [
      `${SITE_NAME} يبيع خدمة رقمية: رصيد تستخدمه داخل الموقع لتوليد الصور والفيديو والصوت وغيرها بالذكاء الاصطناعي. ما فيه منتج مادي يُشحن أو يُرجع.`,
      "سعر كل عملية يظهر لك قبل ما تضغط «توليد»، وتقدر تلغي قبلها بدون أي خصم.",
    ],
  },
  {
    title: "التوليد اللي يفشل",
    body: ["أي عملية تفشل قبل ما تكتمل يرجع رصيدها لك تلقائيًا، بدون ما تطلب."],
  },
  {
    title: "النتيجة اللي اكتملت",
    body: [
      "العملية اللي اكتملت وسُلّمت لك استُهلكت، فما تُسترجع، لأن الذكاء الاصطناعي ولّدها فعلًا وكلّفتنا.",
      "النتائج مولّدة بالذكاء الاصطناعي وممكن تختلف عن وصفك في بعض التفاصيل؛ جرّب وصفًا أدق، ويظهر لك السعر قبل كل مرة.",
    ],
  },
  {
    title: "الاستبدال",
    body: [
      "ما فيه استبدال مثل المنتجات المادية. لكن لو وصلك ملف تالف تقنيًا (ما يفتح، أو ناقص، أو فاضي)، راسلنا ونعيد توليده لك، أو نرجّع رصيده.",
    ],
  },
  {
    title: "رصيد ما استخدمت منه شي",
    body: [
      "إذا شحنت رصيدك وما استخدمت منه شي، تقدر تطلب استرجاع المبلغ خلال ٧ أيام من الشحن، ونرجعه لك بنفس طريقة الدفع.",
      "إذا استخدمت جزء من الرصيد، ما نسترجع الجزء المستخدم، ونرجع لك الباقي إذا طلبت ذلك خلال المدة نفسها.",
    ],
  },
  {
    title: "خصم مكرر أو خطأ في الدفع",
    body: [
      "إذا انخصم منك المبلغ مرتين، أو انخصم ولم يصلك الرصيد، راسلنا ونتأكد ونرجّع لك المبلغ أو نضيفه لرصيدك، حسب ما تختار.",
    ],
  },
  {
    title: "مدة وصول المبلغ",
    body: [
      "بعد الموافقة على الاسترجاع نرسله بنفس طريقة الدفع الأصلية. مدة ظهوره في حسابك تعتمد على البنك أو مصدر البطاقة، وغالبًا تكون بين ٥ و١٤ يوم عمل.",
      "الشحن بالتحويل البنكي نرجّعه لنفس الحساب اللي حوّلت منه.",
    ],
  },
  {
    title: "كيف تطلب",
    body: [
      `راسلنا على ${CONTACT_EMAIL} أو على الواتساب الظاهر في صفحة الشحن، واكتب إيميل حسابك وتاريخ الشحن أو رقم الطلب، وسبب الطلب. نرد عادةً خلال يوم عمل.`,
    ],
  },
];

export default function RefundPage() {
  return (
    <article className="card space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="display text-4xl">سياسة الاسترجاع والاستبدال</h1>
        <p className="text-sm font-bold text-muted">
          {SITE_NAME} · آخر تحديث: {LEGAL_UPDATED}
        </p>
      </header>
      {SECTIONS.map((s) => (
        <section key={s.title} className="space-y-2">
          <h2 className="text-xl font-extrabold">{s.title}</h2>
          <ul className="list-inside list-disc space-y-1 font-bold text-muted">
            {s.body.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </section>
      ))}
      <p className="font-bold">
        تُقرأ مع <Link href="/terms" className="underline">الشروط والأحكام</Link> و<Link href="/privacy" className="underline">سياسة الخصوصية</Link>. لأي سؤال:{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="underline" dir="ltr">{CONTACT_EMAIL}</a>
      </p>
    </article>
  );
}
