"use client";

// «الرضا فويس» — the branch's front: the person's projects (kept on this device), the ways to start one, and the
// studio itself once a project is open.

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { chainById, RIDHA } from "@config/ridha";
import { makeProject, makeTrack, type Project } from "@/lib/ridha/model";
import { deleteProject, importProjectFile, listProjects, openProject, roomLeftMb, saveProject, type ProjectCard } from "./store";
import { usedSounds } from "@/lib/ridha/ops";
import { Logo } from "./Studio";

const Studio = dynamic(() => import("./Studio"), { ssr: false, loading: () => <div className="rv rv-home"><div className="rv-empty"><b>يفتح الاستوديو…</b></div></div> });

const chain = (id: string) => chainById(id)?.build() ?? [];
const sends = (id: string) => ({ sendReverb: chainById(id)?.sends.reverb ?? 0, sendDelay: chainById(id)?.sends.delay ?? 0 });

const STARTS: { id: string; icon: string; name: string; hint: string; make(): Project }[] = [
  { id: "blank", icon: "🎙️", name: "تسجيل سريع", hint: "مسار واحد جاهز للتسجيل", make: () => makeProject("تسجيل جديد") },
  {
    id: "podcast", icon: "🎧", name: "بودكاست", hint: "صوتان بسلسلة البودكاست ومسار للموسيقى",
    make: () => ({ ...makeProject("حلقة بودكاست"), tracks: [makeTrack("المقدّم", 0, { arm: true, stereo: false, fx: chain("podcast") }), makeTrack("الضيف", 1, { stereo: false, fx: chain("podcast") }), makeTrack("موسيقى", 2, { gain: -14 })] }),
  },
  {
    id: "aza", icon: "🏴", name: "لطمية / قصيدة عزاء", hint: "رادود بقاعة طويلة، ردّة، وإيقاع لطم من «التوزيع السريع»",
    make: () => {
      const p = makeProject("قصيدة عزاء");
      return { ...p, bpm: 70, reverb: { ...p.reverb, ...chainById("radood")!.room }, tracks: [makeTrack("الرادود", 0, { arm: true, stereo: false, fx: chain("radood"), ...sends("radood") }), makeTrack("الردّة", 1, { stereo: false, gain: -7, fx: chain("choir"), ...sends("choir") })] };
    },
  },
  {
    id: "mawlid", icon: "🎉", name: "مولد / فرح", hint: "منشد بغرفة قصيرة، كورال، وصفقة من «التوزيع السريع»",
    make: () => {
      const p = makeProject("مولد");
      return { ...p, bpm: 84, reverb: { ...p.reverb, ...chainById("mawlid")!.room }, tracks: [makeTrack("المنشد", 0, { arm: true, stereo: false, fx: chain("mawlid"), ...sends("mawlid") }), makeTrack("الكورال", 1, { stereo: false, gain: -7, fx: chain("choir"), ...sends("choir") })] };
    },
  },
  {
    id: "vo", icon: "📣", name: "تعليق على موسيقى", hint: "صوت إعلاني فوق مسار موسيقى",
    make: () => ({ ...makeProject("تعليق صوتي"), tracks: [makeTrack("التعليق", 0, { arm: true, stereo: false, fx: chain("voiceover"), ...sends("voiceover") }), makeTrack("الموسيقى", 1, { gain: -12 })] }),
  },
  {
    id: "quran", icon: "📿", name: "تلاوة / دعاء", hint: "صوت نقي في مسجد واسع",
    make: () => {
      const p = makeProject("تلاوة");
      return { ...p, reverb: { ...p.reverb, ...chainById("quran")!.room }, snap: false, tracks: [makeTrack("القارئ", 0, { arm: true, stereo: false, fx: chain("quran"), ...sends("quran") })] };
    },
  },
];

const FEATS: [string, string][] = [
  ["تسجيل ومسارات بلا حد", "تسجيل خام من المايك، تيكات واختيار أفضلها جملة جملة، قص وسحب وتدرّج"],
  ["ميكسر كامل", "فيدر وبان لكل مسار، ١٢ مؤثرًا، ريفيرب وصدى مشتركان، ماستر بعدّاد LUFS"],
  ["أوتوتيون ومقامات", "يكتشف النغمة والمقام بأرباعه (بيات، رست، صبا، سيكاه…) ويصحّح عليها"],
  ["ترفيع الطبقة", "يرفع أو ينزّل الصوت بدون تغيير طوله ولا شخصية صاحبه"],
  ["تنظيف احترافي", "ضجيج، طنين، طقطقة، صدى غرفة، سين حادة — بحسب نوع التسجيل"],
  ["هارموني 3D", "أصوات مرافقة من صوتك نفسه، موزعة حولك في الفراغ"],
  ["توزيع سريع", "إيقاع لطم أو صفقة وأرضية على نغمتك، من قايد بصوتك"],
  ["بلا تكلفة", "كل هذا يعمل على جهازك: لا يُرفع صوتك ولا يُخصم من رصيدك"],
];

