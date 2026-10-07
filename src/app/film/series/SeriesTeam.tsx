"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { postJson } from "@/lib/fetch";
import { useFilmBase } from "../FilmBase";
import { rightsText, TEAM_STAGES } from "@/lib/film/team-rights";

const STAGES = TEAM_STAGES;

type Member = { userId: string; username: string | null; stages: string[] | null; maxAttempts: number | null; usedAttempts: number };

export default function SeriesTeam({ seriesId, owner, mode, members, mine }: { seriesId: string; owner: boolean; mode: "solo" | "team"; members: Member[]; mine?: Omit<Member, "userId" | "username"> | null }) {
  const router = useRouter();
  const base = useFilmBase();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const send = async (body: Record<string, unknown>, done?: string) => {
    setBusy(true);
    setError("");
    setMsg("");
    try {
      await postJson(`/api/film/series/${seriesId}`, body);
      if (done) setMsg(done);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!owner) {
    return (
      <section className="card space-y-2 p-4">
        <h2 className="text-lg font-extrabold">👥 الفريق</h2>
        {mine && <p className="rounded-xl bg-surface-2 p-3 text-sm font-bold">صلاحياتك من صاحب المسلسل: {rightsText(mine)}</p>}
        <button
          type="button"
          className="btn btn-ghost w-full"
          disabled={busy}
          onClick={async () => {
            if (!window.confirm("تطلع من فريق هذا المسلسل؟ ما راح تقدر تفتح مشاهده بعدها.")) return;
            await send({ action: "leave" });
            router.push(`${base}/series`);
          }}
        >
          اطلع من الفريق
        </button>
        {error && <p className="error-box text-sm">{error}</p>}
      </section>
    );
  }
  return (
    <section className="card space-y-3 p-4">
      <h2 className="text-lg font-extrabold">فردي أو فريق</h2>
      <div className="grid grid-cols-2 gap-2">
        {(["solo", "team"] as const).map((m) => (
          <button key={m} type="button" className={`btn min-h-12 ${mode === m ? "btn-secondary" : "btn-ghost"}`} aria-pressed={mode === m} disabled={busy} onClick={() => mode !== m && send({ action: "mode", mode: m })}>
            {m === "solo" ? "👤 فردي" : "👥 فريق"}
          </button>
        ))}
      </div>
      {mode === "solo" ? (
        <p className="text-sm font-bold text-muted">أنت وحدك تشتغل على المسلسل.{members.length ? ` (فريقك المحفوظ: ${members.length}، يرجعون لما تحوّل لوضع الفريق.)` : ""}</p>
      ) : (
        <>
          <p className="text-sm font-bold text-muted">اللي تضيفهم يفتحون مشاهد المسلسل ويشتغلون عليها بالصلاحيات اللي تعطيهم إياها (🔑)، وكل شي ينصنع ينقص من «نقود الفريق الذكي».</p>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) void send({ action: "add_member", username: name.trim() }, `أضفنا @${name.trim().replace(/^@/, "")} للفريق ✅`).then(() => setName(""));
            }}
          >
            <input className="field flex-1" dir="ltr" placeholder="@اسم_المستخدم" maxLength={30} value={name} onChange={(e) => setName(e.target.value)} />
            <button className="btn btn-primary min-h-11 px-4" disabled={busy || !name.trim()}>أضف</button>
          </form>
          {members.length > 0 ? (
            <ul className="space-y-1">
              {members.map((m) => (
                <MemberRow key={m.userId} m={m} busy={busy} send={send} />
              ))}
            </ul>
          ) : (
            <p className="text-xs font-bold text-muted">ما أضفت أحد بعد.</p>
          )}
        </>
      )}
      {msg && <p className="text-sm font-bold text-teal">{msg}</p>}
      {error && <p className="error-box text-sm">{error}</p>}
    </section>
  );
}

/** One member: their rights in a line, opened to change the steps and the attempts, or remove them. */
function MemberRow({ m, busy, send }: { m: Member; busy: boolean; send: (b: Record<string, unknown>, done?: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [stages, setStages] = useState<string[]>(m.stages ?? STAGES.map((s) => s.key as string));
  const [max, setMax] = useState(m.maxAttempts === null ? "" : String(m.maxAttempts));
  const name = `@${m.username ?? "؟"}`;
  return (
    <li className="space-y-2 rounded-xl bg-surface-2 px-3 py-2 text-sm font-bold">
      <div className="flex items-center justify-between gap-2">
        <button type="button" className="min-w-0 text-start" onClick={() => setOpen(!open)} aria-expanded={open}>
          <bdi dir="ltr" className="block">{name}</bdi>
          <span className="block truncate text-xs text-muted">{rightsText(m)}</span>
        </button>
        <span className="flex shrink-0 gap-2 text-xs">
          <button type="button" className="underline" onClick={() => setOpen(!open)}>{open ? "إغلاق" : "🔑 الصلاحيات"}</button>
          <button type="button" className="underline" disabled={busy} onClick={() => window.confirm(`تشيل ${name} من الفريق؟`) && send({ action: "remove_member", userId: m.userId })}>شيله</button>
        </span>
      </div>
      {open && (
        <div className="space-y-2 rounded-xl border border-line bg-white/70 p-2">
          <p className="text-xs text-muted">وش يقدر يشتغل عليه؟</p>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {STAGES.map((st) => {
              const on = stages.includes(st.key);
              return (
                <button key={st.key} type="button" aria-pressed={on} className={`flex items-center gap-2 rounded-xl border-2 px-2 py-2 text-start text-xs ${on ? "border-[#e2a72c] bg-[#e2a72c]/15" : "border-line opacity-70"}`} onClick={() => setStages(on ? stages.filter((k) => k !== st.key) : [...stages, st.key])}>
                  <span className="text-lg" aria-hidden>{st.icon}</span>
                  <span className="flex-1">{st.label}</span>
                  <span aria-hidden>{on ? "✅" : "⛔"}</span>
                </button>
              );
            })}
          </div>
          <label className="flex flex-wrap items-center gap-2 text-xs">
            <span>عدد المحاولات (كل رد أو صورة أو فيديو أو صوت يصنعه):</span>
            <input className="field w-24 text-center" inputMode="numeric" dir="ltr" placeholder="بلا حد" value={max} onChange={(e) => setMax(e.target.value.replace(/[^\d]/g, "").slice(0, 6))} />
            <span className="text-muted">استخدم {m.usedAttempts}</span>
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary min-h-10 flex-1 text-sm" disabled={busy} onClick={() => send({ action: "member_rights", userId: m.userId, stages, maxAttempts: max }, `حفظنا صلاحيات ${name} ✅`).then(() => setOpen(false))}>
              احفظ الصلاحيات
            </button>
            {m.usedAttempts > 0 && (
              <button type="button" className="btn btn-ghost min-h-10 text-xs" disabled={busy} onClick={() => send({ action: "member_rights", userId: m.userId, stages, maxAttempts: max, reset: true }, `بدأنا عدّ محاولات ${name} من جديد ✅`)}>
                ↺ صفّر المحاولات
              </button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
