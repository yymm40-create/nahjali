import Link from "next/link";
import { redirect } from "next/navigation";
import { requireFilmUser, requireProject } from "@/lib/film/access";
import { directorVideos } from "@/lib/film/director";
import { FILM_BUCKET } from "@/lib/film/types";
import { editorForFilm, filmCut, successfulScene } from "@/lib/editor/film";
import { storage } from "@/lib/storage";
import OpenEdit from "../[id]/edit/OpenEdit";
import SaveScene from "../[id]/edit/SaveScene";
import MontagePanel from "../stage/MontagePanel";

/** «المونتاج»: the film's chosen videos in the director's order, then «حيدرة كت» puts them together. */
export default async function EditView({ id, base }: { id: string; base: string }) {
  const { user, allowed } = await requireFilmUser(`${base}/${id}/edit`);
  if (!allowed) redirect(base);
  const project = await requireProject(id, user.id);
  if (project.stage === "screenwriter") redirect(`${base}/${id}/script`);
  if (project.stage === "sheets") redirect(`${base}/${id}/sheets`);
  const [cut, editId, scene] = await Promise.all([filmCut(id), editorForFilm(id).catch(() => null), successfulScene(id).catch(() => null)]);
  const ready = cut.filter((c) => c.video);

  if (!project.series_id) {
    // the stage: the takes play on one screen here, with short-lived links to their files
    const videos = await directorVideos(id);
    const paths = cut.map((c) => (c.video ? videos.find((v) => v.id === c.video!.id)?.storage_path ?? null : null));
    const have = paths.filter((p): p is string => Boolean(p));
    const signed = have.length ? ((await storage.from(FILM_BUCKET).createSignedUrls(have, 3600)).data ?? []) : [];
    const url: Record<string, string> = {};
    signed.forEach((s, i) => s.signedUrl && (url[have[i]] = s.signedUrl));
    return (
      <div className="space-y-4">
        <header className="space-y-1">
          <h1 className="display text-2xl">✂️ المونتاج</h1>
          <p className="text-sm font-bold text-muted">شوف المشهد كاملًا هنا أول (اللقطات وراء بعض بترتيب المخرج)، واكتب ملاحظتك على أي لقطة، ثم افتحه في «حيدرة كت» للقص والتصدير.</p>
        </header>
        <MontagePanel
          filmId={id}
          filmTitle={project.title}
          editExists={!!editId}
          scene={scene ? { url: scene.url } : null}
          takes={cut.map((c, i) => ({ genId: c.genId, name: c.name, videoId: c.video?.id ?? null, url: paths[i] ? (url[paths[i]!] ?? "") : "", note: c.video?.note ?? "", durationSec: c.video?.durationSec ?? c.plannedSec, approved: Boolean(c.video?.approved), removed: c.removed }))}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <Link href={`${base}/${id}`} className="text-sm font-bold text-muted">→ {project.title}</Link>
        <h1 className="display text-4xl">✂️ المونتاج</h1>
        <p className="text-sm font-bold text-muted">
          آخر خطوة: «حيدرة كت» يركّب مقاطع فيلمك بترتيب المخرج (بأصواتها) في نسخة أولى، وبعدها تقص وترتّب وتضيف نصوصًا وتصدّر الفيلم كاملًا بدقة 720p أو 1080p.
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
        {ready.length < cut.length && ready.length > 0 && <p className="text-xs font-bold text-muted">المقاطع اللي ما تولّدت تقدر تضيفها بعدين من «من أعمالي» داخل حيدرة كت.</p>}
        <OpenEdit filmId={id} exists={!!editId} disabled={!ready.length} filmTitle={project.title} cut={cut.map((c) => ({ genId: c.genId, name: c.name, videoId: c.video?.id ?? null, note: c.video?.note ?? "" }))} />
        <p className="text-xs text-muted">بعد تصدير الفيلم بـ٣ أيام تنحذف ملفات المونتاج، والفيديوهات اللي في المونتاج ما تنحذف قبلها.</p>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="font-extrabold">🏆 المشهد الناجح</h2>
        <p className="text-sm font-bold text-muted">خلصت المونتاج وصدّرته من «صدّر» داخل حيدرة كت؟ احفظه هنا: يبقى محفوظ في الموقع (ما ينحذف مثل ملفات المونتاج)، ومنه تنبني حلقات «المسلسل الذكي».</p>
        {scene && <video src={scene.url} controls playsInline className="w-full rounded-xl bg-black" />}
        <SaveScene filmId={id} saved={!!scene} disabled={!editId} />
      </section>
    </div>
  );
}
