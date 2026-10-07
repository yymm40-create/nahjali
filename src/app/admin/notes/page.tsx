import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@config/site";
import NoteActions from "./NoteActions";

export const metadata = { title: "الملاحظات | لوحة التحكم" };
export const dynamic = "force-dynamic";

interface Note {
  id: string;
  name: string;
  email: string | null;
  note: string;
  path: string;
  x: number | null;
  y: number | null;
  vx: number | null;
  vy: number | null;
  target: string;
  viewport: string;
  status: "new" | "done";
  created_at: string;
}

const fmt = (iso: string) => new Date(iso).toLocaleString("ar", { timeZone: "Asia/Riyadh", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
/** The page, with ?note=… so its pin shows where it was left. */
const pinLink = (n: Note) => `${n.path}${n.path.includes("?") ? "&" : "?"}note=${n.id}`;

/** «الملاحظات»: what people left with «الملاحظ حسن», each with the page and the spot. */
export default async function NotesPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const user = await requireUser("/admin/notes");
  if (!isAdmin(user.email)) notFound();
  const show = (await searchParams).show === "done" ? "done" : (await searchParams).show === "all" ? "all" : "new";
  let q = createAdminClient().from("site_notes").select("*").order("created_at", { ascending: false }).limit(300);
  if (show !== "all") q = q.eq("status", show);
  const { data, error } = await q;
  const notes = (data ?? []) as Note[];

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <Link href="/admin" className="text-sm font-bold text-muted">→ لوحة التحكم</Link>
        <h1 className="display text-4xl">📝 الملاحظات</h1>
        <p className="text-sm font-bold text-muted">من «الملاحظ حسن»: كل ملاحظة بصفحتها ومكانها بالضبط. «افتح المكان» يفتح الصفحة ويحط الدبوس 📍 وين انكتبت.</p>
      </header>
      {error && <p className="error-box">قسم الملاحظات ما انضاف للحين: شغّل الملف <span dir="ltr">supabase/migrations/0035_site_access_and_notes.sql</span> في Supabase.</p>}
      <nav className="flex gap-2">
        {(
          [
            ["new", "الجديدة"],
            ["done", "اللي تمت"],
            ["all", "الكل"],
          ] as const
        ).map(([k, label]) => (
          <Link key={k} href={`/admin/notes?show=${k}`} className={`chip ${show === k ? "bg-gold text-on-gold" : ""}`}>
            {label}
          </Link>
        ))}
      </nav>
      <ul className="space-y-3">
        {notes.map((n) => (
          <li key={n.id} className={`card space-y-2 p-4 ${n.status === "done" ? "opacity-60" : ""}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-extrabold">
                {n.name} <span className="text-xs font-bold text-muted" dir="ltr">{n.email}</span>
              </p>
              <span className="text-xs font-bold text-muted">{fmt(n.created_at)}</span>
            </div>
            <p className="whitespace-pre-wrap font-bold">{n.note}</p>
            <dl className="grid gap-1 rounded-2xl bg-surface-2 p-3 text-xs font-bold text-muted sm:grid-cols-2">
              <div>
                <dt className="inline">الصفحة: </dt>
                <dd className="inline" dir="ltr">{n.path}</dd>
              </div>
              <div>
                <dt className="inline">المكان في الصفحة: </dt>
                <dd className="inline" dir="ltr">{n.x ?? "—"}, {n.y ?? "—"} px</dd>
              </div>
              <div>
                <dt className="inline">المكان في الشاشة: </dt>
                <dd className="inline" dir="ltr">{n.vx ?? "—"}, {n.vy ?? "—"} px · {n.viewport || "—"}</dd>
              </div>
              <div>
                <dt className="inline">على: </dt>
                <dd className="inline">{n.target || "—"}</dd>
              </div>
            </dl>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <a href={pinLink(n)} target="_blank" rel="noreferrer" className="btn btn-ghost min-h-9 px-3 text-xs">
                📍 افتح المكان
              </a>
              <NoteActions id={n.id} status={n.status} />
            </div>
          </li>
        ))}
      </ul>
      {!error && !notes.length && <p className="text-center font-bold text-muted">ما فيه ملاحظات هنا.</p>}
    </div>
  );
}
