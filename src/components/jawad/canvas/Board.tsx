"use client";

// «اللوحة»: the infinite board — pan (drag the empty board, two-finger scroll), zoom (pinch on a phone or a trackpad,
// Ctrl/⌘ + wheel, the buttons), drag nodes (all the selected ones together), select with a click, Shift + click or a
// Shift + drag box, and wires: drag from a node's output dot to another node's input dot, or tap the output dot and then
// the input (phones). Plain React + SVG, no graph library. The flow runs right to left (Arabic reading order): a node's
// inputs are on its right edge, its output on its left; the kept x grows to the left.

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { NODE_KINDS, wireProblem, type CanvasEdge, type CanvasNode } from "@config/jawad/canvas";
import type { Viewport } from "./types";

export const NODE_W = 236;
export const HEAD = 44;
export const ROW = 26;
const NODE_H_GUESS = 170;
export const MIN_ZOOM = 0.2;
export const MAX_ZOOM = 2;

/** A node's left edge on the board (the kept x is mirrored: the flow goes right to left). */
export const viewX = (n: Pick<CanvasNode, "x">) => -n.x - NODE_W;
const inPort = (n: CanvasNode, port: string) => {
  const i = NODE_KINDS[n.kind].inputs.findIndex((p) => p.id === port);
  return { x: viewX(n) + NODE_W, y: n.y + HEAD + Math.max(0, i) * ROW + ROW / 2 };
};
const outPort = (n: CanvasNode) => ({ x: viewX(n), y: n.y + HEAD / 2 });
const curve = (a: { x: number; y: number }, b: { x: number; y: number }) => {
  const d = Math.max(50, Math.abs(a.x - b.x) / 2);
  return `M ${a.x} ${a.y} C ${a.x - d} ${a.y}, ${b.x + d} ${b.y}, ${b.x} ${b.y}`;
};
const clampZoom = (s: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, s));

/** The camera that shows every node (or a calm default for an empty board). */
export function fitView(nodes: CanvasNode[], w: number, h: number): Viewport {
  if (!nodes.length || !w || !h) return { x: w * 0.75, y: h * 0.25, s: 1 };
  const minX = Math.min(...nodes.map(viewX));
  const maxX = Math.max(...nodes.map((n) => viewX(n) + NODE_W));
  const minY = Math.min(...nodes.map((n) => n.y));
  const maxY = Math.max(...nodes.map((n) => n.y + NODE_H_GUESS));
  const s = clampZoom(Math.min((w - 80) / (maxX - minX || 1), (h - 80) / (maxY - minY || 1), 1.1));
  return { x: w / 2 - s * ((minX + maxX) / 2), y: h / 2 - s * ((minY + maxY) / 2), s };
}

type Gesture =
  | { type: "pan"; sx: number; sy: number; vx: number; vy: number; moved: boolean }
  | { type: "pinch"; d0: number; s0: number; mx: number; my: number; vx: number; vy: number }
  | { type: "drag"; ids: string[]; lx: number; ly: number; moved: boolean }
  | { type: "wire"; from: string; sx: number; sy: number; moved: boolean }
  | { type: "box"; x0: number; y0: number };

