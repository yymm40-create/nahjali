"use client";

// «نفس المصدر» — the one thing the file's own row doesn't say: its real frame rate and its real bitrate. Read from the
// file itself in the browser (Mediabunny, a few packets only — nothing is decoded and nothing is uploaded).

import { ALL_FORMATS, Input, UrlSource } from "mediabunny";

/** The file's own frame rate and bitrate (megabits a second), or null for each one that can't be read. */
export async function measureSource(url: string): Promise<{ fps: number | null; mbps: number | null } | null> {
  try {
    const input = new Input({ source: new UrlSource(url), formats: ALL_FORMATS });
    const track = await input.getPrimaryVideoTrack();
    if (!track) return null;
    // a sample of packets is enough for both numbers (no full scan of the file)
    const stats = await track.computePacketStats(60).catch(() => null);
    const fps = stats?.averagePacketRate && stats.averagePacketRate > 1 ? Math.round(stats.averagePacketRate * 100) / 100 : null;
    const mbps = stats?.averageBitrate && stats.averageBitrate > 100_000 ? Math.round((stats.averageBitrate / 1_000_000) * 10) / 10 : null;
    return { fps, mbps };
  } catch {
    return null;
  }
}
