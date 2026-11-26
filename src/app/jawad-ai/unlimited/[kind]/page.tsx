import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { jawadLogin, jawadSession } from "@/lib/jawad/server/access";
import { unlimitedStatus } from "@/lib/jawad/server/unlimited";
import { loadRuntime } from "@/lib/jawad/server/runtime";
import { evaluate, priceTable } from "@/lib/jawad/engine";
import { generatorById } from "@config/jawad/generators";
import { UNLIMITED, UNLIMITED_PASSES, unlimitedEnd, unlimitedPhase, type UnlimitedPass } from "@config/jawad/unlimited";
import BigClock from "../BigClock";
import MyPasses from "../MyPasses";
import PassPicker, { type PickerGroup } from "./PassPicker";

export const dynamic = "force-dynamic";

const KINDS = { video: "video", images: "image" } as const;

export async function generateMetadata({ params }: { params: Promise<{ kind: string }> }): Promise<Metadata> {
  const { kind } = await params;
  return { title: kind === "video" ? "لامحدود فيديو · UNLIMITED" : "لامحدود صور · UNLIMITED" };
}

/**
 * What one generation usually costs on the site (the live price table), for the pass's sample settings: a 15-second video at
 * its quality, or one picture. Null when it cannot be quoted without a reference (the real-face generator needs a photo).
 */
function usualHalalas(p: UnlimitedPass, rt: Awaited<ReturnType<typeof loadRuntime>> | null): number | null {
  const def = generatorById(p.generatorId);
  if (!def) return null;
  try {
    const e = evaluate(def, { settings: p.sample, prompt: "x".repeat(200), instructions: "", refStyle: "none", refs: [] }, rt?.prices[def.id] ?? priceTable(def, undefined));
    return e.price.ok && e.price.coins > 0 ? e.price.coins : null;
  } catch {
    return null;
  }
}

/** «لامحدود»: the generators of one kind; tapping one opens its short terms and the buy button. */
export default async function UnlimitedKindPage({ params, searchParams }: { params: Promise<{ kind: string }>; searchParams: Promise<{ paid?: string; unpaid?: string }> }) {
  const [{ kind: slug }, sp] = await Promise.all([params, searchParams]);
  const kind = KINDS[slug as keyof typeof KINDS];
  if (!kind) notFound();
  const [{ user }, rt] = await Promise.all([jawadSession(), loadRuntime().catch(() => null)]);
  const mine = user ? (await unlimitedStatus(user.id).catch(() => [])).filter((p) => p.kind === kind) : [];
  const phase = unlimitedPhase();
  const here = `${UNLIMITED.path}/${slug}`;

  // one card per generator (and version); a video generator's two qualities are chosen inside its sheet
  const groups: PickerGroup[] = [];
  for (const p of UNLIMITED_PASSES.filter((x) => x.kind === kind)) {
    let g = groups.find((x) => x.name === p.name);
    if (!g) groups.push((g = { name: p.name, line: p.line, best: !!p.best, kind, options: [] }));
    g.best ||= !!p.best;
    g.options.push({ key: p.key, quality: p.quality ?? null, price24: p.price24, usual: usualHalalas(p, rt), running: mine.some((m) => m.pass === p.key) });
  }
  // the qualities from the cheaper up
  for (const g of groups) g.options.sort((a, b) => a.price24 - b.price24);

  return (
    <div className="ul" dir="rtl">
      <header className="ul-hero ul-hero-s">
        <div className="ul-hero-bg" aria-hidden><i /><i /><i /></div>
        <div className="ul-in">
          <Link href={UNLIMITED.path} className="ul-back">→ فيديو أو صور</Link>
          <span className="ul-pill" dir="ltr">⚡ UNLIMITED · {kind === "video" ? "VIDEO" : "IMAGES"}</span>
          <h1 className="ul-h1 ul-h1-s">{kind === "video" ? "فيديو بلا حدود" : "صور بلا حدود"}</h1>
          <p className="ul-sub">اختر المولّد، {kind === "video" ? "والدقة، " : ""}والمدة. والأفضل معلّم لك.</p>
          {phase === "open" && <BigClock to={unlimitedEnd()} label="العرض يختفي بعد" />}
        </div>
      </header>

      {sp.paid && <p className="ul-ok">تم الدفع ✓ لامحدودك شغّال الحين.</p>}
      {sp.unpaid && <p className="ul-err">ما وصلنا الدفع. إذا انخصم منك، تواصل معنا ونضبطها لك.</p>}
      {mine.length > 0 && <MyPasses passes={mine} />}

      <section className="ul-in ul-list">
        <PassPicker groups={groups} login={user ? null : jawadLogin(here)} open={phase === "open"} fast={UNLIMITED.fast[kind]} maxVideoSec={UNLIMITED.maxVideoSec} />
      </section>
    </div>
  );
}
