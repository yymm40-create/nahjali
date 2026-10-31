"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { RACE_BANNED, RACE_RULES, RACE_SURPRISES } from "@config/mahdi-race";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import { shrinkImage } from "@/lib/mahdi/client/reading";
import { useMahdi } from "@/components/mahdi/Provider";
import type { RaceTeam } from "@/lib/mahdi/race";
import RaceTools, { RaceLog, type ToolRound } from "./RaceTools";

interface Player {
  id: string;
  name: string;
  sv: number;
  team: RaceTeam | null;
  kid: boolean;
  spy?: boolean;
  missions?: string[];
}
interface Round extends ToolRound {
  icon: string;
  how: string;
  tools: string;
  pts: string;
  water: boolean;
  done: boolean;
}
interface View {
  race: { id: string; title: string; code: string; teamA: string; teamB: string; emojiA: string; emojiB: string; banned: string; currentRound: string | null; spiesOn: boolean; revealed: boolean; winner: RaceTeam | "tie" | null };
  isOwner: boolean;
  scores: Record<RaceTeam, number>;
  players: Player[];
  me: { id: string; name: string; sv: number; team: RaceTeam | null; spy: boolean; missions: string[] } | null;
  rounds: Round[];
  points: { id: string; team: RaceTeam; points: number; reason: string }[];
}

const TEAM_BG: Record<RaceTeam, string> = { a: "#F5C542", b: "#46C971" };
const TEAMS = ["a", "b"] as const;

