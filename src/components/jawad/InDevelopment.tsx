import Image from "next/image";
import { JAWAD } from "@config/jawad/brand";
import Icon from "./Icon";

const COMING = [
  { icon: "image", title: "صناعة الصور", text: "تكتب وصفًا بالعربي أو الإنجليزي، أو ترفع صورًا مرجعية، ويصنع لك صورًا بالنسبة والدقة التي تختارها." },
  { icon: "video", title: "صناعة الفيديو", text: "فيديو من النص، أو من صورة البداية والنهاية، أو من مراجع متعددة، بالأفقي أو العمودي ومع صوت متزامن." },
  { icon: "film", title: "الفيلم السينمائي خطوة بخطوة", text: "من الفكرة إلى السيناريو والشخصيات والمشاهد والمقاطع، بمراحل واضحة توافق على كل واحدة منها." },
  { icon: "audio", title: "صناعة الصوت", text: "كلام منطوق بأصوات مختلفة، وتكتب وصف الأداء منفصلًا: هادئ، حماسي، بطيء…" },
] as const;

/** What everyone except the owner (and invited emails) sees while JAWAD AI is being built. */
export default function InDevelopment({ logoUrl, customLogo }: { logoUrl: string; customLogo: boolean }) {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 pb-16 pt-10">
      <section className="jw-panel flex flex-col items-center gap-4 p-6 text-center sm:p-10">
        <Image src={logoUrl} alt="" width={96} height={96} unoptimized={customLogo} className="size-24 rounded-full" priority />
        <span className="jw-chip border-jw-warn/50 text-jw-warn">
          <Icon name="clock" size={14} /> قيد التطوير
        </span>
        <h1 className="text-2xl font-bold sm:text-3xl">
          <span dir="ltr">{JAWAD.nameEn}</span> · {JAWAD.nameAr}
        </h1>
        <p className="max-w-xl text-jw-muted">
          منصة ذكاء اصطناعي لصناعة الصور والفيديو والصوت والأفلام، نجهّزها ونختبرها الآن قبل فتحها للجميع. تابعنا، ونعلن عنها هنا أول ما تجهز.
        </p>
      </section>

      <details className="jw-panel group p-5" open>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-semibold">
          وش راح تقدر تسوي فيها؟
          <Icon name="chevronDown" size={16} className="transition group-open:rotate-180" />
        </summary>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {COMING.map((c) => (
            <li key={c.title} className="rounded-xl border border-jw-line bg-jw-bg-2 p-4">
              <p className="mb-1 flex items-center gap-2 font-medium">
                <Icon name={c.icon} size={16} className="text-jw-accent" /> {c.title}
              </p>
              <p className="text-sm text-jw-muted">{c.text}</p>
            </li>
          ))}
        </ul>
      </details>

      <details className="jw-panel group p-5">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-semibold">
          كيف بتشتغل؟
          <Icon name="chevronDown" size={16} className="transition group-open:rotate-180" />
        </summary>
        <ul className="mt-3 list-disc space-y-1.5 ps-5 text-sm text-jw-muted">
          <li>تدخل بنفس حسابك في الموقع.</li>
          <li>كل عملية توليد تُدفع بالنقود الذكية، وتشوف سعرها على زر «توليد» قبل ما تضغط.</li>
          <li>إذا فشل التوليد يرجع لك رصيدك تلقائيًا.</li>
          <li>أعمالك محفوظة في حسابك وخاصة بك، وتقدر تنزّلها أو تعيد استخدام إعداداتها.</li>
        </ul>
      </details>
    </div>
  );
}
