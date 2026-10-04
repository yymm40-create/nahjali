import GeneratorsAdmin from "@/components/jawad/admin/GeneratorsAdmin";
import Icon from "@/components/jawad/Icon";
import { loadRuntime } from "@/lib/jawad/server/runtime";
import { GENERATORS } from "@config/jawad/generators";

export const metadata = { title: "المولدات" };

/** Each integration: shown name, sample picture, section, order, switch — plus its documented capabilities and sources. */
export default async function GeneratorsPage() {
  const rt = await loadRuntime();
  return (
    <div className="space-y-8">
      <GeneratorsAdmin
        generators={GENERATORS.map((d) => {
          const r = rt.generators.find((g) => g.id === d.id)!;
          return {
            id: d.id,
            defaultName: d.name,
            displayName: r.name === d.name ? "" : r.name,
            provider: d.provider.label,
            model: d.model.id,
            output: d.output,
            sectionId: r.sectionId,
            sort: r.sort,
            enabled: r.enabled,
            sampleUrl: r.sampleUrl,
            keyConfigured: r.keyConfigured,
            live: r.live,
            reason: r.reason,
            sections: rt.sections.filter((s) => s.output === d.output).map((s) => ({ id: s.id, name: s.name })),
          };
        })}
      />

      <section className="space-y-4">
        <h2 className="font-semibold">توثيق القدرات (من وثائق API الرسمية)</h2>
        <p className="text-sm text-jw-muted">
          القدرات والقيود والأسعار مأخوذة من وثائق المزوّد الرسمية لواجهة API نفسها (وليس من موقعه للمستهلك). ما لم يمكن التحقق منه معلَّم «غير متحقق» وخياره موقوف.
          لم يُختبر أي تكامل حيًا من هذه البيئة (لا مفاتيح متاحة فيها)؛ جرّب كل مولد بنفسك قبل تفعيله.
        </p>
        {GENERATORS.map((d) => (
          <details key={d.id} className="jw-panel p-4">
            <summary className="cursor-pointer font-medium">
              <span dir="ltr">{d.name}</span> <span className="text-xs text-jw-muted" dir="ltr">· {d.provider.label} · {d.model.id} · {d.api.endpoint}</span>
            </summary>
            <div className="mt-3 space-y-3 text-sm">
              <div className="flex flex-wrap gap-1.5">
                <span className="jw-chip">المخرجات: {d.output === "image" ? "صورة" : d.output === "video" ? "فيديو" : "صوت"}</span>
                <span className="jw-chip">المتابعة: {d.api.tracking === "sync" ? "طلب متزامن" : "مهمة + إشعار + استعلام"}</span>
                <span className="jw-chip">نسبة التقدم: {d.api.progress === "percent" ? "حقيقية" : "غير متاحة (مؤشر غير محدد)"}</span>
                <span className="jw-chip">الإلغاء: {d.api.cancel === "none" ? "غير متاح" : "في الطابور فقط"}</span>
              </div>
              <table className="w-full text-start text-xs">
                <tbody>
                  {d.verification.map((v) => (
                    <tr key={v.item} className="border-b border-jw-line last:border-0 align-top">
                      <td className="w-28 py-2 pe-2 font-medium">{v.item}</td>
                      <td className="w-24 py-2 pe-2">
                        <span className={`inline-flex items-center gap-1 ${v.status === "verified" ? "text-jw-ok" : "text-jw-warn"}`}>
                          <Icon name={v.status === "verified" ? "check" : "alert"} size={12} /> {v.status === "verified" ? "متحقق" : "غير متحقق"}
                        </span>
                      </td>
                      <td className="py-2 text-jw-muted">{v.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <ul className="space-y-1 text-xs">
                {d.sources.map((s) => (
                  <li key={s.url}>
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-jw-accent underline" dir="ltr">{s.label}</a> <span className="text-jw-faint">· تحقق {s.checked}</span>
                  </li>
                ))}
              </ul>
            </div>
          </details>
        ))}
      </section>
    </div>
  );
}