export default function Board({
  nodes,
  edges,
  vp,
  onVp,
  selected,
  onSelect,
  selectedEdge,
  onSelectEdge,
  onBeginMove,
  onMove,
  onConnect,
  renderNode,
  readOnly = false,
}: {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  vp: Viewport;
  onVp: (v: Viewport) => void;
  selected: string[];
  onSelect: (ids: string[]) => void;
  selectedEdge: string | null;
  onSelectEdge: (id: string | null) => void;
  /** a drag starts (the page keeps an undo step) */
  onBeginMove: () => void;
  /** move these nodes by a board distance (in kept coordinates) */
  onMove: (ids: string[], dx: number, dy: number) => void;
  onConnect: (from: string, to: string, port: string) => void;
  renderNode: (n: CanvasNode) => ReactNode;
  readOnly?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const vpRef = useRef(vp);
  useLayoutEffect(() => {
    vpRef.current = vp;
  }, [vp]);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<Gesture | null>(null);
  const [wire, setWire] = useState<{ from: string; x: number; y: number } | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [box, setBox] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);

  const local = useCallback((e: { clientX: number; clientY: number }) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }, []);
  const toView = (p: { x: number; y: number }) => ({ x: (p.x - vpRef.current.x) / vpRef.current.s, y: (p.y - vpRef.current.y) / vpRef.current.s });

  // the wheel: Ctrl/⌘ (and a trackpad pinch, which the browser sends with Ctrl) zooms around the pointer; otherwise it pans
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest("[data-scroll]")) return;
      e.preventDefault();
      const v = vpRef.current;
      if (e.ctrlKey || e.metaKey) {
        const r = el.getBoundingClientRect();
        const px = e.clientX - r.left;
        const py = e.clientY - r.top;
        const s = clampZoom(v.s * Math.exp(-e.deltaY * 0.01));
        onVp({ s, x: px - ((px - v.x) / v.s) * s, y: py - ((py - v.y) / v.s) * s });
      } else onVp({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY });
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [onVp]);

  function connectTo(from: string, target: Element | null) {
    const inp = target?.closest("[data-in]") as HTMLElement | null;
    if (!inp) return false;
    const [to, port] = (inp.dataset.in ?? "").split(":");
    if (to && port) onConnect(from, to, port);
    return true;
  }

  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const t = e.target as HTMLElement;
    if (t.closest("[data-nodrag]")) return;
    const el = ref.current!;
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      // a pointer the browser no longer tracks
    }
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      setWire(null);
      setBox(null);
      gesture.current = { type: "pinch", d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, s0: vpRef.current.s, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, vx: vpRef.current.x, vy: vpRef.current.y };
      return;
    }
    if (!readOnly) {
      const out = t.closest("[data-out]") as HTMLElement | null;
      if (out) {
        const from = out.dataset.out!;
        gesture.current = { type: "wire", from, sx: p.x, sy: p.y, moved: false };
        setWire({ from, x: p.x, y: p.y });
        return;
      }
      if (pending && t.closest("[data-in]")) {
        connectTo(pending, t);
        setPending(null);
        gesture.current = null;
        return;
      }
    }
    const edge = t.closest("[data-edge]") as HTMLElement | null;
    if (edge) {
      onSelectEdge(edge.dataset.edge!);
      gesture.current = null;
      return;
    }
    const nodeEl = t.closest("[data-node]") as HTMLElement | null;
    if (nodeEl) {
      const id = nodeEl.dataset.node!;
      let ids = selected;
      if (e.shiftKey || e.metaKey || e.ctrlKey) ids = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
      else if (!selected.includes(id)) ids = [id];
      onSelect(ids);
      onSelectEdge(null);
      setPending(null);
      gesture.current = readOnly || !ids.includes(id) ? null : { type: "drag", ids, lx: p.x, ly: p.y, moved: false };
      return;
    }
    setPending(null);
    gesture.current = e.shiftKey ? { type: "box", x0: p.x, y0: p.y } : { type: "pan", sx: p.x, sy: p.y, vx: vpRef.current.x, vy: vpRef.current.y, moved: false };
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    const g = gesture.current;
    if (!g) return;
    if (g.type === "pinch") {
      const [a, b] = [...pointers.current.values()];
      if (!a || !b) return;
      const s = clampZoom(g.s0 * (Math.hypot(a.x - b.x, a.y - b.y) / g.d0));
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      // the point under the fingers stays under them (and follows them as they move)
      onVp({ s, x: mx - ((g.mx - g.vx) / g.s0) * s, y: my - ((g.my - g.vy) / g.s0) * s });
    } else if (g.type === "pan") {
      if (Math.hypot(p.x - g.sx, p.y - g.sy) > 3) g.moved = true;
      onVp({ ...vpRef.current, x: g.vx + (p.x - g.sx), y: g.vy + (p.y - g.sy) });
    } else if (g.type === "drag") {
      const dx = p.x - g.lx;
      const dy = p.y - g.ly;
      if (!g.moved && Math.hypot(dx, dy) < 3) return;
      if (!g.moved) onBeginMove();
      g.moved = true;
      g.lx = p.x;
      g.ly = p.y;
      // the kept x is mirrored: moving right on the screen is a smaller x
      onMove(g.ids, -dx / vpRef.current.s, dy / vpRef.current.s);
    } else if (g.type === "wire") {
      if (Math.hypot(p.x - g.sx, p.y - g.sy) > 4) g.moved = true;
      setWire({ from: g.from, x: p.x, y: p.y });
    } else if (g.type === "box") setBox({ x0: g.x0, y0: g.y0, x1: p.x, y1: p.y });
  }

  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (g?.type === "pinch") {
      // the finger left keeps panning from where it is
      const rest = [...pointers.current.values()][0];
      gesture.current = rest ? { type: "pan", sx: rest.x, sy: rest.y, vx: vpRef.current.x, vy: vpRef.current.y, moved: true } : null;
      return;
    }
    gesture.current = null;
    if (!g) return;
    if (g.type === "wire") {
      setWire(null);
      if (!g.moved) return setPending(g.from);
      connectTo(g.from, document.elementFromPoint(e.clientX, e.clientY));
    } else if (g.type === "pan" && !g.moved) {
      onSelect([]);
      onSelectEdge(null);
    } else if (g.type === "box") {
      setBox(null);
      const a = toView({ x: Math.min(g.x0, local(e).x), y: Math.min(g.y0, local(e).y) });
      const b = toView({ x: Math.max(g.x0, local(e).x), y: Math.max(g.y0, local(e).y) });
      onSelect(nodes.filter((n) => viewX(n) + NODE_W > a.x && viewX(n) < b.x && n.y + NODE_H_GUESS > a.y && n.y < b.y).map((n) => n.id));
    }
  }

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const fromNode = wire ? byId.get(wire.from) : pending ? byId.get(pending) : undefined;
  const live = wire ? { x: (wire.x - vp.x) / vp.s, y: (wire.y - vp.y) / vp.s } : null;
  const linking = wire?.from ?? pending;

  return (
    <div
      ref={ref}
      dir="ltr"
      className={`cv-board ${pending ? "is-linking" : ""}`}
      style={{ backgroundPosition: `${vp.x}px ${vp.y}px`, backgroundSize: `${24 * vp.s}px ${24 * vp.s}px` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      role="application"
      aria-label="اللوحة: اسحب الفراغ للتحريك، وكبّر بإصبعين أو Ctrl مع العجلة"
    >
      <div className="cv-layer" style={{ transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.s})` }}>
        <svg className="cv-wires" width="1" height="1" aria-hidden>
          {edges.map((e) => {
            const a = byId.get(e.from);
            const b = byId.get(e.to);
            if (!a || !b) return null;
            const d = curve(outPort(a), inPort(b, e.port));
            const type = NODE_KINDS[a.kind].output ?? "text";
            return (
              <g key={e.id} data-edge={e.id} className={`cv-wire cv-t-${type} ${selectedEdge === e.id ? "is-sel" : ""}`}>
                <path d={d} className="cv-wire-hit" />
                <path d={d} className="cv-wire-line" />
              </g>
            );
          })}
          {fromNode && live && <path d={curve(outPort(fromNode), live)} className="cv-wire-live" />}
        </svg>
        {nodes.map((n) => {
          const def = NODE_KINDS[n.kind];
          return (
            <div key={n.id} dir="rtl" data-node={n.id} className={`cv-node cv-k-${n.kind} ${selected.includes(n.id) ? "is-sel" : ""}`} style={{ left: viewX(n), top: n.y, width: NODE_W }}>
              {renderNode(n)}
              {def.inputs.map((p, i) => {
                const ok = linking ? !wireProblem({ nodes, edges }, linking, n.id, p.id) : false;
                return <span key={p.id} data-in={`${n.id}:${p.id}`} className={`cv-port cv-port-in ${ok ? "is-ok" : ""}`} style={{ top: HEAD + i * ROW + ROW / 2 }} title={p.label} />;
              })}
              {def.output && !readOnly && <span data-out={n.id} className={`cv-port cv-port-out cv-t-${def.output} ${linking === n.id ? "is-on" : ""}`} style={{ top: HEAD / 2 }} title="اسحب من هنا لتوصيل سلك" />}
            </div>
          );
        })}
      </div>
      {box && <div className="cv-box" style={{ left: Math.min(box.x0, box.x1), top: Math.min(box.y0, box.y1), width: Math.abs(box.x1 - box.x0), height: Math.abs(box.y1 - box.y0) }} />}
      {pending && <p className="cv-linkhint">اضغط على مدخل عقدة لتوصيله (المداخل المناسبة تنوّر)، أو اضغط الفراغ للإلغاء.</p>}
    </div>
  );
}
