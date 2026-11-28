"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { fmtPct } from "@/lib/mahdi/i18n";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import { isGroupProjectId } from "@/lib/mahdi/groups/program";
import type { ContestPhase, EntryResult } from "@/lib/mahdi/contests";
import type { ISODate } from "@/lib/mahdi/engine";
import Avatar from "@/components/mahdi/Avatar";
import ConfirmSheet from "@/components/mahdi/ConfirmSheet";
import Icon from "@/components/mahdi/Icon";
import { useMahdi } from "@/components/mahdi/Provider";
import PageHead from "@/components/mahdi/social/PageHead";
import { ErrorState, Skeleton } from "@/components/mahdi/social/States";
import ContestChat from "@/components/mahdi/contests/ContestChat";
import ResultView, { scoreColor } from "@/components/mahdi/contests/ResultView";

interface ContestView {
  id: string;
  title: string;
  details: string;
  prize: string;
  startsOn: ISODate;
  endsOn: ISODate;
  threshold: number;
  minHabits: number;
  days: number;
  weeks: number;
  phase: ContestPhase;
  joinOpen: boolean;
  locked: boolean;
  drawn: boolean;
}
interface Row extends EntryResult {
  key: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  projects: string[];
  excluded: boolean;
  winnerRank: number | null;
  prizeSent: boolean;
  unread: boolean;
  hasMessages: boolean;
}
interface Data {
  contest: ContestView;
  role: "owner" | "member" | "visitor";
  organizer: string;
  code?: string;
  rows?: Row[];
  participants?: number;
  winners?: { rank: number; displayName: string }[];
  me?: { projectIds: string[]; result: EntryResult | null; winnerRank: number | null; prizeSent: boolean; excluded: boolean; unread: boolean } | null;
}

