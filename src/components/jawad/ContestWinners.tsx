import { winners } from "@/lib/contest/server";

// «🏆 الفائزين في مسابقة الفيلم السينمائي» on the site's home: the three places the owner picked, with their makers'
// names and their videos (nothing at all until a place is picked).
export default async function ContestWinners() {
  const w = await winners().catch(() => []);
  if (!w.length) return null;
  const medal = ["", "🥇", "🥈", "🥉"];
  return (
    <section dir="rtl" className="mx-auto w-full max-w-6xl space-y-3 px-4 pt-6">
      <h2 className="m-0 text-2xl font-extrabold">🏆 الفائزين في مسابقة الفيلم السينمائي</h2>
      <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-3">
        {w.map((x) => (
          <li key={x.place} className="overflow-hidden rounded-2xl border border-jw-line bg-jw-surface">
            {x.url && <video src={x.url} controls preload="metadata" playsInline className="aspect-video w-full bg-black" />}
            <div className="p-3">
              <p className="m-0 text-lg font-extrabold">
                {medal[x.place]} المركز {["", "الأول", "الثاني", "الثالث"][x.place]}: {x.name}
              </p>
              {x.projectTitle && <p className="m-0 text-sm text-jw-muted">«{x.projectTitle}»</p>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
