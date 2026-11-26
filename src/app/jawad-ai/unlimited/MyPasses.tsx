import TryModel from "@/components/jawad/models/TryModel";
import type { UnlimitedUse } from "@/lib/jawad/server/unlimited";

const when = (iso: string) => new Date(iso).toLocaleString("ar-SA-u-ca-gregory-nu-latn", { timeZone: "Asia/Riyadh", weekday: "long", hour: "numeric", minute: "2-digit" });

/** The passes running for this person: until when, what is left of the fast balance, and a button to use it now. */
export default function MyPasses({ passes }: { passes: UnlimitedUse[] }) {
  return (
    <section className="ul-in ul-mine" aria-label="لامحدودك">
      <h2 className="ul-h2">لامحدودك الشغّال</h2>
      <ul>
        {passes.map((p) => (
          <li key={p.pass + p.until} className="ul-mine-c">
            <div>
              <b dir="ltr">{p.name}{p.quality ? ` · ${p.quality}` : ""}</b>
              <span>لامحدود لين {when(p.until)}</span>
              <span className="ul-fast">
                {p.fastLeft > 0 ? `⚡ باقي لك سريع: ${p.fastLeft} ${p.kind === "video" ? "ثانية" : "صورة"}` : "السريع خلص، توليدك يكمل بس أبطأ"}
                {p.refill ? ` · يرجع كامل ${when(p.refill)}` : ""}
              </span>
            </div>
            <TryModel id={p.generatorId} name={p.name} className="ul-btn ul-btn-s" />
          </li>
        ))}
      </ul>
      {passes.some((p) => p.kind === "video") && <p className="ul-note">اختر نفس الدقة اللي اشتريتها، وخل الفيديو ١٥ ثانية أو أقل، عشان يطلع مجاني.</p>}
    </section>
  );
}