const PHASE: Record<ContestPhase, string> = { upcoming: "تبدأ قريب", live: "شغّالة الحين", over: "خلصت" };
const day = (d: ISODate) => new Date(`${d}T12:00:00Z`).toLocaleDateString("ar", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

/** Picks the participant's own projects (not the groups' ones), with how many habits each has. */
function ProjectPicker({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const { state } = useMahdi();
  const projects = state.snap.projects.filter((p) => !p.archivedAt && !isGroupProjectId(p.id));
  const count = (id: string) => state.snap.habits.filter((h) => h.projectId === id && h.versions.at(-1)?.state === "active").length;
  if (!projects.length) return <p className="m-note text-sm">ما عندك مشاريع للحين. سوّ مشروع عبادة وحط فيه عاداتك، بعدها ارجع هنا.</p>;
  return (
    <ul className="space-y-2">
      {projects.map((p) => {
        const on = value.includes(p.id);
        return (
          <li key={p.id}>
            <label className="m-card flex cursor-pointer items-center gap-3 p-3">
              <input type="checkbox" checked={on} onChange={() => onChange(on ? value.filter((x) => x !== p.id) : [...value, p.id])} />
              <span className="text-xl" aria-hidden="true">{p.icon}</span>
              <span className="min-w-0 flex-1 truncate font-semibold">{p.name}</span>
              <span className="m-muted m-num text-sm">{count(p.id)} عادة</span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}

function Rules({ c, organizer }: { c: ContestView; organizer: string }) {
  return (
    <section className="m-card space-y-2 p-5">
      <p className="m-num text-sm">
        <Icon name="calendar" size={16} className="inline" /> من {day(c.startsOn)} إلى {day(c.endsOn)} ({c.days} يوم) · {PHASE[c.phase]}
      </p>
      <p className="text-sm">
        الفوز لمن يوصل <b className="m-num">{c.threshold}٪</b> أو أكثر في عاداته، وبحد أدنى <b className="m-num">{c.minHabits}</b> عادات.
      </p>
      {c.prize && <p className="font-semibold"><Icon name="star" size={16} className="m-gold inline" /> الجائزة: {c.prize}</p>}
      {c.details && <p className="whitespace-pre-wrap text-sm">{c.details}</p>}
      {organizer && <p className="m-muted text-sm">المنظم: {organizer}</p>}
    </section>
  );
}

/** The organiser's view: the link to share, everyone's results (habits, weeks), the draw, the prizes and the conversations. */
function OwnerView({ data, reload }: { data: Data; reload: () => void }) {
  const { toast } = useMahdi();
  const router = useRouter();
  const search = useSearchParams();
  const c = data.contest;
  const rows = useMemo(() => [...(data.rows ?? [])].sort((a, b) => (a.winnerRank ?? 99) - (b.winnerRank ?? 99) || (b.score ?? -1) - (a.score ?? -1)), [data.rows]);
  const [open, setOpen] = useState<string | null>(null);
  const [chat, setChat] = useState<string | null>(() => {
    const q = search.get("chat");
    return q && q !== "1" ? q : null;
  });
  const [count, setCount] = useState(1);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const link = typeof window === "undefined" ? "" : `${location.origin}/api/mahdi/contests/go?c=${data.code}`;
  const qualified = rows.filter((r) => r.qualified && !r.excluded).length;

  const act = async (json: Record<string, unknown>, done?: string) => {
    try {
      const r = await mahdiFetch<{ winners?: number; pool?: number }>(`/api/mahdi/contests/${c.id}`, { method: "POST", json });
      if (done) toast(done);
      else if (r.winners !== undefined) toast(`انسحب ${r.winners} من ${r.pool} واصلين، ووصلهم إشعار`);
      reload();
    } catch (e) {
      toast((e as Error).message);
    }
  };
  const share = () => {
    const text = `«${c.title}»\n${c.prize ? `الجائزة: ${c.prize}\n` : ""}من ${day(c.startsOn)} إلى ${day(c.endsOn)}، والفوز لمن يوصل ${c.threshold}٪ في عباداته.\nادخل من تطبيق «لأجل المهدي» واختر مشاريعك العبادية:\n${link}\nأو اكتب الكود ${data.code} في «مسابقة الثبات» ← «عندي كود».`;
    if (navigator.share) navigator.share({ title: c.title, text }).catch(() => {});
    else navigator.clipboard?.writeText(text).then(() => toast("انتسخ الإعلان مع الرابط"), () => {});
  };

  return (
    <div className="space-y-4">
      <section className="m-card space-y-3 p-5">
        <p className="font-semibold">الرابط والكود الخاص</p>
        <p className="m-muted text-sm">أرسل الرابط في قروب الواتساب: اللي يفتحه يسجّل في التطبيق (أو يدخل) ويوصل للمسابقة على طول. أو أعطهم الكود: يكتبونه في «مسابقة الثبات» ← «عندي كود».</p>
        <p className="m-num text-center text-3xl font-bold tracking-[0.3em]" dir="ltr">{data.code}</p>
        <p className="m-field m-num select-all break-all text-sm" dir="ltr">{link}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="m-btn m-btn-primary m-btn-sm" onClick={share}>
            <Icon name="link" size={16} /> أرسل الإعلان والرابط
          </button>
          <button type="button" className="m-btn m-btn-ghost m-btn-sm" onClick={() => navigator.clipboard?.writeText(link).then(() => toast("انتسخ الرابط"), () => {})}>
            انسخ الرابط
          </button>
          <button type="button" className="m-btn m-btn-ghost m-btn-sm" onClick={() => navigator.clipboard?.writeText(data.code ?? "").then(() => toast("انتسخ الكود"), () => {})}>
            انسخ الكود
          </button>
        </div>
      </section>


      <section className="space-y-2">
        <div className="flex items-end justify-between gap-2">
          <h2 className="font-semibold">المشاركين ({rows.length})</h2>
          <p className="m-muted m-num text-sm">{qualified} واصلين {c.threshold}٪</p>
        </div>
        {!rows.length && <p className="m-muted text-sm">ما انضم أحد للحين. أرسل الرابط أو الكود.</p>}
        {rows.map((r) => (
          <article key={r.key} className="m-card space-y-3 p-4" style={r.excluded ? { opacity: 0.6 } : undefined}>
            <button type="button" className="flex w-full items-center gap-3 text-start" onClick={() => setOpen(open === r.key ? null : r.key)} aria-expanded={open === r.key}>
              <Avatar profile={{ displayName: r.displayName, avatarUrl: r.avatarUrl }} size={40} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">
                  {r.winnerRank ? <Icon name="trophy" size={16} className="m-gold me-1 inline" /> : null}
                  {r.winnerRank ? `الفايز ${r.winnerRank} · ` : ""}
                  {r.displayName}
                  {r.unread && <span className="m-chip m-chip-gold ms-1 text-xs">رسالة</span>}
                </span>
                <span className="m-muted block truncate text-xs">{r.projects.join("، ") || "—"} · {r.habitCount} عادة</span>
              </span>
              <span className="m-num text-lg font-bold" style={{ color: scoreColor(r.score, c.threshold) }}>{fmtPct(r.score)}</span>
            </button>
            {open === r.key && (
              <>
                <ResultView result={r} threshold={c.threshold} minHabits={c.minHabits} />
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="m-btn m-btn-ghost m-btn-sm" onClick={() => setChat(chat === r.key ? null : r.key)}>
                    <Icon name="chat" size={16} /> راسله
                  </button>
                  {r.winnerRank && (
                    <button type="button" className={`m-btn m-btn-sm ${r.prizeSent ? "m-btn-primary" : "m-btn-ghost"}`} onClick={() => act({ action: "prize", entry: r.key, sent: !r.prizeSent }, r.prizeSent ? "رجعت «ما انرسلت»" : "تمام: الجائزة انرسلت")}>
                      {r.prizeSent ? "✓ الجائزة انرسلت" : "أرسلت الجائزة"}
                    </button>
                  )}
                  <button type="button" className="m-btn m-btn-quiet m-btn-sm" onClick={() => act({ action: "exclude", entry: r.key, excluded: !r.excluded }, r.excluded ? "رجع للسحب" : "انشال من السحب")}>
                    {r.excluded ? "رجّعه للسحب" : "شيله من السحب"}
                  </button>
                </div>
              </>
            )}
            {chat === r.key && <ContestChat contestId={c.id} entry={r.key} other={r.displayName} />}
          </article>
        ))}
      </section>

      <section className="m-card space-y-3 p-5">
        <p className="font-semibold">السحب على الجوائز</p>
        {c.phase !== "over" ? (
          <p className="m-muted text-sm">السحب يفتح بعد ما تخلص المسابقة ({day(c.endsOn)}). يوصلك إشعار آخر كل أسبوع بعدد الواصلين.</p>
        ) : (
          <>
            <p className="m-muted text-sm m-num">السحب بين {qualified} وصلوا {c.threshold}٪ (اللي شلتهم من السحب ما يدخلون). يوصل الفايزين إشعار، والباقين يعرفون النتيجة.</p>
            <div className="flex items-center gap-2">
              <label className="m-label" htmlFor="winners">عدد الفايزين</label>
              <input id="winners" type="number" min={1} max={20} className="m-field m-num !w-20" value={count} onChange={(e) => setCount(Number(e.target.value))} />
              <button type="button" className="m-btn m-btn-primary m-btn-sm" disabled={!qualified} onClick={() => act({ action: "draw", count })}>
                {c.drawn ? "اسحب من جديد" : "اسحب"}
              </button>
            </div>
            <p className="m-muted text-xs">بعد السحب راسل كل فايز من «راسله» وأرسل له القسيمة، واضغط «أرسلت الجائزة».</p>
          </>
        )}
      </section>

      <button type="button" className="m-btn m-btn-quiet m-btn-sm" onClick={() => setConfirmDelete(true)}>
        <Icon name="trash" size={16} /> احذف المسابقة
      </button>
      <ConfirmSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="تحذف المسابقة؟"
        body="تنحذف مع المشاركين والرسائل. عادات المشاركين ما تتأثر."
        onConfirm={async () => {
          await act({ action: "delete" }, "انحذفت");
          router.push("/mahdi/contests");
        }}
      />
    </div>
  );
}

/** A participant (or a visitor about to join): their projects, their result, the winners, and the organiser's chat. */
function MemberView({ data, code, reload }: { data: Data; code: string | null; reload: () => void }) {
  const { toast } = useMahdi();
  const search = useSearchParams();
  const c = data.contest;
  const me = data.me ?? null;
  const [projects, setProjects] = useState<string[]>(me?.projectIds ?? []);
  const [editing, setEditing] = useState(false);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [chat, setChat] = useState(search.get("chat") !== null);

  const post = async (json: Record<string, unknown>, done: string) => {
    setBusy(true);
    try {
      await mahdiFetch(`/api/mahdi/contests/${c.id}`, { method: "POST", json: { ...json, code } });
      toast(done);
      setEditing(false);
      reload();
    } catch (e) {
      toast((e as Error).message);
    }
    setBusy(false);
  };

  if (!me) {
    return (
      <section className="m-card space-y-4 p-5">
        <p className="font-semibold">اختر مشاريعك العبادية</p>
        {c.joinOpen ? (
          <>
            <p className="m-muted text-sm">عادات المشاريع اللي تختارها هي اللي تنحسب في المسابقة، على يومك أنت (من «بداية يومي»). تقدر تغيّرها لين تبدأ المسابقة.</p>
            <ProjectPicker value={projects} onChange={setProjects} />
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
              <span>أوافق إن المنظم يشوف أسماء عاداتي في هالمشاريع ونسبتها، وإن اسمي يطلع للمشاركين لو فزت بالسحب.</span>
            </label>
            <button type="button" className="m-btn m-btn-primary" disabled={busy || !agree || !projects.length} onClick={() => post({ action: "join", projects, agree }, "انضممت للمسابقة. الله يوفقك")}>
              انضم للمسابقة
            </button>
          </>
        ) : (
          <p className="m-muted text-sm">انتهى وقت الانضمام لهالمسابقة.</p>
        )}
      </section>
    );
  }

  return (
    <div className="space-y-4">
      {me.winnerRank && (
        <section className="m-card space-y-1 p-5 text-center">
          <Icon name="trophy" size={36} className="m-gold mx-auto" />
          <p className="font-semibold">مبروك! فزت في السحب</p>
          <p className="m-muted text-sm">{me.prizeSent ? "المنظم أرسل لك الجائزة: شوف رسائلك تحت." : "المنظم بيراسلك هنا ويرسل لك الجائزة."}</p>
        </section>
      )}
      {(data.winners?.length ?? 0) > 0 && !me.winnerRank && (
        <section className="m-card space-y-2 p-5">
          <p className="font-semibold">الفايزين بالسحب</p>
          <p className="text-sm">{data.winners!.map((w) => w.displayName).join("، ")}</p>
        </section>
      )}
      <section className="m-card space-y-3 p-5">
        <p className="font-semibold">نتيجتك</p>
        {c.phase === "upcoming" ? (
          <p className="m-muted text-sm">المسابقة تبدأ {day(c.startsOn)}. سجّل عاداتك كل يوم في «اليوم» وتنحسب هنا لحالها.</p>
        ) : me.result ? (
          <ResultView result={me.result} threshold={c.threshold} minHabits={c.minHabits} />
        ) : null}
        {me.excluded && <p className="m-note text-sm">المنظم شالك من السحب. راسله لو عندك سؤال.</p>}
      </section>

      <section className="m-card space-y-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold">مشاريعك في المسابقة</p>
          {!c.locked && !editing && (
            <button type="button" className="m-btn m-btn-ghost m-btn-sm" onClick={() => setEditing(true)}>
              <Icon name="edit" size={16} /> غيّرها
            </button>
          )}
        </div>
        {editing ? (
          <>
            <ProjectPicker value={projects} onChange={setProjects} />
            <button type="button" className="m-btn m-btn-primary m-btn-sm" disabled={busy || !projects.length} onClick={() => post({ action: "projects", projects }, "انحفظت مشاريعك")}>
              احفظ
            </button>
          </>
        ) : (
          <SelectedProjects ids={me.projectIds} />
        )}
        {c.locked && <p className="m-muted text-xs">بدأت المسابقة: المشاريع ثابتة لين تخلص.</p>}
      </section>

      {chat ? (
        <ContestChat contestId={c.id} entry="me" other={data.organizer ? `المنظم (${data.organizer})` : "المنظم"} />
      ) : (
        <button type="button" className="m-btn m-btn-ghost" onClick={() => setChat(true)}>
          <Icon name="chat" size={18} /> راسل المنظم {me.unread && <span className="m-chip m-chip-gold ms-1 text-xs">رسالة جديدة</span>}
        </button>
      )}

      {!c.locked && (
        <button type="button" className="m-btn m-btn-quiet m-btn-sm" disabled={busy} onClick={() => post({ action: "leave" }, "طلعت من المسابقة")}>
          اطلع من المسابقة
        </button>
      )}
    </div>
  );
}

function SelectedProjects({ ids }: { ids: string[] }) {
  const { state } = useMahdi();
  const list = state.snap.projects.filter((p) => ids.includes(p.id));
  if (!list.length) return <p className="m-muted text-sm">المشاريع اللي اخترتها انحذفت أو انأرشفت.</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {list.map((p) => (
        <span key={p.id} className="m-chip">
          {p.icon} {p.name}
        </span>
      ))}
    </div>
  );
}

function ContestPage() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const code = search.get("c");
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(
    () =>
      mahdiFetch<Data>(`/api/mahdi/contests/${id}${code ? `?c=${encodeURIComponent(code)}` : ""}`)
        .then((d) => {
          setData(d);
          setError("");
        })
        .catch((e) => setError((e as Error).message)),
    [id, code],
  );
  useEffect(() => {
    load();
  }, [load]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <Skeleton kind="cards" count={3} />;
  const c = data.contest;
  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-10">
      <PageHead title={c.title} eyebrow="مسابقة الثبات" sub={data.role === "owner" ? "أنت المنظم" : data.participants ? `${data.participants} مشارك` : undefined} />
      <Rules c={c} organizer={data.role === "owner" ? "" : data.organizer} />
      {data.role === "owner" ? <OwnerView data={data} reload={load} /> : <MemberView data={data} code={code} reload={load} />}
    </div>
  );
}

export default function ContestPageShell() {
  return (
    <Suspense fallback={<Skeleton kind="cards" count={3} />}>
      <ContestPage />
    </Suspense>
  );
}
