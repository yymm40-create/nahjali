import Link from "next/link";
import { listAllUsers } from "@/lib/supabase/admin";
import { requireJawadOwnerPage } from "@/lib/jawad/server/access";
import { unlimitedRoom, type RoomPerson } from "@/lib/jawad/server/unlimited";
import { stageLabel } from "@/lib/jawad/labels";
import { generatorById } from "@config/jawad/generators";
import { unlimitedEnd, unlimitedPhase } from "@config/jawad/unlimited";
import Riyal from "@/components/Riyal";
import Refresh from "./Refresh";
import { AddMinutes, Refund } from "./RoomActions";

export const metadata = { title: "غرفة متابعة اللامحدود" };
export const dynamic = "force-dynamic";

const when = (iso: string) => new Date(iso).toLocaleString("ar-SA-u-ca-gregory-nu-latn", { timeZone: "Asia/Riyadh", weekday: "short", hour: "numeric", minute: "2-digit" });
/** The server's clock for this render. */
const nowMs = () => Date.now();
const mins = (iso: string, now: number) => Math.max(1, Math.ceil((Date.parse(iso) - now) / 60_000));

function NowChip({ p, now }: { p: RoomPerson; now: number }) {
  if (p.now.state === "held") return <span className="jw-chip text-amber-500">⏳ ينتظر {p.now.until ? `${mins(p.now.until, now)} د` : ""} ({p.now.count})</span>;
  if (p.now.state === "working") return <span className="jw-chip text-jw-accent">⚡ يولّد الحين ({p.now.count})</span>;
  return <span className="jw-chip text-jw-muted">ساكت</span>;
}

