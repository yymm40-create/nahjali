import { CONTACT_EMAIL, LEGAL_UPDATED, SITE_NAME } from "@config/site";

export const metadata = { title: "سياسة الخصوصية" };

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "الصورة الأصلية: تنحذف ولا نحتفظ فيها",
    body: [
      "الصورة اللي ترفعها نستخدمها لشي واحد بس: تحويلها لشخصية كرتونية.",
      "تنحذف صورتك الأصلية من خوادمنا مباشرة لحظة ما تعتمد الشخصية.",
      "إذا ما اعتمدت أي شخصية، تنحذف الصورة تلقائيًا خلال ٤٨ ساعة كحد أقصى.",
      "ما نستخدم صورتك لأي غرض ثاني، وما نبيعها ولا نشاركها مع أحد.",
    ],
  },
  {
    title: "معالجة الصورة عند OpenAI",
    body: [
      "تحويل الصورة يتم عن طريق خدمة OpenAI للذكاء الاصطناعي. صورتك تنرسل لهم بشكل آمن لغرض التحويل فقط.",
      "حسب سياسة OpenAI لخدمات الشركات (API): البيانات ما تُستخدم لتدريب نماذجهم، وممكن يحتفظون فيها لمدة أقصاها ٣٠ يوم لأغراض كشف إساءة الاستخدام، وبعدها تنحذف.",
    ],
  },
  {
    title: "اللي نحتفظ فيه",
    body: [
      "اسمك وإيميلك من حساب جوجل، عشان تسجيل الدخول.",
      "الصور الكرتونية المولّدة وملف الكتيب PDF، عشان تقدر ترجع لها من صفحة \"كتيباتي\". هذي صور مرسومة، مو صورتك الأصلية.",
      "كل الملفات محفوظة في تخزين خاص ومقفل، وما أحد يقدر يفتحها غيرك. روابط التحميل مؤقتة وتنتهي بعد ساعة.",
    ],
  },
  {
    title: "صور الأطفال",
    body: [
      "إذا رفعت صورة طفل، فأنت تقرّ إنك ولي أمره أو عندك إذنه.",
      "نطبق على صور الأطفال نفس الحذف الفوري للصورة الأصلية.",
    ],
  },
  {
    title: "حذف حسابك وبياناتك",
    body: [`تقدر تطلب حذف حسابك وكل الصور الكرتونية والكتيبات في أي وقت، براسلنا على ${CONTACT_EMAIL}، ونحذفها خلال ٧ أيام.`],
  },
  {
    title: "الخدمات اللي نستخدمها",
    body: [
      "Supabase لتسجيل الدخول وحفظ البيانات، وVercel لاستضافة الموقع، وOpenAI لتحويل الصور، وGoogle لتسجيل الدخول.",
      "ما نستخدم إعلانات ولا أدوات تتبّع.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <article className="card space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="display text-4xl">سياسة الخصوصية</h1>
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
        لأي سؤال: <a href={`mailto:${CONTACT_EMAIL}`} className="underline" dir="ltr">{CONTACT_EMAIL}</a>
      </p>
    </article>
  );
}
