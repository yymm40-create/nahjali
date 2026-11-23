// «حيدرة كت» — «لمّ المسارات»: a shoot dropped on the timeline one file per track (32 cameras, 32 tracks) into the
// fewest tracks that hold it. Nothing changes in the film: a clip that was drawn over another where they overlap is
// still on a higher track than it, and no clip moves in time. Pure.

export interface Laned {
  id: string;
  /** the track it is on now, counted from the bottom */
  lane: number;
  start: number;
  end: number;
}

/**
 * The lane each clip goes to (id → lane, from 0). Clips are taken from the bottom track up; each sits on the lowest
 * lane that is free for its time and above every clip it used to be over (two clips of one track never overlap, so
 * they may share a lane again). The result never uses more lanes than there were.
 */
export function packLanes(clips: Laned[]): Map<string, number> {
  const out = new Map<string, number>();
  const placed: (Laned & { to: number })[] = [];
  for (const c of [...clips].sort((a, b) => a.lane - b.lane || a.start - b.start)) {
    let to = 0;
    for (const p of placed) if (p.lane < c.lane && p.start < c.end && p.end > c.start) to = Math.max(to, p.to + 1);
    while (placed.some((p) => p.to === to && p.start < c.end && p.end > c.start)) to++;
    placed.push({ ...c, to });
    out.set(c.id, to);
  }
  return out;
}
