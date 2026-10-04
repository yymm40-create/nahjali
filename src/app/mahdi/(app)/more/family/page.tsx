"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { t } from "@/lib/mahdi/i18n";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import type { FamilyPerson, FamilyView } from "@/lib/mahdi/server/family";
import Avatar from "@/components/mahdi/Avatar";
import ConfirmSheet from "@/components/mahdi/ConfirmSheet";
import Icon from "@/components/mahdi/Icon";
import { useMahdi } from "@/components/mahdi/Provider";
import Sheet from "@/components/mahdi/Sheet";

const F = t.family;

/** «عائلتي»: the parent adds members and enters their accounts; members go back with the parent's PIN. */
export default function FamilyPage() {
  const { toast } = useMahdi();
  const [family, setFamily] = useState<FamilyView | null>(null);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState<FamilyPerson | null>(null);
  const [askPin, setAskPin] = useState("");
  const [askError, setAskError] = useState("");
  const [removing, setRemoving] = useState<FamilyPerson | null>(null);

  useEffect(() => {
    let live = true;
    mahdiFetch<{ family: FamilyView }>("/api/mahdi/family")
      .then((r) => live && setFamily(r.family))
      .catch((e) => live && setError((e as Error).message));
    return () => {
      live = false;
    };
  }, []);

  async function post(json: Record<string, unknown>, done?: string) {
    setBusy(true);
    try {
      const r = await mahdiFetch<{ family: FamilyView }>("/api/mahdi/family", { method: "POST", json });
      setFamily(r.family);
      if (done) toast(done);
      return true;
    } catch (e) {
      toast((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function go(person: FamilyPerson, code?: string) {
    setBusy(true);
    setAskError("");
    try {
      await mahdiFetch("/api/mahdi/family", { method: "POST", json: { action: "switch", id: person.id, pin: code } });
      toast(F.switching);
      // A full reload on purpose: the app starts again with the other account's data
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/mahdi");
    } catch (e) {
      setAskError((e as Error).message);
      setBusy(false);
    }
  }

  if (error) return <p className="m-card p-6 text-center">{error}</p>;
  if (!family) return <p className="m-muted">{t.common.loading}</p>;
  const me = family.people.find((p) => p.id === family.me)!;
  const iAmParent = family.role !== "member";
  const members = family.people.filter((p) => !p.parent);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link href="/mahdi/more" className="m-btn m-btn-quiet m-btn-sm -ms-3">
        <Icon name="chevronRight" size={18} /> {t.more.title}
      </Link>
      <h1 className="m-display text-3xl">{F.title}</h1>
      <p className="m-note text-sm">{F.intro}</p>

      {(family.role !== null || !iAmParent) && (
        <ul className="m-card divide-y px-4" style={{ borderColor: "var(--m-line)" }}>
          {family.people.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-3">
              <Avatar profile={{ displayName: p.name, avatarUrl: p.avatarUrl }} size={48} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{p.name}</span>
                <span className="block text-xs m-muted">
                  {p.parent ? F.parent : p.username ? <bdi dir="ltr">@{p.username}</bdi> : ""}
                  {p.id === me.id && ` · ${F.current}`}
                </span>
              </span>
              {p.id !== me.id && (
                <button type="button" className="m-btn m-btn-primary m-btn-sm" disabled={busy} onClick={() => (iAmParent ? go(p) : (setAskPin(""), setAskError(""), setAsking(p)))}>
                  {p.parent ? F.back : F.enter}
                </button>
              )}
              {iAmParent && !p.parent && (
                <button type="button" className="m-icon-btn" aria-label={F.remove} onClick={() => setRemoving(p)}>
                  <Icon name="trash" size={18} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {iAmParent && (
        <>
          <section className="m-card space-y-3 p-5">
            <h2 className="font-semibold">{F.pinTitle}</h2>
            <p className="m-hint">{F.pinHint}</p>
            <form
              className="flex gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (await post({ action: "pin", pin }, F.pinSaved)) setPin("");
              }}
            >
              <input className="m-field m-num flex-1" type="password" inputMode="numeric" autoComplete="new-password" maxLength={8} pattern="\d{4,8}" dir="ltr" aria-label={F.pinTitle} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
              <button className="m-btn m-btn-ghost" disabled={busy || pin.length < 4}>{family.hasPin ? F.pinChange : F.pinSet}</button>
            </form>
          </section>

          <section className="m-card space-y-3 p-5">
            <h2 className="font-semibold">{F.add}</h2>
            <form
              className="flex gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                const n = name.trim();
                if (await post({ action: "add", name: n }, F.added(n))) setName("");
              }}
            >
              <input className="m-field flex-1" maxLength={30} placeholder={F.addName} aria-label={F.addName} value={name} onChange={(e) => setName(e.target.value)} />
              <button className="m-btn m-btn-primary" disabled={busy || !name.trim() || !family.hasPin || members.length >= family.max}>
                <Icon name="plus" size={18} /> {F.addButton}
              </button>
            </form>
            {!family.hasPin && <p className="m-hint">{F.pinFirst}</p>}
            {members.length >= family.max && <p className="m-hint">{F.full(family.max)}</p>}
          </section>
        </>
      )}

      <Sheet open={Boolean(asking)} onClose={() => setAsking(null)} title={asking?.parent ? F.back : `${F.enter}: ${asking?.name ?? ""}`}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (asking) go(asking, askPin);
          }}
        >
          <label className="block">
            <span className="m-label">{F.pinAsk}</span>
            <input className="m-field m-num" type="password" inputMode="numeric" autoComplete="off" maxLength={8} dir="ltr" autoFocus value={askPin} onChange={(e) => setAskPin(e.target.value.replace(/\D/g, ""))} />
          </label>
          {askError && <p className="m-error" role="alert">{askError}</p>}
          <button className="m-btn m-btn-primary w-full" disabled={busy || askPin.length < 4}>{busy ? F.switching : F.switchAccount}</button>
        </form>
      </Sheet>

      <ConfirmSheet
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        title={removing ? F.removeTitle(removing.name) : ""}
        body={F.removeBody}
        onConfirm={async () => {
          if (removing) await post({ action: "remove", id: removing.id }, F.removed);
        }}
      />
    </div>
  );
}
