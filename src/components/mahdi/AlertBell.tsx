"use client";

// «اجعله تنبيهًا»: the small bell beside every habit, priority, task and planner event. A tap opens a sheet with the
// time; «فعّل التنبيه» saves it, and a notification arrives on the phone at that time (the dispatcher, every 15
// minutes). When this device can't receive notifications yet, the sheet turns them on in the same place.

import { useEffect, useState } from "react";
import { t } from "@/lib/mahdi/i18n";
import { deviceState, enablePush, type Device } from "@/lib/mahdi/client/push";
import Icon from "./Icon";
import Sheet from "./Sheet";
import { useMahdi } from "./Provider";

const nowHHMM = () => new Date().toTimeString().slice(0, 5);

export default function AlertBell({
  name,
  time,
  onSave,
  hint,
  size = 16,
}: {
  /** what the alert is for («قراءة القرآن») */
  name: string;
  /** "HH:MM" when the alert is on, null when off */
  time: string | null;
  /** saves the new time (null turns it off); throws with a message the person can read */
  onSave: (time: string | null) => Promise<void>;
  /** a line under the time (when it is sent, when it isn't) */
  hint?: string;
  size?: number;
}) {
  const [open, setOpen] = useState(false);
  const on = Boolean(time);
  return (
    <>
      <button
        type="button"
        className="m-icon-btn m-btn-ghost shrink-0"
        aria-label={on ? t.alert.editFor(name, time!) : t.alert.makeFor(name)}
        title={on ? t.alert.editFor(name, time!) : t.alert.make}
        aria-pressed={on}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        style={on ? { color: "var(--m-gold)" } : undefined}
      >
        <Icon name="bell" size={size} strokeWidth={on ? 2.4 : undefined} />
      </button>
      {open && <AlertSheet name={name} time={time} hint={hint} onSave={onSave} onClose={() => setOpen(false)} />}
    </>
  );
}

function AlertSheet({ name, time, hint, onSave, onClose }: { name: string; time: string | null; hint?: string; onSave: (time: string | null) => Promise<void>; onClose: () => void }) {
  const { toast } = useMahdi();
  const [at, setAt] = useState(time ?? nowHHMM());
  const [busy, setBusy] = useState(false);
  const [device, setDevice] = useState<Device>("checking");

  useEffect(() => {
    let live = true;
    deviceState()
      .then((d) => live && setDevice(d))
      .catch(() => live && setDevice("unsupported"));
    return () => {
      live = false;
    };
  }, []);

  const save = async (value: string | null) => {
    setBusy(true);
    try {
      // turning one on: this device is asked for notifications first, when it can and hasn't said yes yet
      if (value && device === "off") setDevice(await enablePush().catch(() => "off" as const));
      await onSave(value);
      toast(value ? t.alert.saved(name, value) : t.alert.removed);
      onClose();
    } catch (e) {
      toast((e as Error).message || t.errors.generic);
    }
    setBusy(false);
  };

  const note: Partial<Record<Device, string>> = {
    unsupported: t.notify.unsupported,
    "needs-install": t.notify.iosHint,
    "not-configured": t.notify.notConfigured,
    denied: t.notify.denied,
    off: t.alert.deviceOff,
  };

  return (
    <Sheet open onClose={onClose} title={t.alert.make}>
      <div className="space-y-4">
        <p className="font-semibold">🔔 {name}</p>
        <label className="block space-y-1">
          <span className="text-sm m-muted">{t.alert.at}</span>
          <input type="time" className="m-field m-num" dir="ltr" value={at} onChange={(e) => setAt(e.target.value)} />
        </label>
        {hint && <p className="m-hint">{hint}</p>}
        {note[device] && <p className="m-note text-sm">{note[device]}</p>}
        <div className="flex gap-2">
          <button type="button" className="m-btn m-btn-primary flex-1" disabled={busy || !at} onClick={() => void save(at)}>
            <Icon name="bell" size={18} /> {time ? t.alert.update : t.alert.turnOn}
          </button>
          {time && (
            <button type="button" className="m-btn m-btn-ghost" disabled={busy} onClick={() => void save(null)}>
              {t.alert.turnOff}
            </button>
          )}
        </div>
      </div>
    </Sheet>
  );
}