function Face({ raceId, p, size = 48 }: { raceId: string; p: { id: string; name: string; sv: number }; size?: number }) {
  const box = { width: size, height: size, borderRadius: "50%", flex: "none" } as const;
  if (!p.sv)
    return (
      <span className="m-chip flex items-center justify-center font-bold" style={box} aria-hidden>
        {p.name.slice(0, 1)}
      </span>
    );
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/api/mahdi/race/${raceId}/selfie?u=${p.id}&v=${p.sv}`} alt="" style={{ ...box, objectFit: "cover" }} />;
}

/** Hold to read, release to hide: a secret never stays on the screen. */
function Hold({ label, kind, children }: { label: string; kind: string; children: React.ReactNode }) {
  const log = useContext(RaceLog);
  const [on, setOn] = useState(false);
  return (
    <button
      type="button"
      className="m-card flex min-h-28 w-full flex-col items-center justify-center gap-2 p-4 text-center font-bold"
      style={{ touchAction: "none", userSelect: "none", WebkitUserSelect: "none" }}
      onPointerDown={() => {
        log(kind);
        setOn(true);
      }}
      onPointerUp={() => setOn(false)}
      onPointerLeave={() => setOn(false)}
      onPointerCancel={() => setOn(false)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {on ? children : label}
    </button>
  );
}

function Board({ v }: { v: View }) {
  const names = { a: `${v.race.emojiA} ${v.race.teamA}`, b: `${v.race.emojiB} ${v.race.teamB}` };
  return (
    <div className="sticky top-2 z-10 grid grid-cols-2 gap-2">
      {TEAMS.map((t) => (
        <div key={t} className="flex items-center justify-between gap-2 rounded-2xl p-3 font-black" style={{ background: TEAM_BG[t], color: "#141414" }}>
          <span className="text-sm">{names[t]}</span>
          <b className="text-3xl tabular-nums">{v.scores[t]}</b>
        </div>
      ))}
    </div>
  );
}

function Winner({ v }: { v: View }) {
  const w = v.race.winner;
  if (!w) return null;
  return (
    <div className="m-card space-y-2 p-6 text-center">
      <div className="text-6xl">{w === "tie" ? "🤝" : "🏆"}</div>
      <h2 className="m-display text-3xl">{w === "tie" ? "تعادل!" : `الفايز: ${w === "a" ? v.race.teamA : v.race.teamB}`}</h2>
      <p className="m-muted">
        {v.race.teamA} {v.scores.a} · {v.race.teamB} {v.scores.b}
      </p>
    </div>
  );
}

function RoundCard({ r, current, children }: { r: Round; current: boolean; children?: React.ReactNode }) {
  const log = useContext(RaceLog);
  const [open, setOpen] = useState(current);
  return (
    <div className="m-card p-3" style={r.done ? { opacity: 0.6 } : undefined}>
      <button type="button" className="flex w-full items-center gap-3 text-start" onClick={() => {
          if (!open) log("game_opened", { round: r.name });
          setOpen(!open);
        }} aria-expanded={open}>
        <span className="text-2xl">{r.icon}</span>
        <span className="min-w-0 flex-1 font-bold">{r.name}</span>
        {current && <span className="m-chip m-chip-gold">الحين</span>}
        {r.done && <span className="m-chip m-chip-success">خلصت</span>}
        {r.water && <span className="m-chip">مسبح</span>}
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          <ol className="list-decimal space-y-1 ps-5">
            {r.how.split("\n").filter(Boolean).map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ol>
          {(r.tools || r.pts) && (
            <p className="m-muted text-sm">
              {r.tools && <>الأدوات: {r.tools}<br /></>}
              {r.pts && <>النقاط: {r.pts}</>}
            </p>
          )}
          {r.water && <p className="font-bold">🛟 كبير يراقب، والصغار في الضحل.</p>}
          {children}
        </div>
      )}
    </div>
  );
}

function PointsPad({ v, act, reason }: { v: View; act: (b: Record<string, unknown>) => void; reason: string }) {
  const [custom, setCustom] = useState("");
  const [why, setWhy] = useState("");
  return (
    <div className="m-card space-y-3 p-4">
      {TEAMS.map((t) => (
        <div key={t} className="space-y-2">
          <h4 className="font-bold">{t === "a" ? v.race.teamA : v.race.teamB}</h4>
          <div className="grid grid-cols-4 gap-2">
            {[5, 10, 15, 30, -2, -5, -10, -20].map((p) => (
              <button key={p} type="button" className={`m-btn m-btn-sm ${p > 0 ? "m-btn-primary" : "m-btn-ghost"}`} dir="ltr" onClick={() => act({ action: "points", team: t, points: p, reason: why.trim() || reason })}>
                {p > 0 ? `+${p}` : p}
              </button>
            ))}
          </div>
        </div>
      ))}
      <input className="m-field" value={why} onChange={(e) => setWhy(e.target.value)} maxLength={80} placeholder="السبب (اختياري)" aria-label="سبب النقاط" />
      <div className="flex gap-2">
        <input className="m-field w-24 text-center" inputMode="numeric" dir="ltr" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="-25" aria-label="رقم خاص" />
        {TEAMS.map((t) => (
          <button
            key={t}
            type="button"
            className="m-btn m-btn-ghost flex-1"
            disabled={!Number(custom)}
            onClick={() => {
              act({ action: "points", team: t, points: Number(custom), reason: why.trim() || reason });
              setCustom("");
            }}
          >
            {t === "a" ? v.race.emojiA : v.race.emojiB} سجّل
          </button>
        ))}
      </div>
    </div>
  );
}

function PointsLog({ v, act }: { v: View; act?: (b: Record<string, unknown>) => void }) {
  if (!v.points.length) return <p className="m-muted">ما فيه نقاط للحين.</p>;
  return (
    <div className="space-y-1">
      {v.points.map((p) => (
        <div key={p.id} className="flex items-center justify-between gap-3 border-b py-2 text-sm" style={{ borderColor: "var(--m-border, #8884)" }}>
          <span className="min-w-0 flex-1">
            {p.team === "a" ? v.race.emojiA : v.race.emojiB} {p.reason || "نقاط"}
          </span>
          <b dir="ltr" className="tabular-nums">
            {p.points > 0 ? `+${p.points}` : p.points}
          </b>
          {act && (
            <button type="button" className="m-btn m-btn-quiet m-btn-sm" onClick={() => act({ action: "undo", point: p.id })}>
              احذف
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function Rosters({ v }: { v: View }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {TEAMS.map((t) => (
        <div key={t} className="m-card space-y-2 p-3">
          <h3 className="font-black">{t === "a" ? `${v.race.emojiA} ${v.race.teamA}` : `${v.race.emojiB} ${v.race.teamB}`}</h3>
          {v.players.filter((p) => p.team === t).map((p) => (
            <div key={p.id} className="flex items-center gap-2 font-semibold">
              <Face raceId={v.race.id} p={p} size={40} /> <span className="min-w-0 flex-1">{p.name}</span>
              {v.race.revealed && p.spy && <span className="m-chip m-chip-gold">🕵️ جاسوس</span>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function SelfieButton({ raceId, again, onDone }: { raceId: string; again: boolean; onDone: () => void }) {
  const { toast } = useMahdi();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", new File([await shrinkImage(file, 800)], "selfie.jpg", { type: "image/jpeg" }));
      await mahdiFetch(`/api/mahdi/race/${raceId}/selfie`, { method: "POST", body: form });
      onDone();
    } catch (e) {
      toast((e as Error).message);
    }
    setBusy(false);
  }
  return (
    <>
      <input ref={input} type="file" accept="image/*" capture="user" hidden onChange={(e) => pick(e.target.files?.[0])} />
      <button type="button" className={`m-btn w-full ${again ? "m-btn-ghost" : "m-btn-primary"}`} disabled={busy} onClick={() => input.current?.click()}>
        {busy ? "يرفع…" : again ? "غيّر السلفي" : "📸 صوّر سلفي"}
      </button>
    </>
  );
}

function PlayerSide({ v, reload }: { v: View; reload: () => void }) {
  const me = v.me;
  const current = v.rounds.find((r) => r.id === v.race.currentRound);
  return (
    <>
      {me && !me.sv && (
        <div className="m-card space-y-3 p-4 text-center">
          <h2 className="text-xl font-black">آخر خطوة: سلفي!</h2>
          <p className="m-muted">صورتك تطلع للشباب في المسابقة بس، وتنمسح مع المسابقة.</p>
          <SelfieButton raceId={v.race.id} again={false} onDone={reload} />
        </div>
      )}
      {me && (
        <div className="m-card space-y-3 p-4">
          <div className="flex items-center gap-3">
            <Face raceId={v.race.id} p={me} size={56} />
            <div className="min-w-0 flex-1">
              <b className="text-lg">{me.name}</b>
              <p className="m-muted">{me.team ? `فريقك: ${me.team === "a" ? v.race.teamA : v.race.teamB}` : "القائد بيوزّع الفريقين"}</p>
            </div>
          </div>
          {v.race.spiesOn && !v.race.revealed && (
            <Hold kind="role_seen" label="امسك هنا عشان تشوف دورك السري">
              {me.spy ? (
                <>
                  <span className="text-xl">🕵️ أنت الجاسوس!</span>
                  <span>تشتغل للفريق الثاني:</span>
                  {me.missions.map((m) => (
                    <span key={m} className="font-medium">• {m}</span>
                  ))}
                </>
              ) : (
                <span className="text-xl">✅ أنت عضو عادي. دوّر على الجاسوس في فريقك</span>
              )}
            </Hold>
          )}
          {me.sv > 0 && <SelfieButton raceId={v.race.id} again onDone={reload} />}
        </div>
      )}
      {v.race.banned && <p className="m-card p-3 text-center font-bold">🚫 الكلمة الممنوعة: «{v.race.banned}»</p>}
      {current && (
        <section className="space-y-2">
          <h2 className="text-lg font-black">الجولة الحين</h2>
          <RoundCard key={current.id} r={current} current />
        </section>
      )}
      <Rosters v={v} />
      <section className="space-y-2">
        <h2 className="text-lg font-black">كل الألعاب وطريقتها</h2>
        {v.rounds.map((r) => (
          <RoundCard key={r.id} r={r} current={r.id === v.race.currentRound} />
        ))}
      </section>
      <section className="m-card space-y-2 p-4">
        <h2 className="text-lg font-black">آخر النقاط</h2>
        <PointsLog v={{ ...v, points: v.points.slice(0, 15) }} />
      </section>
      <section className="m-card space-y-2 p-4">
        <h2 className="text-lg font-black">قواعد اليوم</h2>
        <ol className="list-decimal space-y-1 ps-5">
          {RACE_RULES.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ol>
      </section>
    </>
  );
}

function AddRound({ act }: { act: (b: Record<string, unknown>) => void }) {
  const blank = { name: "", icon: "🎯", how: "", tools: "", pts: "", secs: "", water: false };
  const [f, setF] = useState(blank);
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button type="button" className="m-btn m-btn-ghost w-full" onClick={() => setOpen(true)}>
        + أضف مسابقة
      </button>
    );
  return (
    <div className="m-card space-y-2 p-4">
      <h3 className="font-black">مسابقة جديدة</h3>
      <div className="flex gap-2">
        <input className="m-field w-16 text-center" value={f.icon} onChange={(e) => setF({ ...f, icon: e.target.value })} aria-label="رمز" />
        <input className="m-field flex-1" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={60} placeholder="اسم المسابقة" aria-label="اسم المسابقة" />
      </div>
      <textarea className="m-field" rows={4} value={f.how} onChange={(e) => setF({ ...f, how: e.target.value })} maxLength={1500} placeholder="الطريقة: كل خطوة في سطر" aria-label="الطريقة" />
      <input className="m-field" value={f.tools} onChange={(e) => setF({ ...f, tools: e.target.value })} maxLength={200} placeholder="الأدوات" aria-label="الأدوات" />
      <input className="m-field" value={f.pts} onChange={(e) => setF({ ...f, pts: e.target.value })} maxLength={120} placeholder="النقاط" aria-label="النقاط" />
      <input className="m-field" inputMode="numeric" value={f.secs} onChange={(e) => setF({ ...f, secs: e.target.value })} placeholder="مؤقت بالثواني (اختياري)" aria-label="المؤقت" />
      <label className="flex items-center gap-2 font-semibold">
        <input type="checkbox" checked={f.water} onChange={(e) => setF({ ...f, water: e.target.checked })} /> لعبة مسبح
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          className="m-btn m-btn-primary flex-1"
          disabled={!f.name.trim()}
          onClick={() => {
            act({ action: "roundAdd", ...f, secs: Number(f.secs) || 0 });
            setF(blank);
            setOpen(false);
          }}
        >
          أضف
        </button>
        <button type="button" className="m-btn m-btn-ghost" onClick={() => setOpen(false)}>
          إلغاء
        </button>
      </div>
    </div>
  );
}

/** A destructive button that asks by a second tap. */
function Twice({ label, again, onGo, cls = "m-btn-danger" }: { label: string; again: string; onGo: () => void; cls?: string }) {
  const [armed, setArmed] = useState(false);
  return (
    <button
      type="button"
      className={`m-btn m-btn-sm ${cls}`}
      onClick={() => {
        if (armed) onGo();
        else {
          setArmed(true);
          setTimeout(() => setArmed(false), 3500);
        }
      }}
    >
      {armed ? again : label}
    </button>
  );
}

function TeamsTab({ v, act }: { v: View; act: (b: Record<string, unknown>) => void }) {
  const [names, setNames] = useState({ teamA: v.race.teamA, teamB: v.race.teamB, emojiA: v.race.emojiA, emojiB: v.race.emojiB });
  const link = typeof location === "undefined" ? "" : `${location.origin}/mahdi/race?c=${v.race.code}`;
  const { toast } = useMahdi();
  return (
    <div className="space-y-3">
      <div className="m-card space-y-2 p-4">
        <h3 className="font-black">رابط الدخول</h3>
        <p dir="ltr" className="text-center text-3xl font-black tracking-widest">{v.race.code}</p>
        <button
          type="button"
          className="m-btn m-btn-ghost w-full"
          onClick={() =>
            navigator.clipboard.writeText(link).then(
              () => toast("انسخ الرابط"),
              () => toast(link),
            )
          }
        >
          انسخ الرابط للشباب
        </button>
      </div>
      <div className="m-card space-y-2 p-4">
        <h3 className="font-black">تسمية الفريقين</h3>
        <div className="flex gap-2">
          <input className="m-field w-16 text-center" value={names.emojiA} onChange={(e) => setNames({ ...names, emojiA: e.target.value })} aria-label="رمز الفريق الأول" />
          <input className="m-field flex-1" value={names.teamA} onChange={(e) => setNames({ ...names, teamA: e.target.value })} maxLength={30} aria-label="اسم الفريق الأول" />
        </div>
        <div className="flex gap-2">
          <input className="m-field w-16 text-center" value={names.emojiB} onChange={(e) => setNames({ ...names, emojiB: e.target.value })} aria-label="رمز الفريق الثاني" />
          <input className="m-field flex-1" value={names.teamB} onChange={(e) => setNames({ ...names, teamB: e.target.value })} maxLength={30} aria-label="اسم الفريق الثاني" />
        </div>
        <button type="button" className="m-btn m-btn-ghost w-full" onClick={() => act({ action: "settings", ...names })}>
          احفظ الأسماء
        </button>
      </div>
      <div className="m-card space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-black">التوزيع ({v.players.length})</h3>
          <Twice label="وزّع عشوائي" again="تأكيد التوزيع" cls="m-btn-primary" onGo={() => act({ action: "deal" })} />
        </div>
        <p className="m-muted text-sm">علّم الصغار عشان يتوزعون بالتساوي وما يطلعون جواسيس.</p>
        {!v.players.length && <p className="m-muted">أرسل الرابط للشباب، وأسماءهم تطلع هنا أول ما يدخلون.</p>}
        {v.players.map((p) => (
          <div key={p.id} className="space-y-2 border-t pt-2" style={{ borderColor: "var(--m-border, #8884)" }}>
            <div className="flex items-center gap-2 font-semibold">
              <Face raceId={v.race.id} p={p} size={40} />
              <span className="min-w-0 flex-1">{p.name}</span>
              <Twice label="احذف" again="متأكد؟" onGo={() => act({ action: "remove", user: p.id })} />
            </div>
            <div className="flex gap-2">
              {TEAMS.map((t) => (
                <button key={t} type="button" className={`m-btn m-btn-sm flex-1 ${p.team === t ? "m-btn-primary" : "m-btn-ghost"}`} onClick={() => act({ action: "move", user: p.id, team: t })}>
                  {t === "a" ? v.race.teamA : v.race.teamB}
                </button>
              ))}
              <button type="button" className={`m-btn m-btn-sm ${p.kid ? "m-btn-primary" : "m-btn-ghost"}`} onClick={() => act({ action: "kid", user: p.id, kid: !p.kid })}>
                صغير
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GamesTab({ v, act }: { v: View; act: (b: Record<string, unknown>) => void }) {
  const teams = { a: v.race.teamA, b: v.race.teamB };
  return (
    <div className="space-y-2">
      <p className="m-muted text-sm">كل الألعاب هنا بطريقتها. العب اللي تبي بالترتيب اللي تبي، ومو لازم تمر عليها كلها.</p>
      {v.rounds.map((r) => {
        const current = r.id === v.race.currentRound;
        return (
          <RoundCard key={r.id} r={r} current={current}>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={`m-btn m-btn-sm ${current ? "m-btn-ghost" : "m-btn-primary"}`} onClick={() => act({ action: "roundCurrent", round: current ? null : r.id })}>
                {current ? "شيلها من «الحين»" : "اعرضها للكل الحين"}
              </button>
              <button type="button" className="m-btn m-btn-ghost m-btn-sm" onClick={() => act({ action: "roundDone", round: r.id, done: !r.done })}>
                {r.done ? "رجّعها" : "خلصت"}
              </button>
              <Twice label="احذف المسابقة" again="متأكد؟" onGo={() => act({ action: "roundDelete", round: r.id })} />
            </div>
            <RaceTools round={r} teams={teams} add={(team, points, reason) => act({ action: "points", team, points, reason })} />
            <PointsPad v={v} act={act} reason={r.name} />
          </RoundCard>
        );
      })}
      <AddRound act={act} />
    </div>
  );
}

/** The live record, newest first, and the file that takes the whole day out for the film. */
function RecordTab({ v }: { v: View }) {
  const { toast } = useMahdi();
  const [lines, setLines] = useState<{ id: number; at: string; actor_name: string | null; kind: string; data: Record<string, unknown> }[]>([]);
  useEffect(() => {
    const load = () => mahdiFetch<{ events: typeof lines }>(`/api/mahdi/race/${v.race.id}/event`).then((r) => setLines(r.events)).catch((e: Error) => toast(e.message));
    void load();
    const iv = setInterval(load, 4000);
    return () => clearInterval(iv);
  }, [v.race.id, toast]);
  return (
    <div className="space-y-3">
      <a className="m-btn m-btn-primary w-full" href={`/api/mahdi/race/${v.race.id}/export`} download>
        ⬇️ استخرج سجل اليوم كامل
      </a>
      <p className="m-muted text-sm">كل حركة في الصفحة تنسجل بوقتها الدقيق، عشان نطابقها مع التصوير في المونتاج. استخرج الملف قبل ما تمسح المسابقة.</p>
      <div className="m-card space-y-1 p-3">
        <h3 className="font-black">المراقبة الحية</h3>
        {!lines.length && <p className="m-muted">السجل يبدأ مع أول حركة.</p>}
        {lines.map((e) => (
          <div key={e.id} className="flex gap-2 border-b py-1 text-sm" style={{ borderColor: "var(--m-border, #8884)" }}>
            <span dir="ltr" className="tabular-nums m-muted">{new Date(e.at).toLocaleTimeString("en-GB")}</span>
            <span className="font-semibold">{e.actor_name ?? ""}</span>
            <span className="min-w-0 flex-1" dir="ltr" style={{ overflowWrap: "anywhere" }}>{e.kind}{typeof e.data.word === "string" ? `: ${e.data.word}` : typeof e.data.reason === "string" ? `: ${e.data.reason} ${e.data.points ?? ""}` : typeof e.data.roundName === "string" ? `: ${e.data.roundName}` : typeof e.data.round === "string" ? `: ${e.data.round}` : ""}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScoreTab({ v, act }: { v: View; act: (b: Record<string, unknown>) => void }) {
  const log = useContext(RaceLog);
  const [surprise, setSurprise] = useState("");
  return (
    <div className="space-y-3">
      <PointsPad v={v} act={act} reason="من القائد" />
      <div className="m-card space-y-2 p-4">
        <h3 className="font-black">🚫 الكلمة الممنوعة</h3>
        <p className="font-bold">{v.race.banned || "ما فيه"}</p>
        <div className="flex flex-wrap gap-2">
          {RACE_BANNED.map((w) => (
            <button key={w} type="button" className="m-chip" onClick={() => act({ action: "settings", banned: w })}>
              {w}
            </button>
          ))}
          <button type="button" className="m-chip" onClick={() => act({ action: "settings", banned: "" })}>
            شيلها
          </button>
        </div>
      </div>
      <div className="m-card space-y-2 p-4">
        <h3 className="font-black">⚡ مهمة مفاجئة</h3>
        {surprise && <p className="text-lg font-bold">{surprise}</p>}
        <button type="button" className="m-btn m-btn-ghost w-full" onClick={() => {
            const s = RACE_SURPRISES[Math.floor(Math.random() * RACE_SURPRISES.length)];
            log("surprise_mission", { text: s });
            setSurprise(s);
          }}>
          مهمة جديدة
        </button>
      </div>
      <div className="m-card space-y-2 p-4">
        <h3 className="font-black">سجل النقاط</h3>
        <PointsLog v={v} act={act} />
      </div>
    </div>
  );
}

function SpiesTab({ v, act }: { v: View; act: (b: Record<string, unknown>) => void }) {
  const spies = v.players.filter((p) => p.spy);
  return (
    <div className="m-card space-y-3 p-4">
      <h3 className="font-black">🕵️ الجواسيس</h3>
      <p className="m-muted text-sm">جاسوس واحد لكل فريق، يشوف دوره ومهامه على جواله بس. وزّع الفريقين قبل السحب.</p>
      <Twice label={v.race.spiesOn ? "اسحب جواسيس من جديد" : "اسحب الجواسيس"} again="تأكيد السحب" cls="m-btn-primary" onGo={() => act({ action: "spies" })} />
      {v.race.spiesOn && (
        <>
          <Hold kind="spies_seen_by_leader" label="امسك هنا عشان تشوف منو الجواسيس">
            {spies.map((p) => (
              <span key={p.id}>
                {p.name} ({p.team === "a" ? v.race.teamA : v.race.teamB})
              </span>
            ))}
          </Hold>
          <button type="button" className="m-btn m-btn-primary w-full" onClick={() => act({ action: "reveal", revealed: !v.race.revealed })}>
            {v.race.revealed ? "خفّهم مرة ثانية" : "اكشف الجواسيس للكل"}
          </button>
          {v.race.revealed &&
            spies.map((p) => (
              <div key={p.id} className="space-y-1 border-t pt-2" style={{ borderColor: "var(--m-border, #8884)" }}>
                <b>{p.name}</b>
                {(p.missions ?? []).map((m) => (
                  <p key={m} className="text-sm">• {m}</p>
                ))}
              </div>
            ))}
          <button type="button" className="m-btn m-btn-quiet w-full" onClick={() => act({ action: "spiesOff" })}>
            ألغِ الجواسيس
          </button>
        </>
      )}
      <p className="m-muted text-sm">النقاط من لوحة النتيجة: +40 للفريق اللي كشف جاسوسه، أو +40 للفريق الثاني إذا ما انكشف، و+10 لكل مهمة سواها الجاسوس.</p>
    </div>
  );
}

function FinishTab({ v, act, onDelete }: { v: View; act: (b: Record<string, unknown>) => void; onDelete: () => void }) {
  const tied = v.scores.a === v.scores.b;
  return (
    <div className="space-y-3">
      <div className="m-card space-y-3 p-4">
        <h3 className="font-black">🏷️ الحسم النهائي</h3>
        <p className="m-muted text-sm">لعبة «الحسم النهائي» في تبويب الألعاب. بعدها اكشف الجواسيس، وأعلن الفايز.</p>
        {v.race.winner ? (
          <button type="button" className="m-btn m-btn-ghost w-full" onClick={() => act({ action: "unfinish" })}>
            ألغِ الإعلان
          </button>
        ) : tied ? (
          <div className="flex flex-wrap gap-2">
            {TEAMS.map((t) => (
              <button key={t} type="button" className="m-btn m-btn-primary flex-1" onClick={() => act({ action: "finish", winner: t })}>
                الفايز {t === "a" ? v.race.teamA : v.race.teamB}
              </button>
            ))}
            <button type="button" className="m-btn m-btn-ghost w-full" onClick={() => act({ action: "finish", winner: "tie" })}>
              أعلن التعادل
            </button>
          </div>
        ) : (
          <Twice label={`🏆 أعلن الفايز: ${v.scores.a > v.scores.b ? v.race.teamA : v.race.teamB}`} again="تأكيد: يطلع عند الكل" cls="m-btn-primary" onGo={() => act({ action: "finish" })} />
        )}
      </div>
      <div className="m-card space-y-2 p-4">
        <h3 className="font-black">إنهاء المسابقة</h3>
        <p className="m-muted text-sm">يمسح المسابقة ونقاطها وسجلها وسلفيات الشباب نهائيًا. استخرج السجل قبلها من تبويب «السجل».</p>
        <Twice label="امسح كل شي" again="اضغط مرة ثانية: يمسح نهائيًا" onGo={onDelete} />
      </div>
    </div>
  );
}

const TABS = [
  ["score", "النتيجة"],
  ["teams", "الفريقين"],
  ["games", "الألعاب"],
  ["spies", "الجواسيس"],
  ["finish", "الختام"],
  ["record", "السجل"],
] as const;

export default function RaceRoom({ id }: { id: string }) {
  const { toast } = useMahdi();
  const router = useRouter();
  const [v, setV] = useState<View | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<(typeof TABS)[number][0] | "view">("score");
  const url = `/api/mahdi/race/${id}`;

  const reload = useCallback(() => {
    mahdiFetch<View>(url).then(setV).catch((e: Error) => setError(e.message));
  }, [url]);

  useEffect(() => {
    reload();
    const iv = setInterval(() => {
      if (!document.hidden) reload();
    }, 4000);
    return () => clearInterval(iv);
  }, [reload]);

  // One line per thing that happened on this phone, with its time here (the server adds its own).
  const log = useCallback(
    (kind: string, data: Record<string, unknown> = {}) => {
      void fetch(`${url}/event`, { method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true, body: JSON.stringify({ kind, data, clientAt: new Date().toISOString() }) }).catch(() => {});
    },
    [url],
  );
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    log("page_opened");
  }, [log]);

  const act = useCallback(
    (b: Record<string, unknown>) => {
      mahdiFetch<View>(url, { method: "PATCH", json: b }).then(setV).catch((e: Error) => toast(e.message));
    },
    [url, toast],
  );

  if (error && !v)
    return (
      <div className="m-card space-y-3 p-6 text-center">
        <p>{error}</p>
        <Link href="/mahdi/race" className="m-btn m-btn-ghost">
          ادخل بالكود
        </Link>
      </div>
    );
  if (!v) return <p className="m-muted">يحمّل…</p>;

  return (
    <RaceLog.Provider value={log}>
    <div className="space-y-4">
      <h1 className="m-display text-2xl">{v.race.title}</h1>
      <Board v={v} />
      <Winner v={v} />
      {v.isOwner ? (
        <>
          <nav className="flex flex-wrap gap-2" aria-label="لوحة القيادة">
            {TABS.map(([k, label]) => (
              <button key={k} type="button" className={`m-btn m-btn-sm flex-1 ${tab === k ? "m-btn-primary" : "m-btn-ghost"}`} onClick={() => setTab(k)}>
                {label}
              </button>
            ))}
            <button type="button" className={`m-btn m-btn-sm flex-1 ${tab === "view" ? "m-btn-primary" : "m-btn-ghost"}`} onClick={() => setTab("view")}>
              شاشة الشباب
            </button>
          </nav>
          {tab === "score" && <ScoreTab v={v} act={act} />}
          {tab === "teams" && <TeamsTab v={v} act={act} />}
          {tab === "games" && <GamesTab v={v} act={act} />}
          {tab === "spies" && <SpiesTab v={v} act={act} />}
          {tab === "finish" && (
            <FinishTab
              v={v}
              act={act}
              onDelete={() =>
                mahdiFetch(url, { method: "DELETE" })
                  .then(() => router.push("/mahdi/race"))
                  .catch((e: Error) => toast(e.message))
              }
            />
          )}
          {tab === "record" && <RecordTab v={v} />}
          {tab === "view" && <PlayerSide v={v} reload={reload} />}
        </>
      ) : (
        <PlayerSide v={v} reload={reload} />
      )}
    </div>
    </RaceLog.Provider>
  );
}
