import Image from "next/image";
import Link from "next/link";
import { PRICE_HALALAS } from "@config/pricing";

const STEPS = [
  { n: "١", title: "ارفع صورتك", text: "صورة واضحة للوجه والجسم", color: "bg-sun" },
  { n: "٢", title: "اعتمد شخصيتك", text: "نحوّلك لشخصية كرتونية ثلاثية الأبعاد", color: "bg-mint" },
  { n: "٣", title: "حمّل كتيبك", text: "PDF جاهز للطباعة فيه شخصيتك بكل صفحة", color: "bg-bubble" },
];

const PREVIEW_PAGES = ["01", "02", "03", "06"];

export default function Home() {
  return (
    <div className="space-y-10">
      <section className="card relative overflow-hidden bg-grape p-6 text-center text-white">
        <span className="chip bg-white text-ink">كتيب عادات بشخصيتك أنت</span>
        <h1 className="display mt-4 text-5xl [-webkit-text-stroke:2px_var(--color-ink)] [paint-order:stroke_fill] drop-shadow-[4px_4px_0_var(--color-ink)]">
          صورتك تصير بطل كتيب عاداتك
        </h1>
        <p className="mt-4 text-lg font-bold">
          ارفع صورتك، ونحوّلها لشخصية كرتونية تمارس العادات اليومية في كتيب ملوّن جاهز للطباعة.
        </p>
        <Link href="/new" className="btn btn-sun mt-6 w-full text-xl">
          ابدأ كتيبك ← {PRICE_HALALAS / 100} ريال
        </Link>
      </section>

      <section className="space-y-4">
        <h2 className="display text-3xl">كيف يشتغل؟</h2>
        {STEPS.map((s) => (
          <div key={s.n} className="card flex items-center gap-4 p-4">
            <span className={`display grid size-12 shrink-0 place-items-center rounded-full border-[3px] border-ink text-2xl ${s.color}`}>
              {s.n}
            </span>
            <div>
              <h3 className="text-xl font-extrabold">{s.title}</h3>
              <p className="text-ink/70">{s.text}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-4">
        <h2 className="display text-3xl">من صفحات الكتيب</h2>
        <p className="font-bold text-ink/70">٧ صفحات: غلاف، القراءة، الصلاة، الأكل، الرياضة، النوم، وشهادة إنجاز. شخصيتك تظهر في الأماكن الفاضية.</p>
        <div className="grid grid-cols-2 gap-4">
          {PREVIEW_PAGES.map((n, i) => (
            <Image
              key={n}
              src={`/templates/habits-v1/page-${n}.jpg`}
              alt={`صفحة ${i + 1} من الكتيب`}
              width={700}
              height={993}
              className={`card w-full p-0 ${i % 2 ? "rotate-2" : "-rotate-2"}`}
            />
          ))}
        </div>
      </section>

      <Link href="/new" className="btn btn-primary w-full text-xl">
        يلا نبدأ
      </Link>
    </div>
  );
}