const ago = (t: number) => {
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? "الآن" : m < 60 ? `قبل ${m} د` : m < 1440 ? `قبل ${Math.round(m / 60)} س` : `قبل ${Math.round(m / 1440)} يوم`;
};

export default function RidhaApp() {
  const [project, setProject] = useState<Project | null>(null);
  const [cards, setCards] = useState<ProjectCard[] | null>(null);
  const [room, setRoom] = useState<number | null>(null);
  const [error, setError] = useState("");

  const refresh = () => {
    listProjects().then(setCards, () => (setCards([]), setError("هذا المتصفح لا يسمح بحفظ المشاريع (وضع التصفح الخفي؟). تقدر تشتغل، لكن صدّر شغلك قبل الإغلاق.")));
    void roomLeftMb().then(setRoom);
  };
  useEffect(refresh, []);

  const start = async (make: () => Project) => {
    const p = make();
    await saveProject(p, usedSounds(p)).catch(() => {});
    setProject(p);
  };
  const open = async (id: string) => {
    const p = await openProject(id).catch(() => null);
    if (p) setProject(p);
    else setError("تعذّر فتح المشروع.");
  };
  const importFile = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".ridha,application/zip";
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      try {
        const p = await importProjectFile(f);
        await saveProject(p, usedSounds(p)).catch(() => {});
        setProject(p);
      } catch (e) {
        setError(e instanceof Error ? e.message : "تعذّر فتح الملف.");
      }
    };
    input.click();
  };

  if (project) return <Studio key={project.id} initial={project} onExit={() => (setProject(null), refresh())} />;

  return (
    <div className="rv rv-home">
      <div className="rv-home-in">
        <header className="rv-hero">
          <Logo big />
          <div className="rv-wave" aria-hidden>
            {[0.5, 0.8, 0.45, 1, 0.7, 0.35, 0.9, 0.6, 1, 0.5, 0.75, 0.4, 0.85, 0.55, 0.3].map((h, i) => (
              <i key={i} style={{ height: `${h * 100}%`, animationDelay: `${i * 0.09}s` }} />
            ))}
          </div>
          <p>{RIDHA.tagline}</p>
        </header>

        {error ? <div className="rv-report" style={{ borderColor: "var(--rv-rec)" }}>{error}</div> : null}

        <section>
          <h2>ابدأ مشروعًا</h2>
          <div className="rv-starts">
            {STARTS.map((s) => (
              <button key={s.id} type="button" className="rv-card" onClick={() => void start(s.make)}>
                <i>{s.icon}</i>
                <b>{s.name}</b>
                <small>{s.hint}</small>
              </button>
            ))}
            <button type="button" className="rv-card" onClick={importFile}>
              <i>📂</i>
              <b>افتح ملف مشروع</b>
              <small>ملف ‎.ridha من جهاز آخر</small>
            </button>
          </div>
        </section>

        {cards?.length ? (
          <section>
            <h2>مشاريعي <span className="rv-muted">· محفوظة على هذا الجهاز{room != null ? ` · المتاح ${room > 1000 ? `${(room / 1000).toFixed(1)} جيجا` : `${room} ميجا`}` : ""}</span></h2>
            <div className="rv-projects">
              {cards.map((c) => (
                <div key={c.id} className="rv-proj" role="button" tabIndex={0} onClick={() => void open(c.id)} onKeyDown={(e) => e.key === "Enter" && void open(c.id)}>
                  <b>{c.name || "بدون اسم"}</b>
                  <small>{c.tracks} مسارات · {Math.floor(c.seconds / 60)}:{String(Math.floor(c.seconds % 60)).padStart(2, "0")} · {ago(c.updatedAt)}</small>
                  <button type="button" className="rv-proj-del" title="حذف المشروع" onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`حذف «${c.name}» نهائيًا من هذا الجهاز؟`)) void deleteProject(c.id).then(refresh);
                  }}>✕</button>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section>
          <h2>ماذا فيه</h2>
          <div className="rv-feats">
            {FEATS.map(([t, d]) => (
              <div key={t}>
                <b>{t}</b>
                {d}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
