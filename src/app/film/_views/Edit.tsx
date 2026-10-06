import Link from "next/link";
import { redirect } from "next/navigation";
import { requireFilmUser, requireProject } from "@/lib/film/access";
import { editorForFilm, filmCut } from "@/lib/editor/film";
import OpenEdit from "../[id]/edit/OpenEdit";

/** «المونتاج»: the film's chosen videos in the director's order, then «حيدر كات» puts them together. */
export default async function EditView({ id, base }: { id: string; base: string }) {
  const { user, allowed } = await requireFilmUser(`${base}/${id}/edit`);
  if (!allowed) redirect(base);
  const project = await requireProject(id, user.id);
  if (project.stage === "screenwriter") redirect(`${base}/${id}/script`);
  if (project.stage === "sheets") redirect(`${base}/${id}/sheets`);
  const [cut, editId] = await Promise.all([filmCut(id), editorForFilm(id).catch(() => null)]);
  const ready = cut.filter((c) => c.video);
  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <Link href={`${base}/${id}`} className="text-sm font-bold text-muted">→ {project.title}</Link>
        <h1 className="display text-4xl">✂️ المونتاج</h1>
        <p className="text-sm font-bold text-muted">
          آخر خطوة: «حيدر كات» يركّب مقاطع فيلمك بترتيب المخرج (بأصواتها) في نسخة أولى، وبعدها تقص وترتّب وتضيف نصوصًا وتصدّر الفيلم كاملًا بدقة 720p أو 1080p.
        </p>
      </header>

      <section className="card space-y-3 p-4">
        <h2 className="font-extrabold">خطة النسخة الأولى</h2>
        {cut.length ? (
          <ol className="space-y-1.5 text-sm">
            {cut.map((c, i) => (
              <li key={c.genId} className="flex items-center gap-2">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-extrabold">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate font-bold">{c.name}</span>
                <span className={`shrink-0 text-xs font-bold ${c.video ? "text-teal" : "text-muted"}`}>
                  {c.video ? `${c.video.durationSec ?? "?"} ث ${c.video.approved ? "· معتمد" : "· آخر توليد"}` : c.removed ? "انحذف بعد ٧ أيام" : "ما تولّد بعد"}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted">ما فيه توليدات معتمدة بعد.</p>
        )}
        {ready.length < cut.length && ready.length > 0 && <p className="text-xs font-bold text-muted">المقاطع اللي ما تولّدت تقدر تضيفها بعدين من «من أعمالي» داخل حيدر كات.</p>}
        <OpenEdit filmId={id} exists={!!editId} disabled={!ready.length} />
        <p className="text-xs text-muted">بعد تصدير الفيلم بـ٣ أيام تنحذف ملفات المونتاج، والفيديوهات اللي في المونتاج ما تنحذف قبلها.</p>
      </section>
    </div>
  );
}
