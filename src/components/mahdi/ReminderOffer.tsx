"use client";

// «أذكّرك بكرة؟» — the only place the app asks for notifications by itself. Never on entry: it waits until the person
// finishes their first habit or saves a reading while the app is open, then a small sheet offers one reminder tomorrow
// at a time tied to the prayers. Only after «إيه، ذكّرني» does the browser (or the phone app) show its permission prompt.
// Answered once (yes or no) on a device, it never comes again; the switch in «التذكير» stays for later.

import { useEffect, useMemo, useRef, useState } from "react";
import { dayGoals, prayerMinutes } from "@/lib/mahdi/engine";
import { t } from "@/lib/mahdi/i18n";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import { deviceState, enablePush, type Device } from "@/lib/mahdi/client/push";
import { answeredOffer, canAsk, clock12, OFFER_KEY, offerSettings, prayerSlots, shouldOffer, type PrayerSlotId } from "@/lib/mahdi/remind-offer";
import type { NotificationSettings } from "@/lib/mahdi/types";
import Icon from "./Icon";
import { useMahdi } from "./Provider";
import Sheet from "./Sheet";

const R = t.remindOffer;

function readAnswered(): boolean {
  try {
    return answeredOffer(localStorage.getItem(OFFER_KEY));
  } catch {
    return true; // no storage (a private window): never nag
  }
}
function keepAnswer(v: "yes" | "no") {
  try {
    localStorage.setItem(OFFER_KEY, `${v}:${Date.now()}`);
  } catch {}
}

export default function ReminderOffer() {
  const { state, store, timeline, toast } = useMahdi();
  const { snap, today } = state;
  const [device, setDevice] = useState<Device>("checking");
  const [answered, setAnswered] = useState(true);
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState<PrayerSlotId>("maghrib");
  const [busy, setBusy] = useState(false);
  const doneAtOpen = useRef<number | null>(null);

  // what is finished: today's goals done, and every reading saved
  const doneNow = useMemo(() => dayGoals(timeline, today).filter((i) => i.progress >= 1).length + snap.reading.sessions.length, [timeline, today, snap.reading.sessions.length]);

  useEffect(() => {
    let live = true;
    const id = setTimeout(() => {
      if (!live) return;
      const was = readAnswered();
      setAnswered(was);
      if (!was) deviceState().then((d) => live && setDevice(d), () => live && setDevice("unsupported"));
    }, 0);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, []);

  // the count when the app opened (what was already done before doesn't count as «just finished»)
  useEffect(() => {
    if (doneAtOpen.current === null && device !== "checking") doneAtOpen.current = doneNow;
    if (!open && shouldOffer({ device, answered, doneAtOpen: doneAtOpen.current, doneNow })) {
      const id = setTimeout(() => setOpen(true), 1200); // after the tick's own joy, not over it
      return () => clearTimeout(id);
    }
  }, [device, answered, doneNow, open]);

  const slots = useMemo(() => prayerSlots(prayerMinutes(snap.profile.timeZone, today, snap.profile.dayStart)), [snap.profile.timeZone, snap.profile.dayStart, today]);
  if (!open || !canAsk(device)) return null;

  const close = (v: "yes" | "no") => {
    keepAnswer(v);
    setAnswered(true);
    setOpen(false);
  };

  const yes = async () => {
    const slot = slots.find((s) => s.id === pick) ?? slots[2];
    setBusy(true);
    try {
      // the permission is asked first, straight from the tap (iPhone needs that)
      const r = await enablePush();
      if (r !== "on") {
        toast(R.denied);
        close("no");
        return;
      }
      const next = offerSettings<NotificationSettings>(snap.notifications, slot.at);
      const { notifications } = await mahdiFetch<{ notifications: NotificationSettings }>("/api/mahdi/notifications", { method: "PUT", json: next });
      store.setSnapPart({ notifications });
      toast(R.saved(slot.label, clock12(slot.at)));
      close("yes");
    } catch (e) {
      toast((e as Error).message || t.errors.generic);
    }
    setBusy(false);
  };

  return (
    <Sheet open onClose={() => close("no")} title={R.title}>
      <div className="space-y-4">
        <p className="flex items-start gap-2">
          <Icon name="bell" size={20} className="m-gold mt-1 shrink-0" />
          <span>{R.body}</span>
        </p>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={R.when}>
          {slots.map((s) => (
            <button key={s.id} type="button" role="radio" aria-checked={pick === s.id} className="m-option flex flex-col items-center gap-0.5 p-2.5 text-sm font-semibold" onClick={() => setPick(s.id)}>
              {s.label}
              <span className="m-num m-muted text-xs font-normal" dir="ltr">
                {clock12(s.at)}
              </span>
            </button>
          ))}
        </div>
        <p className="m-hint">{R.hint}</p>
        <div className="flex gap-2">
          <button type="button" className="m-btn m-btn-primary flex-1" disabled={busy} onClick={() => void yes()}>
            {busy ? t.common.saving : R.yes}
          </button>
          <button type="button" className="m-btn m-btn-ghost" disabled={busy} onClick={() => close("no")}>
            {R.no}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
