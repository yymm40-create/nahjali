// A simple body (front and back) with its muscles drawn as shapes: the ones an exercise works light up (main in lime,
// helping in orange), or the one being read about. Plain SVG; the ids are config/mahdi/exercise-guide.ts → MUSCLES.

type Shape = { cx: number; cy: number; rx: number; ry: number; r?: number };

/** each muscle's shapes on the front (f) and the back (b) figure: viewBox 0 0 120 240 per figure */
const FRONT: Record<string, Shape[]> = {
  pec: [{ cx: 49, cy: 64, rx: 11, ry: 8 }, { cx: 71, cy: 64, rx: 11, ry: 8 }],
  "front-delt": [{ cx: 35, cy: 56, rx: 6, ry: 7 }, { cx: 85, cy: 56, rx: 6, ry: 7 }],
  "side-delt": [{ cx: 29, cy: 59, rx: 4, ry: 7 }, { cx: 91, cy: 59, rx: 4, ry: 7 }],
  biceps: [{ cx: 30, cy: 82, rx: 5, ry: 11 }, { cx: 90, cy: 82, rx: 5, ry: 11 }],
  brachialis: [{ cx: 27, cy: 90, rx: 3, ry: 6 }, { cx: 93, cy: 90, rx: 3, ry: 6 }],
  forearms: [{ cx: 26, cy: 110, rx: 5, ry: 13 }, { cx: 94, cy: 110, rx: 5, ry: 13 }],
  abs: [{ cx: 60, cy: 92, rx: 8, ry: 19 }],
  obliques: [{ cx: 46, cy: 96, rx: 5, ry: 13 }, { cx: 74, cy: 96, rx: 5, ry: 13 }],
  tva: [{ cx: 60, cy: 104, rx: 13, ry: 8 }],
  pelvic: [{ cx: 60, cy: 124, rx: 6, ry: 4 }],
  quads: [{ cx: 50, cy: 150, rx: 9, ry: 24 }, { cx: 70, cy: 150, rx: 9, ry: 24 }],
  adductors: [{ cx: 57, cy: 140, rx: 3, ry: 12 }, { cx: 63, cy: 140, rx: 3, ry: 12 }],
  "glute-med": [{ cx: 42, cy: 120, rx: 4, ry: 6 }, { cx: 78, cy: 120, rx: 4, ry: 6 }],
};
const BACK: Record<string, Shape[]> = {
  traps: [{ cx: 60, cy: 54, rx: 15, ry: 9 }],
  "rear-delt": [{ cx: 35, cy: 57, rx: 6, ry: 6 }, { cx: 85, cy: 57, rx: 6, ry: 6 }],
  "side-delt": [{ cx: 29, cy: 59, rx: 4, ry: 7 }, { cx: 91, cy: 59, rx: 4, ry: 7 }],
  cuff: [{ cx: 45, cy: 64, rx: 6, ry: 4 }, { cx: 75, cy: 64, rx: 6, ry: 4 }],
  rhomboids: [{ cx: 60, cy: 68, rx: 7, ry: 6 }],
  lats: [{ cx: 47, cy: 84, rx: 9, ry: 15 }, { cx: 73, cy: 84, rx: 9, ry: 15 }],
  erectors: [{ cx: 56, cy: 100, rx: 3, ry: 15 }, { cx: 64, cy: 100, rx: 3, ry: 15 }],
  triceps: [{ cx: 30, cy: 82, rx: 5, ry: 11 }, { cx: 90, cy: 82, rx: 5, ry: 11 }],
  forearms: [{ cx: 26, cy: 110, rx: 5, ry: 13 }, { cx: 94, cy: 110, rx: 5, ry: 13 }],
  "glute-max": [{ cx: 51, cy: 127, rx: 10, ry: 10 }, { cx: 69, cy: 127, rx: 10, ry: 10 }],
  "glute-med": [{ cx: 43, cy: 117, rx: 5, ry: 5 }, { cx: 77, cy: 117, rx: 5, ry: 5 }],
  hams: [{ cx: 51, cy: 156, rx: 8, ry: 20 }, { cx: 69, cy: 156, rx: 8, ry: 20 }],
  adductors: [{ cx: 58, cy: 146, rx: 2.5, ry: 10 }, { cx: 62, cy: 146, rx: 2.5, ry: 10 }],
  calves: [{ cx: 51, cy: 196, rx: 6, ry: 15 }, { cx: 69, cy: 196, rx: 6, ry: 15 }],
};
const FRONT_CALVES: Shape[] = [{ cx: 51, cy: 196, rx: 5, ry: 14 }, { cx: 69, cy: 196, rx: 5, ry: 14 }];

function Figure({ shapes, main, help, label, extra = [] }: { shapes: Record<string, Shape[]>; main: Set<string>; help: Set<string>; label: string; extra?: Shape[] }) {
  return (
    <svg viewBox="0 0 120 240" className="gym-body" role="img" aria-label={label}>
      {/* the silhouette */}
      <g fill="#20252d">
        <circle cx="60" cy="22" r="13" />
        <rect x="54" y="33" width="12" height="10" rx="3" />
        <path d="M34 46 Q60 40 86 46 L92 64 L84 116 Q60 124 36 116 L28 64 Z" />
        <rect x="21" y="52" width="14" height="72" rx="7" />
        <rect x="85" y="52" width="14" height="72" rx="7" />
        <path d="M37 114 Q60 122 83 114 L80 214 Q72 222 62 214 L60 140 L58 214 Q48 222 40 214 Z" />
      </g>
      {[...Object.entries(shapes).map(([id, list]) => [id, list] as const), ...(extra.length ? [["calves", extra] as const] : [])].map(([id, list]) =>
        list.map((s, i) => (
          <ellipse key={`${id}-${i}`} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} fill={main.has(id) ? "#c6ff1a" : help.has(id) ? "#ff7a1a" : "#2c333d"} opacity={main.has(id) ? 0.95 : help.has(id) ? 0.85 : 1}>
            <title>{id}</title>
          </ellipse>
        )),
      )}
    </svg>
  );
}

export default function BodyMap({ main = [], help = [] }: { main?: string[]; help?: string[] }) {
  const m = new Set(main);
  const h = new Set(help);
  return (
    <div className="gym-bodymap">
      <figure>
        <Figure shapes={FRONT} main={m} help={h} label="الجسم من قدام" extra={FRONT_CALVES} />
        <figcaption>قدام</figcaption>
      </figure>
      <figure>
        <Figure shapes={BACK} main={m} help={h} label="الجسم من ورا" />
        <figcaption>ورا</figcaption>
      </figure>
      {(main.length > 0 || help.length > 0) && (
        <p className="legend">
          <i className="main" /> أساسية <i className="help" /> مساعدة
        </p>
      )}
    </div>
  );
}
