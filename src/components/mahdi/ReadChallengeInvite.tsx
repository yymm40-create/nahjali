"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { t } from "@/lib/mahdi/i18n";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import type { ReadChallenge, ReadPhase } from "@/lib/mahdi/read-challenge";
import Sheet from "./Sheet";
import { usePopupTurn } from "./usePopupTurn";
import Icon from "./Icon";

const R = t.readChallenge;
export const READ_CHALLENGE_PATH = "/mahdi/read-challenge";
/** Once per visit: closing it with «لاحقًا» keeps it away until the app is opened again. */
const LATER = (id: string) => `mahdi-read-challenge-later:${id}`;
/** «لا تظهرها مرة ثانية»: kept on this device, the invitation to this challenge never opens by itself again (a member's
 *  report, 24 November 2026: it opened on every visit for someone who doesn't want to join). */
const NEVER = (id: string) => `mahdi-read-challenge-never:${id}`;

interface Status {
  challenge: ReadChallenge | null;
  phase?: ReadPhase;
  joined?: boolean;
  length?: number;
}

/**
 * The invitation to «تحدي القراءة», while it runs and the person has not joined yet. It never opens as the app opens: it waits its turn
 * («نافذة وحدة بس في كل زيارة»), after the person completes something, and only if nothing else opened during this visit.
 */
export default function ReadChallengeInvite() {
  const pathname = usePathname();
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [want, setWant] = useState(false);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    mahdiFetch<Status>("/api/mahdi/read-challenge")
      .then((s) => {
        if (!live || !s.challenge || s.joined || s.phase === "over") return;
        let later = false;
        try {
          later = sessionStorage.getItem(LATER(s.challenge.id)) === "1" || localStorage.getItem(NEVER(s.challenge.id)) === "1";
        } catch {}
        setStatus(s);
        if (!later) setWant(true);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const here = pathname.startsWith(READ_CHALLENGE_PATH);
  const { show: open, done } = usePopupTurn("readChallenge", want && !here && Boolean(status?.challenge));
  const setOpen = (v: boolean) => {
    if (!v) {
      setWant(false);
      done();
    }
  };
  if (!status?.challenge || here) return null;
  const id = status.challenge.id;

  const later = () => {
    try {
      sessionStorage.setItem(LATER(id), "1");
    } catch {}
    setOpen(false);
  };

  const never = () => {
    try {
      localStorage.setItem(NEVER(id), "1");
    } catch {}
    later();
  };

  async function join() {
    setBusy(true);
    setError("");
    try {
      await mahdiFetch("/api/mahdi/read-challenge", { method: "POST", json: { agree: true } });
      setOpen(false);
      router.push(READ_CHALLENGE_PATH);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={later} title={R.inviteTitle}>
      <div className="space-y-4">
        <p className="flex gap-2" style={{ color: "var(--m-gold-text)" }} aria-hidden="true">
          <Icon name="book" size={36} />
          <Icon name="trophy" size={36} />
        </p>
        <p className="text-lg font-semibold">{R.inviteLead(status.length ?? 7, status.phase === "soon")}</p>
        <ul className="m-muted list-disc space-y-1 ps-5 text-sm">
          {R.rules.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <label className="m-option flex items-start gap-3 p-3">
          <input type="checkbox" className="mt-1 size-5 shrink-0" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          <span className="font-semibold">{R.consent}</span>
        </label>
        {error && <p className="m-error" role="alert">{error}</p>}
        <button type="button" className="m-btn m-btn-primary w-full text-lg" disabled={!agree || busy} onClick={join}>
          {busy ? t.common.saving : R.join}
        </button>
        <button type="button" className="m-btn m-btn-quiet w-full" onClick={later}>
          {R.later}
        </button>
        <button type="button" className="m-btn m-btn-quiet w-full text-sm" onClick={never}>
          {R.never}
        </button>
      </div>
    </Sheet>
  );
}
