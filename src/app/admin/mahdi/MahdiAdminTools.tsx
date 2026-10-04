"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { postJson } from "@/lib/fetch";
import { t } from "@/lib/mahdi/i18n";

const A = t.admin;

export interface Section { id: string; name: string; description: string; icon: string; sort_order: number; active: boolean }
export interface Chal { id: string; section_id: string; title: string; description: string; rules: string; measure: "check" | "count" | "amount"; target: number; unit: string; freq: "daily" | "weekly" | "monthly"; starts_on: string; ends_on: string | null; status: "draft" | "published" | "archived"; leaderboard: boolean; members: number }
export interface Txt { id: string; kind: string; text: string; attribution: string; source: string; reference: string; verification_status: "pending" | "verified" | "rejected"; verified_by: string; notes: string; contexts: string[]; active: boolean }
export interface Phr { id: string; text: string; contexts: string[]; active: boolean; sort_order: number }
export interface Rep { id: string; author: string; kind: string; title: string; value: string; createdAt: string; hidden: boolean; hiddenReason: string; reasons: string[]; count: number }
export interface Bk { id: string; title: string; author: string; pages: number; unit: "page" | "narration"; description: string; coverUrl: string | null; hidden: boolean; hiddenReason: string; reasons: string[]; readers: number; pdfUrl: string | null; pdfSize: number | null }
export interface Fb { id: string; name: string; username: string; rating: number | null; kind: string; message: string; place: string; createdAt: string }
export interface AdminData { sections: Section[]; challenges: Chal[]; texts: Txt[]; phrases: Phr[]; reports: Rep[]; books: Bk[]; feedback: Fb[] }

type Tab = keyof typeof A.tabs;
const TABS = Object.keys(A.tabs) as Tab[];
const CONTEXTS = Object.keys(A.phrases.contextNames) as (keyof typeof A.phrases.contextNames)[];

const today = () => new Date().toISOString().slice(0, 10);

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 font-bold">
      <input type="checkbox" className="size-5" checked={checked} onChange={(e) => onChange(e.target.checked)} /> {label}
    </label>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-bold">{label}</span>
      {children}
    </label>
  );
}
function Contexts({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-3">
      {CONTEXTS.map((c) => (
        <Check key={c} label={A.phrases.contextNames[c]} checked={value.includes(c)} onChange={(on) => onChange(on ? [...value, c] : value.filter((x) => x !== c))} />
      ))}
    </div>
  );
}

/** The owner's dashboard for «لأجل المهدي». Every change goes through /api/admin/mahdi, which checks the owner again. */
export default function MahdiAdminTools({ data }: { data: AdminData }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("challenges");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(body: Record<string, unknown>, done: string = A.common.saved): Promise<boolean> {
    setBusy(true);
    setError("");
    setMsg("");
    try {
      await postJson("/api/admin/mahdi", body);
      setMsg(done);
      router.refresh();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  const ask = (action: string, id: string, extra: Record<string, unknown> = {}) => {
    if (confirm(A.common.confirm)) send({ action, id, ...extra }, A.common.done);
  };

  return (
    <div className="space-y-5">
      <div role="tablist" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {TABS.map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} className={`btn min-h-12 text-sm ${tab === k ? "btn-primary" : "btn-ghost"}`} onClick={() => setTab(k)}>
            {A.tabs[k]}
            {k === "reports" && data.reports.filter((r) => !r.hidden).length > 0 && ` (${data.reports.filter((r) => !r.hidden).length})`}
            {k === "books" && data.books.filter((b) => b.reasons.length && !b.hidden).length > 0 && ` (${data.books.filter((b) => b.reasons.length && !b.hidden).length})`}
          </button>
        ))}
      </div>

      {msg && <p className="card p-3 text-center font-extrabold" role="status">{msg}</p>}
      {error && <p className="error-box" role="alert">{error}</p>}

      {tab === "challenges" && <ChallengesTab data={data} send={send} ask={ask} busy={busy} />}
      {tab === "texts" && <TextsTab data={data} send={send} ask={ask} busy={busy} />}
      {tab === "phrases" && <PhrasesTab data={data} send={send} ask={ask} busy={busy} />}
      {tab === "reports" && <ReportsTab data={data} send={send} ask={ask} busy={busy} />}
      {tab === "books" && <BooksTab data={data} send={send} ask={ask} busy={busy} />}
      {tab === "feedback" && <FeedbackTab data={data} />}
    </div>
  );
}

