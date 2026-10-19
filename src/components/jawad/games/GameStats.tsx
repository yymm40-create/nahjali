"use client";

// «📊 الإحصائيات» of a game: how many opened it, how many different players, how long they played, who came back, the
// last two weeks day by day, and where they came from (WhatsApp, Instagram…) and on what. Its owner and the site's owner.

import { useEffect, useState } from "react";
import { api } from "@/lib/fetch";
import type { GameStats as Stats } from "@/lib/games/plays-shared";
import "./game-stats.css";

const DEVICE: Record<string, string> = { phone: "📱 جوال", tablet: "📲 تابلت", desktop: "💻 كمبيوتر", "": "غير معروف" };
const n = (v: number) => v.toLocaleString("ar-SA-u-nu-latn");
const dayName = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("ar-SA-u-nu-latn", { weekday: "short", day: "numeric" });

export default function GameStats({ id }: { id: string }) {
  const [s, setS] = useState<Stats | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    let on = true;
    api<{ stats: Stats }>(`/api/games/play/${id}/stats`)
      .then((r) => on && setS(r.stats))
      .catch((e) => on && setErr(e instanceof Error ? e.message : "تعذّر التحميل."));
    return () => {
      on = false;
    };
  }, [id]);

  if (err) return <p className="gst-note">{err}</p>;
  if (!s) return <p className="gst-note">يجيب الأرقام…</p>;
  if (!s.opens) return <p className="gst-note">لسا محد لعبها. أرسل الرابط لربعك، وأول ما يفتحونها تطلع الأرقام هنا. (لعبك أنت ما ينحسب.)</p>;
  const top = Math.max(1, ...s.days.map((d) => d.opens));
  const src = Math.max(1, ...s.sources.map((x) => x.opens));
  return (
    <div className="gst" dir="rtl">
      <div className="gst-tiles">
        <div><b>{n(s.opens)}</b><span>مرة انفتحت</span></div>
        <div><b>{n(s.players)}</b><span>لاعب مختلف</span></div>
        <div><b>{n(s.returning)}</b><span>رجعوا يلعبون</span></div>
        <div><b>{n(s.avgMinutes)}</b><span>دقيقة لكل مرة</span></div>
        <div><b>{n(Math.round(s.minutes))}</b><span>دقيقة لعب كلها</span></div>
        <div><b>{n(s.today)}</b><span>اليوم</span></div>
      </div>
      <div className="gst-block">
        <h4>آخر {s.days.length} يوم</h4>
        <div className="gst-days" role="img" aria-label={s.days.map((d) => `${d.day}: ${d.opens}`).join("، ")}>
          {s.days.map((d) => (
            <div key={d.day} className="gst-day" title={`${dayName(d.day)} — ${d.opens} مرة، ${d.players} لاعب`}>
              <i style={{ height: `${(d.opens / top) * 100}%` }} />
              <small>{d.opens || ""}</small>
            </div>
          ))}
        </div>
        <div className="gst-axis"><span>{dayName(s.days[0].day)}</span><span>اليوم</span></div>
      </div>
      <div className="gst-block">
        <h4>من وين جوا</h4>
        <ul className="gst-list">
          {s.sources.slice(0, 8).map((x) => (
            <li key={x.source}>
              <span>{x.label}</span>
              <i><em style={{ width: `${(x.opens / src) * 100}%` }} /></i>
              <b>{n(x.opens)}</b>
            </li>
          ))}
        </ul>
      </div>
      <p className="gst-foot">
        {s.devices.map((d) => `${DEVICE[d.device] ?? d.device} ${n(d.opens)}`).join(" · ")}
        {s.signedIn > 0 && ` · 🔐 ${n(s.signedIn)} مسجّلين دخول`}
        {s.lastPlayed && ` · آخر لعب ${new Date(s.lastPlayed).toLocaleString("ar-SA-u-nu-latn", { dateStyle: "short", timeStyle: "short" })}`}
      </p>
    </div>
  );
}
