"use client";

import { useId, useState } from "react";
import { CAMERA_MOVES, cameraPhrase, findCameraMove, removeCameraMove, setCameraMove } from "@config/jawad/camera-moves";
import Icon from "../Icon";
import { track } from "@/lib/feature-track";
import "./camera-moves.css";

const TREES = [-100, -40, 20, 80, 140, 200, 260];

/** A small drawn scene that moves as the camera would (camera-moves.css); no media. */
function Preview({ move }: { move: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <span className="jw-cam block" data-move={move}>
      <svg viewBox="0 0 160 100" className="jw-cam-svg" aria-hidden focusable="false">
        <defs>
          <linearGradient id={`sky${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#6fb3f2" />
            <stop offset="1" stopColor="#dff1ff" />
          </linearGradient>
        </defs>
        <g className="cam-w">
          <rect x="-200" y="-140" width="560" height="214" fill={`url(#sky${id})`} />
          <g className="cam-far">
            <circle cx="124" cy="24" r="9" fill="#ffd36b" />
            <path d="M-120 72 Q-80 50 -40 68 T40 64 T120 60 T200 66 T280 62 V80 H-120Z" fill="#8fcf9b" />
          </g>
          <rect x="-200" y="70" width="560" height="160" fill="#5fae6a" />
          <rect x="-200" y="84" width="560" height="6" fill="#549c5e" />
          <g className="cam-near">
            {TREES.map((x) => (
              <g key={x}>
                <rect x={x - 1.5} y="56" width="3" height="16" rx="1" fill="#7a5537" />
                <circle cx={x} cy="52" r="8" fill="#3f8f4c" />
              </g>
            ))}
          </g>
          <g className="cam-s">
            <ellipse cx="80" cy="71" rx="9" ry="2" fill="#000" opacity="0.18" />
            <rect x="74" y="49" width="12" height="21" rx="5" fill="#2b3245" />
            <rect x="74" y="51" width="12" height="3.5" style={{ fill: "var(--jw-accent, #7c5cff)" }} />
            <circle cx="80" cy="43" r="5.5" fill="#f0c39a" />
            <circle cx="82" cy="42" r="0.9" fill="#2b2b2b" />
          </g>
          <g className="cam-freeze">
            {[
              [64, 40],
              [96, 36],
              [70, 30],
              [92, 48],
              [60, 52],
            ].map(([x, y]) => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" fill="#ffffff" opacity="0.9" />
            ))}
          </g>
        </g>
        {/* «من فوق تمامًا»: the same place seen from above */}
        <g className="cam-top">
          <rect x="-60" y="-60" width="280" height="220" fill="#5fae6a" />
          <rect x="-60" y="42" width="280" height="16" fill="#cdb98f" />
          {[
            [24, 20],
            [130, 80],
            [140, 18],
            [30, 84],
          ].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="11" fill="#3f8f4c" />
          ))}
          <ellipse cx="82" cy="52" rx="9" ry="6" fill="#000" opacity="0.15" />
          <ellipse cx="80" cy="50" rx="9" ry="5" fill="#2b3245" />
          <circle cx="80" cy="50" r="4.2" fill="#3a2a20" />
        </g>
        <g className="cam-streak" stroke="#ffffff" strokeWidth="1.4" strokeLinecap="round" opacity="0">
          {[18, 32, 46, 60, 74, 88].map((y, i) => (
            <line key={y} x1={10 + (i % 3) * 14} y1={y} x2={120 + (i % 2) * 24} y2={y} />
          ))}
        </g>
      </svg>
    </span>
  );
}

/**
 * «🎥 حركة الكاميرا» (video generators): pick one camera move by its moving preview; its English phrase goes on its own
 * line at the end of the prompt, written the way this generator reads it. One move at a time: another replaces it, the
 * same one again (or «شيلها») takes it out. The move is read back from the prompt itself, so it stays with the draft.
 */
export default function CameraMoves({ generatorId, generatorName, prompt, onPrompt, disabled }: { generatorId: string; generatorName: string; prompt: string; onPrompt: (text: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const found = findCameraMove(prompt);
  const current = found?.move ?? null;
  // written for another generator (the person switched): one tap rewrites it for this one
  const stale = Boolean(found && found.phrase !== cameraPhrase(found.move, generatorId));

  const pick = (id: string) => {
    const m = CAMERA_MOVES.find((x) => x.id === id)!;
    if (current?.id === m.id) onPrompt(removeCameraMove(prompt));
    else {
      track("studio.camera_move");
      onPrompt(setCameraMove(prompt, m, generatorId));
    }
    setOpen(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" className={`jw-chip !px-2.5 !py-1 !text-xs ${current ? "!border-jw-accent !text-jw-ink" : ""}`} onClick={() => setOpen((o) => !o)} aria-expanded={open} disabled={disabled}>
          🎥 حركة الكاميرا{current ? `: ${current.ar}` : ""}
          <Icon name={open ? "chevronUp" : "chevronDown"} size={12} />
        </button>
        {current && (
          <button type="button" className="jw-chip !px-2 !py-1 !text-xs" onClick={() => onPrompt(removeCameraMove(prompt))} disabled={disabled} aria-label={`شيل حركة «${current.ar}» من البرومبت`}>
            <Icon name="x" size={12} /> شيلها
          </button>
        )}
        {current && stale && (
          <button type="button" className="jw-chip !px-2 !py-1 !text-xs" onClick={() => onPrompt(setCameraMove(prompt, current, generatorId))} disabled={disabled} title={cameraPhrase(current, generatorId)}>
            <Icon name="retry" size={12} /> صِغها لـ <bdi dir="ltr">{generatorName}</bdi>
          </button>
        )}
      </div>
      {open && (
        <div className="rounded-xl border border-jw-line bg-jw-surface-2 p-2.5" role="group" aria-label="حركات الكاميرا">
          <p className="mb-2 text-[11px] text-jw-faint">
            اختر حركة وحدة: تنضاف بآخر البرومبت بالإنجليزي بالصيغة اللي يفهمها <bdi dir="ltr">{generatorName}</bdi>. اضغطها مرة ثانية تنشال.
          </p>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {CAMERA_MOVES.map((m) => {
              const on = current?.id === m.id;
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    disabled={disabled}
                    onClick={() => pick(m.id)}
                    title={cameraPhrase(m, generatorId)}
                    className={`block w-full overflow-hidden rounded-lg border bg-jw-surface text-start transition-colors ${on ? "border-jw-accent ring-1 ring-jw-accent" : "border-jw-line hover:border-jw-accent-line"}`}
                  >
                    <Preview move={m.id} />
                    <span className="flex items-center gap-1 px-2 pt-1.5 text-xs font-semibold">
                      {on && <Icon name="check" size={12} className="text-jw-accent" />}
                      {m.ar}
                    </span>
                    <span className="block px-2 pb-1.5 text-[10px] leading-4 text-jw-faint">{m.hint}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