/** «لامحدود»: everyone who bought a pass, what they made with it, how many times, and what is happening for them right now. */
export default async function UnlimitedRoom() {
  await requireJawadOwnerPage("/jawad-ai/admin/unlimited");
  const users = await listAllUsers();
  const people = await unlimitedRoom(new Map(users.map((u) => [u.id, u.email ?? u.id])));
  const now = nowMs();
  const passes = people.flatMap((p) => p.passes);
  const active = passes.filter((x) => x.active);
  const sar = passes.reduce((n, x) => n + x.priceSar, 0);
  const made = passes.reduce((n, x) => n + x.made, 0);
  const waiting = people.filter((p) => p.now.state === "held").length;
  const working = people.filter((p) => p.now.state === "working").length;
  // the thing to watch: wallet money taken from subscribers on their pass's generator (meant to be free?)
  const leaked = people.reduce((n, p) => n + p.paid.filter((j) => j.onPassGenerator && !["failed", "cancelled"].includes(j.status)).reduce((m, j) => m + j.coins, 0), 0);
  const phase = unlimitedPhase(now);

  return (
    <div className="space-y-5">
      <Refresh />
      <section className="jw-panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold">⚡ غرفة متابعة اللامحدود</h2>
            <p className="text-xs text-jw-muted">
              {phase === "open" ? `العرض شغّال لين ${when(new Date(unlimitedEnd()).toISOString())}` : phase === "before" ? "العرض ما بدأ" : "انتهى وقت البيع"} · تتحدث كل ٣٠ ثانية
            </p>
          </div>
          <Link href="/jawad-ai/unlimited" className="jw-btn text-xs">صفحة العرض ←</Link>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-7">
          {[
            ["المشتركين", people.length],
            ["لامحدود شغّال", active.length],
            ["الدخل", null],
            ["توليدات", made],
            ["يولّدون الحين", working],
            ["ينتظرون (بطيء)", waiting],
            ["⚠️ انخصم على مولّد اشتراكهم", `${(leaked / 100).toLocaleString("en", { maximumFractionDigits: 2 })} ر`],
          ].map(([l, v]) => (
            <div key={String(l)} className="rounded-lg bg-jw-surface-2 p-3">
              <p className="text-2xl font-bold tabular-nums">{v === null ? <Riyal halalas={sar * 100} size={18} /> : v}</p>
              <p className="text-xs text-jw-muted">{l}</p>
            </div>
          ))}
        </div>
      </section>

      {people.length === 0 && <p className="jw-panel p-6 text-center text-sm text-jw-muted">ما أحد اشترك للحين.</p>}

      <section className="space-y-2">
        {people.map((p) => (
          <details key={p.userId} className="jw-panel p-3">
            <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-sm">
              <NowChip p={p} now={now} />
              <b dir="ltr">{p.email}</b>
              <span className="text-xs text-jw-muted">
                {p.passes.map((x) => `${x.name}${x.quality ? ` ${x.quality}` : ""} · ${x.hours}س${x.active ? "" : " (انتهى)"}`).join(" ، ")}
              </span>
              {p.paid.some((j) => j.onPassGenerator && !["failed", "cancelled"].includes(j.status)) && <span className="jw-chip text-jw-danger">⚠️ انخصم منه على مولّد اشتراكه</span>}
              <span className="ms-auto flex items-center gap-3 text-xs tabular-nums">
                <span className="text-jw-muted">الرصيد {p.balance == null ? "—" : <Riyal halalas={p.balance} size={11} />}</span>
                <span>{p.passes.reduce((n, x) => n + x.made, 0)} توليد</span>
                {p.lastAt && <span className="text-jw-muted">آخر توليد {when(p.lastAt)}</span>}
                <Riyal halalas={p.spentSar * 100} size={12} />
              </span>
            </summary>
            <div className="mt-3 space-y-3">
              {p.passes.map((x) => (
                <div key={x.paidAt} className="rounded-lg border border-jw-line p-3 text-xs">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <b className="text-sm" dir="ltr">{x.name}{x.quality ? ` · ${x.quality}` : ""}</b>
                    <span className={x.active ? "text-jw-ok" : "text-jw-muted"}>{x.active ? `شغّال لين ${when(x.until)}` : `انتهى ${when(x.until)}`}</span>
                    <span>اشترى {when(x.paidAt)} · {x.hours} ساعة · <Riyal halalas={x.priceSar * 100} size={11} /></span>
                    <span>صنع <b>{x.made}</b> مرة · {x.kind === "video" ? `${x.units} ثانية فيديو` : `${x.units} صورة`}{x.failed ? ` · ${x.failed} فشلت` : ""}</span>
                    {x.active && <span>السريع: باقي <b>{x.fastLeft}</b> من {x.fastCap} {x.kind === "video" ? "ث" : "صورة"} · بطيء هالدورة: {x.slowInCycle}</span>}
                    {x.bonusMin > 0 && <span className="text-amber-500">⏱️ مضاف {x.bonusMin} د</span>}
                    <span className={x.telegram ? "text-jw-ok" : "text-jw-muted"}>{x.telegram ? "✈️ وصلك تليغرام" : "✈️ بدون تليغرام"}</span>
                    <span className="text-jw-faint" dir="ltr">{x.paymentId.slice(0, 8)}…</span>
                    <AddMinutes userId={p.userId} paymentId={x.paymentId} />
                  </div>
                  {x.jobs.length > 0 && (
                    <ul className="mt-2 divide-y divide-jw-line">
                      {x.jobs.slice(0, 40).map((j) => (
                        <li key={j.id} className="flex flex-wrap items-center gap-2 py-1.5">
                          <span className={`jw-chip ${j.status === "failed" ? "text-jw-danger" : j.status === "succeeded" ? "text-jw-ok" : ""}`}>
                            {j.status === "queued" && j.holdUntil && Date.parse(j.holdUntil) > now ? `⏳ ينتظر ${mins(j.holdUntil, now)} د` : stageLabel(j.status as never, null)}
                          </span>
                          <span className={j.fast ? "text-jw-accent" : "text-amber-500"}>{j.fast ? "سريع" : "بطيء"}</span>
                          <span dir="ltr" className="text-jw-muted">{generatorById(j.generatorId)?.name ?? j.generatorId} · {j.units}{x.kind === "video" ? "s" : ""}</span>
                          <span className="text-jw-muted">{when(j.createdAt)}</span>
                          <span className="min-w-0 flex-1 truncate">{j.prompt || "—"}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
              <div className="rounded-lg border border-jw-line p-3 text-xs">
                <b className="text-sm">💳 اللي انخصم من رصيده وهو مشترك</b>
                {p.paid.length === 0 ? (
                  <p className="mt-1 text-jw-muted">ولا شي ✓</p>
                ) : (
                  <ul className="mt-2 divide-y divide-jw-line">
                    {p.paid.slice(0, 40).map((j) => (
                      <li key={j.id} className={`flex flex-wrap items-center gap-2 py-1.5 ${j.onPassGenerator ? "text-jw-danger" : ""}`}>
                        <span>{j.onPassGenerator ? "⚠️ مولّد اشتراكه، برا الشروط" : "مولّد ثاني"}</span>
                        <span dir="ltr">{generatorById(j.generatorId)?.name ?? j.generatorId}{j.quality ? ` · ${j.quality}` : ""}{j.seconds ? ` · ${j.seconds}s` : ""}</span>
                        <Riyal halalas={j.coins} size={11} />
                        <span className="text-jw-muted">{["failed", "cancelled"].includes(j.status) ? "فشل (رجع له)" : ""} {when(j.at)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {p.grants.length > 0 && (
                  <div className="mt-2 border-t border-jw-line pt-2">
                    <b>↩️ اللي رجعناه له</b>
                    <ul className="mt-1 space-y-0.5">
                      {p.grants.map((g, i) => (
                        <li key={i} className="flex flex-wrap items-center gap-2"><Riyal halalas={g.coins} size={11} /><span>{g.label}</span><span className="text-jw-muted">{when(g.at)}</span></li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="mt-2 border-t border-jw-line pt-2">
                  <Refund userId={p.userId} suggest={Math.max(0, Math.round((p.paid.filter((j) => j.onPassGenerator && !["failed", "cancelled"].includes(j.status)).reduce((n, j) => n + j.coins, 0) - p.grants.reduce((n, g) => n + Math.max(0, g.coins), 0)) / 100 * 100) / 100)} />
                </div>
              </div>
            </div>
          </details>
        ))}
      </section>
    </div>
  );
}
