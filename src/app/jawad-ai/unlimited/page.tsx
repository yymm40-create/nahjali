import type { Metadata } from "next";
import Riyal from "@/components/Riyal";
import Link from "next/link";
import { jawadSession } from "@/lib/jawad/server/access";
import { unlimitedStatus } from "@/lib/jawad/server/unlimited";
import { UNLIMITED, UNLIMITED_PASSES, unlimitedEnd, unlimitedPhase, unlimitedStart } from "@config/jawad/unlimited";
import BigClock from "./BigClock";
import MyPasses from "./MyPasses";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "لامحدود · UNLIMITED · فيديو وصور بلا حدود يوم كامل",
  description: "اختر مولّدك واستخدمه بلا حدود ٢٤ ساعة: Seedance 2.5 وSeedance 2.0 وWan 3.0 والوجه الواقعي، وGPT Image 2.6 وGPT Image 2 وNano Banana Pro. يبدأ من ١٩ ريال، لمدة ٧٢ ساعة بس.",
};

/** «لامحدود» (config/jawad/unlimited.ts): first the choice — video or pictures — then that kind's generators. */
export default async function UnlimitedPage({ searchParams }: { searchParams: Promise<{ paid?: string; unpaid?: string }> }) {
  const sp = await searchParams;
  const { user } = await jawadSession();
  const mine = user ? await unlimitedStatus(user.id).catch(() => []) : [];
  const phase = unlimitedPhase();
  const minOf = (k: "video" | "image") => Math.min(...UNLIMITED_PASSES.filter((p) => p.kind === k).map((p) => p.price24));
  return (
    <div className="ul" dir="rtl">
      <header className="ul-hero">
        <div className="ul-hero-bg" aria-hidden><i /><i /><i /></div>
        <div className="ul-in">
          <span className="ul-pill" dir="ltr">⚡ UNLIMITED · 72H ONLY</span>
          <h1 className="ul-h1">
            ولّد <span className="ul-hl">بلا حدود</span>
            <br />
            يوم كامل
          </h1>
          <p className="ul-sub">اختر مولّدك، وولّد فيه قد ما تبي ٢٤ ساعة. بدون نقاط، بدون عدّ، بدون ما تفكر بالرصيد.</p>
          {phase === "open" && <BigClock to={unlimitedEnd()} label="العرض يختفي بعد" />}
          {phase === "before" && <BigClock to={unlimitedStart()} label="يبدأ العرض بعد" />}
          {phase === "over" && <p className="ul-over">انتهى وقت العرض. اللي اشترى يكمل لامحدوده لين تخلص مدته.</p>}
        </div>
      </header>

      {sp.paid && <p className="ul-ok">تم الدفع ✓ لامحدودك شغّال الحين.</p>}
      {sp.unpaid && <p className="ul-err">ما وصلنا الدفع. إذا انخصم منك، تواصل معنا ونضبطها لك.</p>}
      {mine.length > 0 && <MyPasses passes={mine} />}

      <section className="ul-in ul-pick" aria-label="وش تبي تولّد؟">
        <h2 className="ul-h2">وش تبي تولّد؟</h2>
        <div className="ul-two">
          <Link href={`${UNLIMITED.path}/video`} className="ul-big ul-big-v">
            <span className="ul-big-ic" aria-hidden>🎬</span>
            <b>فيديو</b>
            <span>Seedance 2.5 · Seedance 2.0 · Wan 3.0 · وجهك الواقعي</span>
            <em>من <Riyal halalas={minOf("video") * 100} size={14} /></em>
            <span className="ul-big-go">اختر مولّد الفيديو ←</span>
          </Link>
          <Link href={`${UNLIMITED.path}/images`} className="ul-big ul-big-i">
            <span className="ul-big-ic" aria-hidden>🖼️</span>
            <b>صور</b>
            <span>GPT Image 2.6 · GPT Image 2 · Nano Banana Pro</span>
            <em>من <Riyal halalas={minOf("image") * 100} size={14} /></em>
            <span className="ul-big-go">اختر مولّد الصور ←</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
