import Link from "next/link";
import { fmtSar } from "@config/coins";
import { computeProfit } from "@/lib/profit";
import LiveRefresh from "../LiveRefresh";

export const metadata = { title: "صافي الربح · لوحة التحكم" };
export const dynamic = "force-dynamic";

const RANGES = [
  { id: "all", label: "من البداية", days: null },
  { id: "month", label: "هذا الشهر", days: "month" },
  { id: "30", label: "آخر ٣٠ يوم", days: 30 },
  { id: "7", label: "آخر ٧ أيام", days: 7 },
  { id: "1", label: "اليوم", days: 1 },
] as const;

/** The start of a range (Saudi time for «هذا الشهر»). */
function sinceOf(days: (typeof RANGES)[number]["days"]): string | null {
  if (days === null) return null;
  if (days === "month") {
    const now = new Date(Date.now() + 3 * 3600_000);
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) - 3 * 3600_000).toISOString();
  }
  return new Date(Date.now() - days * 86400_000).toISOString();
}

/** Riyals, two decimals at most: «1,250.50 ر.س». */
const sar = (halalas: number) => `${fmtSar(Math.round(halalas))} ر.س`;

function Card({ title, value, note, tone = "" }: { title: string; value: string; note?: string; tone?: "good" | "bad" | "" }) {
  return (
    <div className={`card space-y-1 p-4 ${tone === "good" ? "ring-2 ring-emerald-500/50" : tone === "bad" ? "ring-2 ring-red-500/50" : ""}`}>
      <p className="text-sm font-bold text-muted">{title}</p>
      <p className={`display text-3xl ${tone === "good" ? "text-emerald-600" : tone === "bad" ? "text-red-600" : ""}`} dir="ltr" style={{ textAlign: "right" }}>
        {value}
      </p>
      {note && <p className="text-xs font-bold text-muted">{note}</p>}
    </div>
  );
}

/**
 * The owner's net profit: money in (top-ups by bank transfer, courses) minus what everyone's use really cost (the
 * providers' prices), the owners' own use included and shown on its own.
 */
export default async function ProfitPage({ searchParams }: { searchParams: Promise<{ r?: string }> }) {
  const { r } = await searchParams;
  const range = RANGES.find((x) => x.id === r) ?? RANGES[0];
  const p = await computeProfit(sinceOf(range.days));
  const totalCost = p.peopleCost + p.ownersCost;

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="display text-3xl">📈 صافي الربح</h1>
        <p className="font-bold text-muted">
          الفلوس اللي دخلت (شحن الرصيد والدورات) ناقص تكلفة استخدام الناس الحقيقية (اللي ندفعها لمزودي الذكاء الاصطناعي)، وناقص تكلفة استخدامك أنت.
        </p>
        <LiveRefresh seconds={60} />
      </header>

      <nav className="flex flex-wrap gap-2">
        {RANGES.map((x) => (
          <Link key={x.id} href={`/admin/profit?r=${x.id}`} className={`chip ${x.id === range.id ? "bg-gold text-on-gold" : ""}`}>
            {x.label}
          </Link>
        ))}
      </nav>

      <Card
        title="💰 صافي ربحك"
        value={sar(p.net)}
        tone={p.net >= 0 ? "good" : "bad"}
        note={`= الدخل ${sar(p.income)} − تكلفة استخدام الناس ${sar(p.peopleCost)} − تكلفة استخدامك ${sar(p.ownersCost)}`}
      />

      <section className="grid gap-3 sm:grid-cols-2">
        <Card title="⬇️ الدخل كله" value={sar(p.income)} note="التحويلات اللي أكدتها فقط" />
        <Card title="⬆️ التكلفة كلها" value={sar(totalCost)} note="اللي ندفعه للمزودين (Claude، OpenAI، Seedance، ElevenLabs…)" />
        <Card title="💳 شحن الرصيد" value={sar(p.topups)} note={`${p.topupsCount.toLocaleString("en")} تحويل · أعطيناهم رصيد ${sar(p.topupsCredit)}`} />
        <Card title="🎓 الدورات" value={sar(p.courses)} note={`${p.coursesCount.toLocaleString("en")} شراء`} />
        <Card title="👥 تكلفة استخدام الناس" value={sar(p.peopleCost)} note={`خصمنا منهم مقابلها ${sar(p.charged)} من رصيدهم (بما فيه الهدايا والأكواد المجانية)`} />
        <Card title="🧑‍💼 تكلفة استخدامك أنت" value={sar(p.ownersCost)} note="استخدامك بإيميلك (والرئيس المشارك) — مجاني لك لكنه يكلّف الموقع" />
      </section>

      {p.owners.length > 0 && (
        <section className="card space-y-2 p-4">
          <h2 className="text-lg font-extrabold">🧑‍💼 استخدام أصحاب الموقع</h2>
          <ul className="space-y-1 text-sm">
            {p.owners.map((o) => (
              <li key={o.email} className="flex justify-between gap-3">
                <span className="break-all font-bold" dir="ltr">{o.email}</span>
                <span className="whitespace-nowrap font-bold">{sar(o.cost)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted">
              <th className="p-3 text-start">الفرع</th>
              <th className="p-3 text-start">تكلفة الناس</th>
              <th className="p-3 text-start">تكلفتك</th>
              <th className="p-3 text-start">خصمنا من رصيدهم</th>
            </tr>
          </thead>
          <tbody>
            {p.branches.map((b) => (
              <tr key={b.branch} className="border-t border-line">
                <td className="p-3 font-bold">{b.branch}</td>
                <td className="p-3 whitespace-nowrap">{sar(b.people)}</td>
                <td className="p-3 whitespace-nowrap">{sar(b.owners)}</td>
                <td className="p-3 whitespace-nowrap">{sar(b.charged)}</td>
              </tr>
            ))}
            {!p.branches.length && (
              <tr>
                <td colSpan={4} className="p-5 text-center text-muted">ما فيه استخدام في هذي الفترة.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <section className="card space-y-2 p-4 text-sm font-bold text-muted">
        <p>
          🏦 رصيد باقي عند الناس ما استخدموه للحين: <span className="text-ink">{sar(p.unusedBalance)}</span> — فلوسه دخلت (إذا كان شحن)، لكن لما يستخدمونه
          بتطلع تكلفته من الربح.
        </p>
        {p.estimated > 0 && (
          <p>
            📐 منها {sar(p.estimated)} تكلفة تقديرية: عمليات قبل ما يبدأ تسجيل التكلفة الحقيقية لكل عملية، حسبناها من اللي انخصم عليها ونسبة الربح وقتها.
          </p>
        )}
        <p>
          {p.recordingSince
            ? `✅ التكلفة الحقيقية لكل عملية تنسجل من ${new Date(p.recordingSince).toLocaleDateString("ar-SA", { timeZone: "Asia/Riyadh", dateStyle: "medium" })}.`
            : "⚠️ تسجيل التكلفة الحقيقية لكل عملية ما بدأ للحين (شغّل ملف SQL رقم 0090). لين ذاك الوقت الأرقام تقديرية من اللي انخصم من رصيد الناس."}
        </p>
      </section>
    </div>
  );
}