interface TabProps {
  data: AdminData;
  send: (body: Record<string, unknown>, done?: string) => Promise<boolean>;
  ask: (action: string, id: string, extra?: Record<string, unknown>) => void;
  busy: boolean;
}

/* ───────── challenges and sections ───────── */
function ChallengesTab({ data, send, ask, busy }: TabProps) {
  const [sec, setSec] = useState<Partial<Section> | null>(null);
  const blank: Partial<Chal> = { section_id: data.sections[0]?.id, measure: "check", freq: "daily", target: 1, unit: "", starts_on: today(), ends_on: null, status: "draft", leaderboard: true, title: "", description: "", rules: "" };
  const [ch, setCh] = useState<Partial<Chal> | null>(null);
  const C = A.challenges;
  const locked = Boolean(ch?.id && (ch.members ?? 0) > 0);

  return (
    <div className="space-y-6">
      <section className="card space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl font-extrabold">{C.sections}</h2>
          <button className="btn btn-ghost px-4" onClick={() => setSec({ name: "", description: "", icon: "", sort_order: data.sections.length + 1, active: true })}>{C.newSection}</button>
        </div>
        <p className="text-sm font-bold text-muted">{C.sectionHint}</p>
        {sec && (
          <form
            className="space-y-3 rounded-2xl bg-surface-2 p-3"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await send({ action: "section.save", id: sec.id, name: sec.name, description: sec.description, icon: sec.icon, sortOrder: sec.sort_order, active: sec.active })) setSec(null);
            }}
          >
            <h3 className="font-extrabold">{sec.id ? C.editSection : C.newSection}</h3>
            <Field label={A.common.name}><input className="field" required maxLength={60} value={sec.name ?? ""} onChange={(e) => setSec({ ...sec, name: e.target.value })} /></Field>
            <Field label={A.common.description}><textarea className="field" rows={2} maxLength={500} value={sec.description ?? ""} onChange={(e) => setSec({ ...sec, description: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={A.common.icon}><input className="field" maxLength={8} value={sec.icon ?? ""} onChange={(e) => setSec({ ...sec, icon: e.target.value })} /></Field>
              <Field label={A.common.order}><input className="field" dir="ltr" inputMode="numeric" value={sec.sort_order ?? 0} onChange={(e) => setSec({ ...sec, sort_order: Number(e.target.value) || 0 })} /></Field>
            </div>
            <Check label={A.common.active} checked={Boolean(sec.active)} onChange={(v) => setSec({ ...sec, active: v })} />
            <div className="flex gap-2">
              <button className="btn btn-primary flex-1" disabled={busy}>{A.common.save}</button>
              <button type="button" className="btn btn-ghost flex-1" onClick={() => setSec(null)}>{A.common.cancel}</button>
            </div>
          </form>
        )}
        <ul className="space-y-2">
          {data.sections.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 rounded-2xl bg-surface-2 px-3 py-2 font-bold">
              <span>{s.icon} {s.name} {!s.active && <span className="text-sm text-muted">({A.common.active}: ✖)</span>}</span>
              <span className="flex gap-3 text-sm">
                <button className="underline" onClick={() => setSec(s)}>{A.common.edit}</button>
                <button className="text-muted underline" onClick={() => ask("section.delete", s.id)}>{A.common.delete}</button>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl font-extrabold">{C.challenges}</h2>
          <button className="btn btn-primary px-4" disabled={!data.sections.length} onClick={() => setCh(blank)}>{C.newChallenge}</button>
        </div>
        {!data.sections.length && <p className="font-bold text-muted">{C.noSection}</p>}
        {ch && (
          <form
            className="space-y-3 rounded-2xl bg-surface-2 p-3"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await send({ action: "challenge.save", id: ch.id, sectionId: ch.section_id, title: ch.title, description: ch.description, rules: ch.rules, measure: ch.measure, target: ch.target, unit: ch.unit, freq: ch.freq, startsOn: ch.starts_on, endsOn: ch.ends_on || null, leaderboard: ch.leaderboard, status: ch.status })) setCh(null);
            }}
          >
            <h3 className="font-extrabold">{ch.id ? C.editChallenge : C.newChallenge}</h3>
            {locked && <p className="text-sm font-bold text-muted">{C.locked}</p>}
            <Field label={C.section}>
              <select className="field" value={ch.section_id} onChange={(e) => setCh({ ...ch, section_id: e.target.value })}>
                {data.sections.map((s) => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
              </select>
            </Field>
            <Field label={C.title}><input className="field" required maxLength={80} value={ch.title ?? ""} onChange={(e) => setCh({ ...ch, title: e.target.value })} /></Field>
            <Field label={A.common.description}><textarea className="field" rows={2} maxLength={1000} value={ch.description ?? ""} onChange={(e) => setCh({ ...ch, description: e.target.value })} /></Field>
            <Field label={C.rules}><textarea className="field" rows={3} maxLength={2000} value={ch.rules ?? ""} onChange={(e) => setCh({ ...ch, rules: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={C.measure}>
                <select className="field" disabled={locked} value={ch.measure} onChange={(e) => setCh({ ...ch, measure: e.target.value as Chal["measure"], target: e.target.value === "check" && ch.freq === "daily" ? 1 : ch.target })}>
                  {(Object.keys(C.measures) as (keyof typeof C.measures)[]).map((m) => <option key={m} value={m}>{C.measures[m]}</option>)}
                </select>
              </Field>
              <Field label={C.freq}>
                <select className="field" disabled={locked} value={ch.freq} onChange={(e) => setCh({ ...ch, freq: e.target.value as Chal["freq"], target: ch.measure === "check" && e.target.value === "daily" ? 1 : ch.target })}>
                  {(Object.keys(C.freqs) as (keyof typeof C.freqs)[]).map((f) => <option key={f} value={f}>{C.freqs[f]}</option>)}
                </select>
              </Field>
              <Field label={C.target}><input className="field" dir="ltr" inputMode="decimal" disabled={locked || (ch.measure === "check" && ch.freq === "daily")} value={ch.target ?? ""} onChange={(e) => setCh({ ...ch, target: Number(e.target.value) })} /></Field>
              {ch.measure === "amount" && <Field label={C.unit}><input className="field" disabled={locked} maxLength={20} value={ch.unit ?? ""} onChange={(e) => setCh({ ...ch, unit: e.target.value })} /></Field>}
              <Field label={C.startsOn}><input type="date" className="field" dir="ltr" required disabled={locked} value={ch.starts_on ?? ""} onChange={(e) => setCh({ ...ch, starts_on: e.target.value })} /></Field>
              <Field label={C.endsOn}><input type="date" className="field" dir="ltr" value={ch.ends_on ?? ""} onChange={(e) => setCh({ ...ch, ends_on: e.target.value || null })} /></Field>
            </div>
            <Check label={C.leaderboard} checked={Boolean(ch.leaderboard)} onChange={(v) => setCh({ ...ch, leaderboard: v })} />
            <div className="flex gap-2">
              <button className="btn btn-primary flex-1" disabled={busy}>{A.common.save}</button>
              <button type="button" className="btn btn-ghost flex-1" onClick={() => setCh(null)}>{A.common.cancel}</button>
            </div>
          </form>
        )}
        <ul className="space-y-2">
          {data.challenges.length === 0 && <li className="font-bold text-muted">{A.common.none}</li>}
          {data.challenges.map((c) => {
            const section = data.sections.find((s) => s.id === c.section_id);
            return (
              <li key={c.id} className="space-y-2 rounded-2xl bg-surface-2 px-3 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2 font-bold">
                  <span>{section?.icon} {c.title}</span>
                  <span className="text-sm text-muted">{C.status[c.status]} · {C.members(c.members)}</span>
                </div>
                <div className="flex flex-wrap gap-3 text-sm font-bold">
                  <button className="underline" onClick={() => setCh(c)}>{A.common.edit}</button>
                  {c.status !== "published" && <button className="underline" onClick={() => send({ action: "challenge.status", id: c.id, status: "published" }, A.common.done)}>{c.status === "archived" ? C.restore : C.publish}</button>}
                  {c.status === "published" && <button className="underline" onClick={() => send({ action: "challenge.status", id: c.id, status: "archived" }, A.common.done)}>{C.archive}</button>}
                  {c.status === "published" && c.members === 0 && <button className="underline" onClick={() => send({ action: "challenge.status", id: c.id, status: "draft" }, A.common.done)}>{C.unpublish}</button>}
                  {c.members === 0 && <button className="text-muted underline" onClick={() => ask("challenge.delete", c.id)}>{A.common.delete}</button>}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

/* ───────── religious texts ───────── */
function TextsTab({ data, send, ask, busy }: TabProps) {
  const X = A.texts;
  const blank: Partial<Txt> = { kind: "hadith", text: "", attribution: "", source: "", reference: "", verification_status: "pending", verified_by: "", notes: "", contexts: ["home"], active: true };
  const [tx, setTx] = useState<Partial<Txt> | null>(null);
  return (
    <section className="card space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl font-extrabold">{A.tabs.texts}</h2>
        <button className="btn btn-primary px-4" onClick={() => setTx(blank)}>{X.new}</button>
      </div>
      <p className="text-sm font-bold text-muted">{X.intro}</p>
      <p className="card p-3 text-sm font-bold">{X.warn}</p>
      {tx && (
        <form
          className="space-y-3 rounded-2xl bg-surface-2 p-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await send({ action: "text.save", id: tx.id, kind: tx.kind, text: tx.text, attribution: tx.attribution, source: tx.source, reference: tx.reference, verificationStatus: tx.verification_status, verifiedBy: tx.verified_by, notes: tx.notes, contexts: tx.contexts, active: tx.active })) setTx(null);
          }}
        >
          <h3 className="font-extrabold">{tx.id ? X.edit : X.new}</h3>
          <Field label={X.kind}>
            <select className="field" value={tx.kind} onChange={(e) => setTx({ ...tx, kind: e.target.value })}>
              {(Object.keys(X.kinds) as (keyof typeof X.kinds)[]).map((k) => <option key={k} value={k}>{X.kinds[k]}</option>)}
            </select>
          </Field>
          <Field label={X.text}><textarea className="field" rows={4} required maxLength={2000} value={tx.text ?? ""} onChange={(e) => setTx({ ...tx, text: e.target.value })} /></Field>
          <Field label={X.attribution}><input className="field" maxLength={200} value={tx.attribution ?? ""} onChange={(e) => setTx({ ...tx, attribution: e.target.value })} /></Field>
          <Field label={X.source}><input className="field" required maxLength={300} value={tx.source ?? ""} onChange={(e) => setTx({ ...tx, source: e.target.value })} /></Field>
          <Field label={X.reference}><input className="field" maxLength={300} value={tx.reference ?? ""} onChange={(e) => setTx({ ...tx, reference: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={X.verification}>
              <select className="field" value={tx.verification_status} onChange={(e) => setTx({ ...tx, verification_status: e.target.value as Txt["verification_status"] })}>
                {(Object.keys(X.statuses) as (keyof typeof X.statuses)[]).map((k) => <option key={k} value={k}>{X.statuses[k]}</option>)}
              </select>
            </Field>
            {tx.verification_status === "verified" && <Field label={X.verifiedBy}><input className="field" required maxLength={120} value={tx.verified_by ?? ""} onChange={(e) => setTx({ ...tx, verified_by: e.target.value })} /></Field>}
          </div>
          <Field label={X.notes}><textarea className="field" rows={2} maxLength={1000} value={tx.notes ?? ""} onChange={(e) => setTx({ ...tx, notes: e.target.value })} /></Field>
          <div className="space-y-1"><span className="text-sm font-bold">{X.contexts}</span><Contexts value={tx.contexts ?? []} onChange={(v) => setTx({ ...tx, contexts: v })} /></div>
          <Check label={A.common.active} checked={Boolean(tx.active)} onChange={(v) => setTx({ ...tx, active: v })} />
          <div className="flex gap-2">
            <button className="btn btn-primary flex-1" disabled={busy}>{A.common.save}</button>
            <button type="button" className="btn btn-ghost flex-1" onClick={() => setTx(null)}>{A.common.cancel}</button>
          </div>
        </form>
      )}
      <ul className="space-y-2">
        {data.texts.length === 0 && <li className="font-bold text-muted">{A.common.none}</li>}
        {data.texts.map((x) => (
          <li key={x.id} className="space-y-1 rounded-2xl bg-surface-2 px-3 py-3">
            <p className="text-sm font-bold text-muted">{X.kinds[x.kind as keyof typeof X.kinds]} · {X.statuses[x.verification_status]}{!x.active && " · ✖"}</p>
            <p className="whitespace-pre-line font-bold">{x.text}</p>
            <p className="text-sm text-muted">{x.source}{x.reference && ` — ${x.reference}`}</p>
            <div className="flex gap-3 text-sm font-bold">
              <button className="underline" onClick={() => setTx(x)}>{A.common.edit}</button>
              <button className="text-muted underline" onClick={() => ask("text.delete", x.id)}>{A.common.delete}</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ───────── motivational phrases ───────── */
function PhrasesTab({ data, send, ask, busy }: TabProps) {
  const P = A.phrases;
  const [ph, setPh] = useState<Partial<Phr> | null>(null);
  return (
    <section className="card space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl font-extrabold">{A.tabs.phrases}</h2>
        <button className="btn btn-primary px-4" onClick={() => setPh({ text: "", contexts: ["home"], active: true, sort_order: data.phrases.length + 1 })}>{P.new}</button>
      </div>
      <p className="text-sm font-bold text-muted">{P.intro}</p>
      {ph && (
        <form
          className="space-y-3 rounded-2xl bg-surface-2 p-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await send({ action: "phrase.save", id: ph.id, text: ph.text, contexts: ph.contexts, active: ph.active, sortOrder: ph.sort_order })) setPh(null);
          }}
        >
          <h3 className="font-extrabold">{ph.id ? P.edit : P.new}</h3>
          <Field label={P.text}><textarea className="field" rows={2} required maxLength={200} value={ph.text ?? ""} onChange={(e) => setPh({ ...ph, text: e.target.value })} /></Field>
          <div className="space-y-1"><span className="text-sm font-bold">{P.contexts}</span><Contexts value={ph.contexts ?? []} onChange={(v) => setPh({ ...ph, contexts: v })} /></div>
          <Field label={A.common.order}><input className="field" dir="ltr" inputMode="numeric" value={ph.sort_order ?? 0} onChange={(e) => setPh({ ...ph, sort_order: Number(e.target.value) || 0 })} /></Field>
          <Check label={A.common.active} checked={Boolean(ph.active)} onChange={(v) => setPh({ ...ph, active: v })} />
          <div className="flex gap-2">
            <button className="btn btn-primary flex-1" disabled={busy}>{A.common.save}</button>
            <button type="button" className="btn btn-ghost flex-1" onClick={() => setPh(null)}>{A.common.cancel}</button>
          </div>
        </form>
      )}
      <ul className="space-y-2">
        {data.phrases.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-surface-2 px-3 py-2">
            <span className="min-w-0 flex-1">
              <span className="block font-bold">{p.text}{!p.active && " ✖"}</span>
              <span className="block text-sm text-muted">{p.contexts.map((c) => P.contextNames[c as keyof typeof P.contextNames] ?? c).join("، ")}</span>
            </span>
            <span className="flex gap-3 text-sm font-bold">
              <button className="underline" onClick={() => setPh(p)}>{A.common.edit}</button>
              <button className="text-muted underline" onClick={() => ask("phrase.delete", p.id)}>{A.common.delete}</button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ───────── reports and moderation ───────── */
function ReportsTab({ data, send, ask, busy }: TabProps) {
  const R = A.reports;
  const [reason, setReason] = useState<Record<string, string>>({});
  return (
    <section className="card space-y-3 p-4">
      <h2 className="text-xl font-extrabold">{A.tabs.reports}</h2>
      <p className="text-sm font-bold text-muted">{R.intro}</p>
      <ul className="space-y-3">
        {data.reports.length === 0 && <li className="font-bold text-muted">{R.empty}</li>}
        {data.reports.map((r) => (
          <li key={r.id} className="space-y-2 rounded-2xl bg-surface-2 px-3 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2 font-bold">
              <span>{r.title} · <span dir="ltr">{r.value}</span></span>
              <span className="text-sm text-muted">{r.hidden ? R.hidden : R.count(r.count)}</span>
            </div>
            <p className="text-sm text-muted">{R.by}: {r.author || "—"}</p>
            {r.reasons.length > 0 && (
              <ul className="list-disc ps-5 text-sm">
                {r.reasons.slice(0, 5).map((x, i) => <li key={i}>{x || R.noReason}</li>)}
              </ul>
            )}
            {r.hidden && r.hiddenReason && <p className="text-sm text-muted">{r.hiddenReason}</p>}
            <div className="flex flex-wrap items-end gap-2">
              {!r.hidden && (
                <input className="field min-w-40 flex-1" maxLength={200} placeholder={R.reasonLabel} value={reason[r.id] ?? ""} onChange={(e) => setReason({ ...reason, [r.id]: e.target.value })} aria-label={R.reasonLabel} />
              )}
              {r.hidden ? (
                <button className="btn btn-ghost px-4" disabled={busy} onClick={() => send({ action: "post.unhide", id: r.id }, A.common.done)}>{R.unhide}</button>
              ) : (
                <button className="btn btn-primary px-4" disabled={busy} onClick={() => send({ action: "post.hide", id: r.id, reason: reason[r.id] ?? "" }, A.common.done)}>{R.hide}</button>
              )}
              {r.count > 0 && <button className="btn btn-ghost px-4" disabled={busy} onClick={() => ask("reports.dismiss", "", { postId: r.id })}>{R.dismiss}</button>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ───────── shared book catalogue ───────── */
function BooksTab({ data, send, busy }: TabProps) {
  const B = A.books;
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<(Bk & { removeCover?: boolean }) | null>(null);
  const [reason, setReason] = useState<Record<string, string>>({});
  const list = data.books.filter((b) => !q.trim() || b.title.includes(q.trim()));
  return (
    <section className="card space-y-3 p-4">
      <h2 className="text-xl font-extrabold">{A.tabs.books}</h2>
      <p className="text-sm font-bold text-muted">{B.intro}</p>
      <input className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder={B.search} aria-label={B.search} />
      {edit && (
        <form
          className="space-y-3 rounded-2xl bg-surface-2 p-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await send({ action: "book.save", id: edit.id, title: edit.title, author: edit.author, pages: edit.pages, unit: edit.unit, description: edit.description, removeCover: Boolean(edit.removeCover) })) setEdit(null);
          }}
        >
          <h3 className="font-extrabold">{B.edit}</h3>
          <Field label={B.title}><input className="field" required maxLength={120} value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={B.author}><input className="field" maxLength={80} value={edit.author} onChange={(e) => setEdit({ ...edit, author: e.target.value })} /></Field>
            <Field label={B.pages}><input className="field" dir="ltr" inputMode="numeric" value={edit.pages} onChange={(e) => setEdit({ ...edit, pages: Number(e.target.value) || 0 })} /></Field>
          </div>
          <Field label={t.reading.kind}>
            <select className="field" value={edit.unit} onChange={(e) => setEdit({ ...edit, unit: e.target.value === "narration" ? "narration" : "page" })}>
              <option value="page">{t.reading.kinds.page}</option>
              <option value="narration">{t.reading.kinds.narration}</option>
            </select>
          </Field>
          <Field label={B.description}><textarea className="field" rows={3} maxLength={500} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
          {edit.coverUrl && <Check label={B.removeCover} checked={Boolean(edit.removeCover)} onChange={(v) => setEdit({ ...edit, removeCover: v })} />}
          <div className="flex gap-2">
            <button className="btn btn-primary flex-1" disabled={busy}>{A.common.save}</button>
            <button type="button" className="btn btn-ghost flex-1" onClick={() => setEdit(null)}>{A.common.cancel}</button>
          </div>
        </form>
      )}
      <ul className="space-y-3">
        {list.length === 0 && <li className="font-bold text-muted">{B.empty}</li>}
        {list.map((b) => (
          <li key={b.id} className="flex gap-3 rounded-2xl bg-surface-2 px-3 py-3">
            {b.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={b.coverUrl} alt="" width={56} height={84} className="h-[84px] w-14 shrink-0 rounded object-cover" />
            ) : (
              <span className="grid h-[84px] w-14 shrink-0 place-items-center rounded bg-surface text-xs font-bold text-muted">📖</span>
            )}
            <div className="min-w-0 flex-1 space-y-1">
              <p className="font-bold">{b.title} {b.hidden && <span className="text-sm text-muted">({B.hidden})</span>}</p>
              <p className="text-sm text-muted">{b.author && `${b.author} · `}{t.reading.u[b.unit].count(b.pages)} · {B.readers(b.readers)}{b.reasons.length > 0 && ` · ${B.reports(b.reasons.length)}`}</p>
              {b.reasons.length > 0 && (
                <ul className="list-disc ps-5 text-sm">
                  {b.reasons.slice(0, 5).map((r, i) => <li key={i}>{r || A.reports.noReason}</li>)}
                </ul>
              )}
              {b.hidden && b.hiddenReason && <p className="text-sm text-muted">{b.hiddenReason}</p>}
              {b.pdfUrl && (
                <p className="flex flex-wrap gap-3 text-sm font-bold">
                  <a href={b.pdfUrl} target="_blank" rel="noreferrer" className="underline">{B.pdf(`${((b.pdfSize ?? 0) / 1024 / 1024).toFixed(1)} MB`)}</a>
                  <button className="text-muted underline" disabled={busy} onClick={() => confirm(A.common.confirm) && send({ action: "book.pdf.remove", id: b.id }, A.common.done)}>{B.pdfRemove}</button>
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2 pt-1 text-sm font-bold">
                <button className="underline" onClick={() => setEdit(b)}>{A.common.edit}</button>
                {b.hidden ? (
                  <button className="underline" disabled={busy} onClick={() => send({ action: "book.unhide", id: b.id }, A.common.done)}>{B.unhide}</button>
                ) : (
                  <>
                    <input className="field min-w-32 flex-1 text-sm" maxLength={200} placeholder={B.reasonLabel} aria-label={B.reasonLabel} value={reason[b.id] ?? ""} onChange={(e) => setReason({ ...reason, [b.id]: e.target.value })} />
                    <button className="underline" disabled={busy} onClick={() => send({ action: "book.hide", id: b.id, reason: reason[b.id] ?? "" }, A.common.done)}>{B.hide}</button>
                  </>
                )}
                {b.reasons.length > 0 && <button className="text-muted underline" disabled={busy} onClick={() => send({ action: "book.dismiss", id: b.id }, A.common.done)}>{B.dismiss}</button>}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ───────── feedback («شاركنا رأيك») ───────── */
function FeedbackTab({ data }: { data: AdminData }) {
  const FB = A.feedback;
  const K = t.feedback.kinds as Record<string, string>;
  const [kind, setKind] = useState("");
  const rated = data.feedback.filter((f) => f.rating !== null);
  const avg = rated.length ? (rated.reduce((n, f) => n + (f.rating ?? 0), 0) / rated.length).toFixed(1) : "";
  const list = data.feedback.filter((f) => !kind || f.kind === kind);
  return (
    <section className="card space-y-3 p-4">
      <h2 className="text-xl font-extrabold">{A.tabs.feedback}</h2>
      <p className="text-sm font-bold text-muted">{FB.intro}</p>
      <p className="font-extrabold">
        {FB.total(data.feedback.length)}
        {avg && ` · ${FB.average(avg, rated.length)}`}
      </p>
      <div className="flex flex-wrap gap-2">
        {["", ...Object.keys(K)].map((k) => (
          <button key={k || "all"} type="button" className={`chip ${kind === k ? "ring-2 ring-gold" : ""}`} aria-pressed={kind === k} onClick={() => setKind(k)}>
            {k ? K[k] : FB.all} ({k ? data.feedback.filter((f) => f.kind === k).length : data.feedback.length})
          </button>
        ))}
      </div>
      <ul className="space-y-3">
        {list.length === 0 && <li className="font-bold text-muted">{FB.empty}</li>}
        {list.map((f) => (
          <li key={f.id} className="space-y-1 rounded-2xl bg-surface-2 px-3 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2 font-bold">
              <span>
                <bdi dir="auto">{f.name || "—"}</bdi>
                {f.username && <span className="ms-2 text-sm text-muted"><bdi dir="auto">@{f.username}</bdi></span>}
              </span>
              {f.rating !== null && <span aria-label={`${f.rating}/5`}>{"⭐".repeat(f.rating)}</span>}
            </div>
            <p className="whitespace-pre-line" dir="auto">{f.message || FB.noMessage}</p>
            <p className="text-xs font-bold text-muted">
              {K[f.kind] ?? f.kind} · {FB.places[f.place] ?? f.place} · {new Date(f.createdAt).toLocaleString("ar-SA", { timeZone: "Asia/Riyadh", dateStyle: "medium", timeStyle: "short" })}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
