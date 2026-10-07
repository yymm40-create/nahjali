"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { postJson } from "@/lib/fetch";
import { useFilmBase } from "../FilmBase";

/**
 * Alone or with a team. The owner switches the mode and adds people by their @username (they work on the series'
 * scenes, on the owner's coins) or removes them; a member can leave.
 */
export default function SeriesTeam({ seriesId, owner, mode, members }: { seriesId: string; owner: boolean; mode: "solo" | "team"; members: { userId: string; username: string | null }[] }) {
  const router = useRouter();
  const base = useFilmBase();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const send = async (body: Record<string, unknown>, done?: string) => {
    setBusy(true);
    setError("");
    setMsg("");
    try {
      await postJson(`/api/film/series/${seriesId}`, body);
      if (done) setMsg(done);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!owner) {
    return (
      <section className="card space-y-2 p-4">
        <h2 className="text-lg font-extrabold">👥 الفريق</h2>
        <button
          type="button"
          className="btn btn-ghost w-full"
          disabled={busy}
          onClick={async () => {
            if (!window.confirm("تطلع من فريق هذا المسلسل؟ ما راح تقدر تفتح مشاهده بعدها.")) return;
            await send({ action: "leave" });
            router.push(`${base}/series`);
          }}
        >
          اطلع من الفريق
        </button>
        {error && <p className="error-box text-sm">{error}</p>}
      </section>
    );
  }
  return (
    <section className="card space-y-3 p-4">
      <h2 className="text-lg font-extrabold">فردي أو فريق</h2>
      <div className="grid grid-cols-2 gap-2">
        {(["solo", "team"] as const).map((m) => (
          <button key={m} type="button" className={`btn min-h-12 ${mode === m ? "btn-secondary" : "btn-ghost"}`} aria-pressed={mode === m} disabled={busy} onClick={() => mode !== m && send({ action: "mode", mode: m })}>
            {m === "solo" ? "👤 فردي" : "👥 فريق"}
          </button>
        ))}
      </div>
      {mode === "solo" ? (
        <p className="text-sm font-bold text-muted">أنت وحدك تشتغل على المسلسل.{members.length ? ` (فريقك المحفوظ: ${members.length}، يرجعون لما تحوّل لوضع الفريق.)` : ""}</p>
      ) : (
        <>
          <p className="text-sm font-bold text-muted">اللي تضيفهم يفتحون مشاهد المسلسل ويشتغلون عليها ويركّبون الحلقات، وكل تكلفة تنحسب من نقودك أنت.</p>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) void send({ action: "add_member", username: name.trim() }, `أضفنا @${name.trim().replace(/^@/, "")} للفريق ✅`).then(() => setName(""));
            }}
          >
            <input className="field flex-1" dir="ltr" placeholder="@اسم_المستخدم" maxLength={30} value={name} onChange={(e) => setName(e.target.value)} />
            <button className="btn btn-primary min-h-11 px-4" disabled={busy || !name.trim()}>أضف</button>
          </form>
          {members.length > 0 ? (
            <ul className="space-y-1">
              {members.map((m) => (
                <li key={m.userId} className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2 text-sm font-bold">
                  <span dir="ltr">@{m.username ?? "؟"}</span>
                  <button type="button" className="text-xs underline" disabled={busy} onClick={() => window.confirm(`تشيل @${m.username ?? ""} من الفريق؟`) && send({ action: "remove_member", userId: m.userId })}>
                    شيله
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs font-bold text-muted">ما أضفت أحد بعد.</p>
          )}
        </>
      )}
      {msg && <p className="text-sm font-bold text-teal">{msg}</p>}
      {error && <p className="error-box text-sm">{error}</p>}
    </section>
  );
}
