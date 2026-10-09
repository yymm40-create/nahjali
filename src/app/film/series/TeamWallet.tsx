"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import TeamCoin from "@/components/TeamCoin";
import { postJson } from "@/lib/fetch";
import { TEAM_COIN } from "@config/coins";
import Riyal from "@/components/Riyal";

type Row = { id: string; username: string | null; delta: number; reason: string; label: string; created_at: string };

/** «7/10 14:05» in Riyadh time, the same on the server and in any browser (no locale or calendar differences). */
function riyadh(iso: string) {
  const d = new Date(new Date(iso).getTime() + 3 * 3600_000);
  const two = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCDate()}/${d.getUTCMonth() + 1} ${two(d.getUTCHours())}:${two(d.getUTCMinutes())}`;
}

const REASON: Record<string, string> = { fund: "شحن من صاحب المسلسل", withdraw: "رجعت لصاحب المسلسل", grant: "هدية من إدارة الموقع", reserve: "صناعة", settle: "تسوية", refund: "استرداد (فشلت)" };

/**
 * «نقود الفريق الذكي»: the team's own wallet. Everything made inside the series (the scenes' replies, pictures,
 * videos, voices, and حيدرة's work in its edits) is paid from here, whoever on the team presses. The owner fills it
 * from their own «النقود الذكية» and can take coins back.
 */
export default function TeamWallet({ seriesId, owner, balance, ledger }: { seriesId: string; owner: boolean; balance: number; ledger: Row[] }) {
  const router = useRouter();
  const [coins, setCoins] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const move = async (action: "team_fund" | "team_withdraw") => {
    setBusy(true);
    setError("");
    try {
      await postJson(`/api/film/series/${seriesId}`, { action, coins: Math.round(Number(coins) * 100) });
      setCoins("");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="team-wallet relative space-y-4 overflow-hidden rounded-[26px] p-5 text-white" aria-label={TEAM_COIN.name}>
      <div className="flex items-center gap-4">
        <span className="team-coin-float shrink-0"><TeamCoin size={88} alive /></span>
        <div className="min-w-0">
          <p className="text-sm font-extrabold tracking-wide text-[#fde68a]">{TEAM_COIN.name}</p>
          <p className="text-5xl font-black tabular-nums leading-tight" dir="ltr" style={{ textAlign: "right" }}><Riyal halalas={balance} size={36} /></p>
          <p className="text-xs font-bold text-white/80">كل شي ينصنع داخل المسلسل ينقص من هنا، مهما كان اللي ضغط من الفريق.</p>
        </div>
      </div>

      {owner && (
        <div className="space-y-2 rounded-2xl bg-white/10 p-3 backdrop-blur">
          <p className="text-xs font-extrabold text-white/85">حوّل من نقودك الذكية لنقود الفريق، أو رجّعها:</p>
          <div className="flex flex-wrap gap-2">
            <input className="field min-w-0 flex-1 !bg-white/90 !text-[#2a0a3d]" inputMode="numeric" dir="ltr" placeholder="المبلغ بالريال" value={coins} onChange={(e) => setCoins(e.target.value.replace(/[^\d.]/g, "").slice(0, 7))} />
            <button type="button" className="btn btn-primary min-h-11 px-4" disabled={busy || !Number(coins)} onClick={() => move("team_fund")}>⬆️ اشحن الفريق</button>
            <button type="button" className="btn min-h-11 border border-white/40 bg-white/10 px-3 text-white" disabled={busy || !Number(coins)} onClick={() => move("team_withdraw")}>⬇️ رجّعها لي</button>
          </div>
          {error && <p className="error-box text-sm">{error}</p>}
        </div>
      )}

      <details className="rounded-2xl bg-black/15 p-3 text-sm">
        <summary className="cursor-pointer font-extrabold">السجل ({ledger.length})</summary>
        {ledger.length ? (
          <ul className="mt-2 divide-y divide-white/10">
            {ledger.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 py-1.5">
                <span className="min-w-0">
                  <span className="block truncate font-bold">{r.label || REASON[r.reason] || r.reason}</span>
                  <span className="block text-[11px] text-white/70">
                    {REASON[r.reason] ?? r.reason}
                    {r.username ? <> · <bdi dir="ltr">@{r.username}</bdi></> : null} · <bdi dir="ltr">{riyadh(r.created_at)}</bdi>
                  </span>
                </span>
                <span className={`shrink-0 font-black tabular-nums ${r.delta >= 0 ? "text-[#bbf7d0]" : "text-[#fecdd3]"}`} dir="ltr">{r.delta > 0 ? "+" : ""}{r.delta}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-white/75">ما فيه حركات بعد.</p>
        )}
      </details>
    </section>
  );
}
