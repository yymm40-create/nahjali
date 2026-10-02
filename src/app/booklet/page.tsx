import Image from "next/image";
import Link from "next/link";
import { FREE_TRIAL, QUALITY_TIERS } from "@config/pricing";
import { STYLES, type StyleKey } from "@config/styles";

const MIN_PRICE = Math.min(...Object.values(QUALITY_TIERS).map((t) => t.price_halalas)) / 100;
const CTA = FREE_TRIAL ? "جرّب مجانًا ✨" : `ابدأ كتيب طفلك من ${MIN_PRICE} ريال`;

const STEPS = [
  { icon: "📸", title: "ارفع صورة طفلك", text: "صورة واضحة للوجه، وتنحذف فور ما تعتمد الشخصية" },
  { icon: "🎨", title: "اختر الستايل", text: "بيكسار، كرتون، رسم كلاسيكي أو أنمي" },
  { icon: "📖", title: "حمّل كتيبه", text: "كتيب باسمه، فيه شخصيته بكل صفحة، جاهز للطباعة" },
];

const HABITS = [
  "🗺️ خريطة رحلة ٢٨ يوم",
  "💬 شخصيته تكلمه باسمه",
  "🕌 الصلوات الخمس",
  "📖 قراءة القرآن",
  "🪥 الأسنان وترتيب السرير",
  "🌙 النوم والاستيقاظ المبكر",
  "🤍 السلام على صاحب الزمان",
  "✨ صلاة الليل",
  "📚 المذاكرة",
  "✂️ ملصقات بشخصيته",
  "💛 رسالة منكم له",
  "👨‍👩‍👧 ركن الأهل",
];

export default function BookletHome() {
  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="relative -mx-4 overflow-hidden sm:mx-0 sm:rounded-3xl">
        <div className="relative">
          <Image src="/brand/hero.jpg" alt="مرقد أمير المؤمنين علي عليه السلام في النجف الأشرف" width={1600} height={1067} priority className="h-[300px] w-full object-cover" />
          <div className="absolute inset-0" style={{ background: "var(--hero-tint)" }} />
          <h1 className="display absolute inset-x-0 bottom-2 text-center text-[2.6rem] leading-tight text-ink [text-shadow:0_0_18px_var(--page),0_0_6px_var(--page)]">
            طفلك <span className="text-gold">بطل</span> كتيب عاداته
          </h1>
        </div>
        <div className="space-y-4 px-5 pb-2 pt-3 text-center">
          <p className="mx-auto max-w-sm text-lg font-bold text-muted">
            نحوّل صورته لشخصية كرتونية تتعلّم الصلاة والقرآن والعادات الطيبة، في كتيب ملوّن باسمه.
          </p>
          <Link href="/new" className="btn btn-primary w-full text-xl">
            {CTA}
          </Link>
          <div className="flex flex-wrap justify-center gap-2">
            <span className="chip">👦👧 باسم طفلك</span>
            <span className="chip">🎨 ٤ ستايلات</span>
            <span className="chip">🖨️ جاهز للطباعة</span>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="space-y-4">
        <h2 className="display text-3xl">كيف يشتغل؟</h2>
        <ol className="space-y-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="card flex items-center gap-4 p-4">
              <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-surface-2 text-3xl">{s.icon}</span>
              <div>
                <h3 className="text-lg font-extrabold">
                  <span className="text-gold">{i + 1}.</span> {s.title}
                </h3>
                <p className="font-bold text-muted">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Styles */}
      <section className="space-y-4">
        <h2 className="display text-3xl">اختر ستايل طفلك</h2>
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2">
          {(Object.entries(STYLES) as [StyleKey, (typeof STYLES)[StyleKey]][]).map(([key, s]) => (
            <figure key={key} className="card w-60 shrink-0 snap-start overflow-hidden">
              <Image src={`/styles/${key}.jpg`} alt={s.label} width={400} height={400} className="aspect-square w-full object-cover" />
              <figcaption className="p-3">
                <p className="font-extrabold">{s.label}</p>
                <p className="text-sm font-bold text-muted">{s.description}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* Inside the booklet */}
      <section className="card space-y-4 p-5">
        <h2 className="display text-3xl">وش داخل الكتيب؟</h2>
        <p className="font-bold text-muted">١٦ صفحة: شخصية طفلك تعيش كل عادة وتكلّمه باسمه، وهدف أسبوعي «٥ من ٧» بدل الكمال، فإذا فاته يوم ما يخسر، وفي النهاية شهادة تقدير باسمه.</p>
        <div className="flex flex-wrap gap-2">
          {HABITS.map((h) => (
            <span key={h} className="chip">{h}</span>
          ))}
        </div>
      </section>

      {/* Privacy */}
      <section className="card flex items-start gap-4 border-teal/40 p-5">
        <span className="text-4xl">🔒</span>
        <div>
          <h2 className="text-xl font-extrabold">صورة طفلك أمانة</h2>
          <p className="font-bold text-muted">
            الصورة الأصلية تنحذف من خوادمنا فور اعتماد الشخصية، وما نستخدمها لأي شي ثاني.{" "}
            <Link href="/privacy" className="text-teal underline">اقرأ سياسة الخصوصية</Link>
          </p>
        </div>
      </section>

      <Link href="/new" className="btn btn-primary w-full text-xl">
        {CTA}
      </Link>
    </div>
  );
}
