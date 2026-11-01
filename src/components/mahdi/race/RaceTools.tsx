"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { RACE_LETTERS, RACE_WORDS } from "@config/mahdi-race";
import { finalPoints, shuffled, type RaceTeam, type RaceTeamInfo } from "@/lib/mahdi/race";

export interface ToolRound {
  id: string;
  name: string;
  tool: string;
  word_set: string;
  per: number;
  secs: number;
}

type Add = (team: RaceTeam, points: number, reason: string) => void;

/** Sends one line to the day's record (the room supplies it). */
export const RaceLog = createContext<(kind: string, data?: Record<string, unknown>) => void>(() => {});

// Short sounds made in code, started by the leader's tap.
let ctx: AudioContext | null = null;
function audio() {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}
function beep(freq = 880, dur = 0.12, vol = 0.25) {
  const c = audio();
  const o = c.createOscillator();
  const g = c.createGain();
  o.frequency.value = freq;
  g.gain.setValueAtTime(vol, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
  o.connect(g).connect(c.destination);
  o.start();
  o.stop(c.currentTime + dur);
}
function boom() {
  const c = audio();
  const n = Math.floor(c.sampleRate * 0.9);
  const b = c.createBuffer(1, n, c.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 2;
  const s = c.createBufferSource();
  s.buffer = b;
  s.connect(c.destination);
  s.start();
}

/** A countdown on the wall clock, so a dimmed screen never loses time. */
function useClock(onEnd: () => void, hidden = false) {
  const [left, setLeft] = useState<number | null>(null);
  const end = useRef(0);
  const last = useRef(-1);
  const done = useRef(onEnd);
  useEffect(() => {
    done.current = onEnd;
  });
  useEffect(() => {
    if (left === null) return;
    const iv = setInterval(() => {
      const ms = end.current - Date.now();
      const sec = Math.ceil(ms / 1000);
      if (sec !== last.current) {
        last.current = sec;
        if (hidden) beep(1200, 0.04, 0.12);
        else if (sec <= 5 && sec > 0) beep();
      }
      if (ms <= 0) {
        setLeft(null);
        beep(440, 0.5, 0.3);
        done.current();
      } else setLeft(sec);
    }, 100);
    return () => clearInterval(iv);
  }, [left === null, hidden]); // eslint-disable-line react-hooks/exhaustive-deps
  return {
    left,
    start: (secs: number) => {
      audio();
      end.current = Date.now() + secs * 1000;
      last.current = -1;
      setLeft(Math.ceil(secs));
    },
    stop: () => setLeft(null),
  };
}

const clockCls = "text-center text-6xl font-black tabular-nums";

function Timer({ secs }: { secs: number }) {
  const log = useContext(RaceLog);
  const c = useClock(() => log("timer_end", { secs }));
  return (
    <div className="space-y-2">
      <div className={clockCls}>{c.left ?? secs}</div>
      <div className="flex gap-2">
        <button type="button" className="m-btn m-btn-primary flex-1" onClick={() => {
            log("timer_start", { secs });
            c.start(secs);
          }}
        >
          ابدأ {secs} ثانية
        </button>
        <button
          type="button"
          className="m-btn m-btn-ghost"
          onClick={() => {
            log("timer_stop", { secs, left: c.left });
            c.stop();
          }}
        >
          وقّف
        </button>
      </div>
    </div>
  );
}

function Bomb({ teams, add }: { teams: RaceTeamInfo[]; add: Add }) {
  const log = useContext(RaceLog);
  const [blown, setBlown] = useState(false);
  const c = useClock(() => {
    log("bomb_blast");
    boom();
    try {
      navigator.vibrate?.([300, 100, 300]);
    } catch {}
    setBlown(true);
  }, true);
  if (blown)
    return (
      <div className="space-y-3 text-center">
        <div className="text-7xl">💥</div>
        <p className="text-xl font-black">انفجرت! عند منو؟</p>
        <div className="flex flex-wrap gap-2">
          {teams.map((t) => (
            <button
              key={t.id}
              type="button"
              className="m-btn m-btn-primary flex-1"
              onClick={() => {
                log("bomb_held_by", { team: t.id, name: t.name });
                // Two teams: the other one gains. More teams: the holder's team pays.
                if (teams.length === 2) add(teams.find((x) => x.id !== t.id)!.id, 10, `القنبلة انفجرت عند ${t.name}`);
                else add(t.id, -10, "القنبلة انفجرت عندهم");
                setBlown(false);
              }}
            >
              {t.emoji} {t.name}
            </button>
          ))}
        </div>
      </div>
    );
  return (
    <div className="space-y-3 text-center">
      <div className="text-7xl">💣</div>
      {c.left !== null ? (
        <p className="font-bold">العداد مخفي… العبوا!</p>
      ) : (
        <button type="button" className="m-btn m-btn-primary w-full" onClick={() => {
            const secs = 25 + Math.random() * 50;
            log("bomb_start", { secs: Math.round(secs * 10) / 10 });
            c.start(secs);
          }}
        >
          شغّل القنبلة
        </button>
      )}
    </div>
  );
}

function Words({ round, teams, add }: { round: ToolRound; teams: RaceTeamInfo[]; add: Add }) {
  const log = useContext(RaceLog);
  const [team, setTeam] = useState<RaceTeam>(teams[0].id);
  const [word, setWord] = useState("");
  const [count, setCount] = useState(0);
  const left = useRef<string[]>([]);
  const next = () => {
    if (!left.current.length) left.current = shuffled(RACE_WORDS[(round.word_set || "act") as "hear" | "act"]);
    const w = left.current.pop() ?? "";
    log("word_shown", { round: round.name, team, word: w });
    setWord(w);
  };
  const n = useRef(0);
  const c = useClock(() => {
    log("words_end", { round: round.name, team, count: n.current });
    if (n.current) add(team, n.current * round.per, `${round.name}: ${n.current} كلمات`);
    setWord("");
  });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {teams.map((t) => (
          <button key={t.id} type="button" disabled={c.left !== null} className={`m-btn flex-1 ${team === t.id ? "m-btn-primary" : "m-btn-ghost"}`} onClick={() => setTeam(t.id)}>
            دور {t.emoji} {t.name}
          </button>
        ))}
      </div>
      <div className={clockCls}>{c.left ?? round.secs}</div>
      <p className="text-center text-4xl font-black m-gold">{word || "جاهزين؟"}</p>
      <p className="text-center font-bold">صح: {count}</p>
      {c.left !== null ? (
        <div className="flex gap-2">
          <button
            type="button"
            className="m-btn m-btn-primary flex-1"
            onClick={() => {
              n.current++;
              log("word_correct", { round: round.name, team, word, count: n.current });
              setCount(n.current);
              beep(990, 0.1);
              next();
            }}
          >
            صح
          </button>
          <button
            type="button"
            className="m-btn m-btn-ghost flex-1"
            onClick={() => {
              log("word_skipped", { round: round.name, team, word });
              next();
            }}
          >
            تخطي
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="m-btn m-btn-primary w-full"
          onClick={() => {
            n.current = 0;
            setCount(0);
            log("words_start", { round: round.name, team, secs: round.secs });
            next();
            c.start(round.secs);
          }}
        >
          ابدأ {round.secs} ثانية
        </button>
      )}
    </div>
  );
}

function Draw({ secs }: { secs: number }) {
  const log = useContext(RaceLog);
  const [word, setWord] = useState("");
  const [show, setShow] = useState(false);
  const left = useRef<string[]>([]);
  const fresh = () => {
    if (!left.current.length) left.current = shuffled(RACE_WORDS.draw);
    const w = left.current.pop() ?? "";
    log("draw_word", { word: w });
    setWord(w);
    return w;
  };
  return (
    <div className="space-y-3">
      <button
        type="button"
        className="m-card flex min-h-32 w-full items-center justify-center p-4 text-center text-2xl font-black"
        style={{ touchAction: "none" }}
        onPointerDown={() => {
          log("draw_word_seen", { word: word || fresh() });
          setShow(true);
        }}
        onPointerUp={() => setShow(false)}
        onPointerLeave={() => setShow(false)}
        onPointerCancel={() => setShow(false)}
        onContextMenu={(e) => e.preventDefault()}
      >
        {show ? word : "امسك هنا: الكلمة لأول رسّام بس"}
      </button>
      <button type="button" className="m-btn m-btn-ghost w-full" onClick={fresh}>
        كلمة جديدة
      </button>
      <Timer secs={secs || 15} />
    </div>
  );
}

function Letters({ secs }: { secs: number }) {
  const log = useContext(RaceLog);
  const [pair, setPair] = useState("");
  const c = useClock(() => {});
  return (
    <div className="space-y-3 text-center">
      <p className="text-5xl font-black m-gold">{pair || "؟ ؟"}</p>
      <div className={clockCls}>{c.left ?? secs}</div>
      <button
        type="button"
        className="m-btn m-btn-primary w-full"
        onClick={() => {
          const s = shuffled(RACE_LETTERS);
          setPair(`${s[0]} ثم ${s[1]}`);
          log("letters", { first: s[0], second: s[1], secs: secs || 10 });
          c.start(secs || 10);
        }}
      >
        حرفين جديدين
      </button>
    </div>
  );
}

function Final({ secs, teams, add }: { secs: number; teams: RaceTeamInfo[]; add: Add }) {
  const log = useContext(RaceLog);
  const [left, setLeft] = useState<Record<string, string>>({});
  return (
    <div className="space-y-3">
      <Timer secs={secs} />
      <h4 className="font-bold">كم واحد بقى؟</h4>
      {teams.map((t) => (
        <label key={t.id} className="flex items-center gap-3 font-semibold">
          <span className="flex-1">{t.emoji} {t.name}</span>
          <input className="m-field w-20 text-center" inputMode="numeric" value={left[t.id] ?? "0"} onChange={(e) => setLeft({ ...left, [t.id]: e.target.value })} />
        </label>
      ))}
      <button
        type="button"
        className="m-btn m-btn-primary w-full"
        onClick={() => {
          log("final_left", { left });
          for (const p of finalPoints(Object.fromEntries(teams.map((t) => [t.id, Math.max(0, parseInt(left[t.id] ?? "0", 10) || 0)])))) add(p.team, p.points, p.reason);
          setLeft({});
        }}
      >
        احسب الحسم
      </button>
    </div>
  );
}

/** The leader's phone runs the round: its timer, words, or hidden bomb. */
export default function RaceTools({ round, teams, add }: { round: ToolRound; teams: RaceTeamInfo[]; add: Add }) {
  if (round.tool === "bomb") return <Bomb teams={teams} add={add} />;
  if (round.tool === "words") return <Words round={round} teams={teams} add={add} />;
  if (round.tool === "draw") return <Draw secs={round.secs} />;
  if (round.tool === "letters") return <Letters secs={round.secs} />;
  if (round.tool === "final") return <Final secs={round.secs} teams={teams} add={add} />;
  return round.secs ? <Timer secs={round.secs} /> : null;
}
