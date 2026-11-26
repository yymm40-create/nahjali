"use client";

// «بداية يومي» in «المزيد»: when the person's day starts — with Fajr prayer in their area (the default), at midnight, or
// at a time they pick. The area is a city from the list, or their location taken once (only 2 decimals are kept).

import { useState } from "react";
import { DAY_CITIES, DEFAULT_DAY_START, dayCity, dayStartMinute, fajrMinute, timeZoneCity, type DayStart, type DayStartMode } from "@/lib/mahdi/engine";
import { t } from "@/lib/mahdi/i18n";
import type { Profile } from "@/lib/mahdi/types";
import { useMahdi } from "./Provider";
import Icon from "./Icon";

const HERE = "__here";
const groups = [...new Set(DAY_CITIES.map((c) => c.group))];

/** A minute of the day as «4:54 ص». */
function clock(min: number) {
  const h = Math.floor(min / 60) % 24;
  const m = String(min % 60).padStart(2, "0");
  return `${h % 12 === 0 ? 12 : h % 12}:${m} ${h < 12 ? "ص" : "م"}`;
}

export default function DayStartSetting({ profile, save }: { profile: Profile; save: (fields: Record<string, unknown>) => Promise<Profile | null> }) {
  const { state, toast } = useMahdi();
  const ds: DayStart = profile.dayStart ?? DEFAULT_DAY_START;
  const [at, setAt] = useState(ds.at ?? "05:00");
  const [locating, setLocating] = useState(false);

  const put = (next: Partial<DayStart>) => save({ dayStart: { ...ds, ...next } });
  const pickMode = (mode: DayStartMode) => {
    if (mode === ds.mode) return;
    put({ mode, at: mode === "custom" ? at : ds.at });
  };
  const saveAt = () => {
    if (!/^\d\d:\d\d$/.test(at) || at > "12:00") return toast(t.dayStart.customHint);
    if (at !== ds.at || ds.mode !== "custom") put({ mode: "custom", at });
  };
  const pickCity = (id: string) => {
    if (id === HERE) return;
    const c = dayCity(id);
    put(c ? { city: c.id, lat: c.lat, lng: c.lng } : { city: null, lat: null, lng: null });
  };
  const locate = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return toast(t.dayStart.locateFailed);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const round = (n: number) => Math.round(n * 100) / 100;
        const kept = await put({ city: null, lat: round(pos.coords.latitude), lng: round(pos.coords.longitude) });
        setLocating(false);
        if (kept) toast(t.dayStart.located);
      },
      () => {
        setLocating(false);
        toast(t.dayStart.locateFailed);
      },
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 3_600_000 },
    );
  };

  const auto = timeZoneCity(profile.timeZone);
  const cityValue = ds.city ?? (ds.lat !== null ? HERE : "");
  const fajr = fajrMinute(profile.timeZone, state.today, ds);
  const start = dayStartMinute(profile.timeZone, state.today, ds);
  const modes: [DayStartMode, string][] = [
    ["fajr", t.dayStart.fajr],
    ["midnight", t.dayStart.midnight],
    ["custom", t.dayStart.custom],
  ];

  return (
    <div className="space-y-3" id="day-start">
      <div>
        <p className="font-semibold">{t.dayStart.title}</p>
        <p className="m-hint">{t.dayStart.hint}</p>
      </div>
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t.dayStart.title}>
        {modes.map(([id, label]) => (
          <button key={id} type="button" role="radio" aria-checked={ds.mode === id} className="m-option p-3 text-center text-sm font-semibold" onClick={() => pickMode(id)}>
            {label}
          </button>
        ))}
      </div>

      {ds.mode === "custom" && (
        <label className="block">
          <span className="m-label">{t.dayStart.customLabel}</span>
          <input type="time" className="m-field" dir="ltr" min="00:00" max="12:00" value={at} onChange={(e) => setAt(e.target.value)} onBlur={saveAt} />
          <span className="m-hint mt-1 block">{t.dayStart.customHint}</span>
        </label>
      )}

      {ds.mode === "fajr" && (
        <div className="space-y-2">
          <label className="block">
            <span className="m-label">{t.dayStart.city}</span>
            <select className="m-field" value={cityValue} onChange={(e) => pickCity(e.target.value)}>
              <option value="">{auto ? t.dayStart.cityAuto(auto.name) : t.dayStart.cityAutoNone}</option>
              {cityValue === HERE && <option value={HERE}>{t.dayStart.myPlace}</option>}
              {groups.map((g) => (
                <optgroup key={g} label={g}>
                  {DAY_CITIES.filter((c) => c.group === g).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <button type="button" className="m-btn m-btn-ghost m-btn-sm" disabled={locating} onClick={locate}>
            <Icon name="pin" size={14} className="m-ico" />
            {locating ? t.dayStart.locating : t.dayStart.locate}
          </button>
          {fajr !== null && <p className="text-sm m-muted">{t.dayStart.fajrToday(clock(fajr))}</p>}
        </div>
      )}

      {ds.mode !== "fajr" && <p className="text-sm m-muted">{t.dayStart.startsAt(clock(start))}</p>}
    </div>
  );
}
