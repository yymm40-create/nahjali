import { useEffect, useState } from "react";

// «حيدرة كت» on the desktop (desktop/ in the repository): files from the computer are not uploaded. The program
// keeps where each one is on the disk and serves it to the editor itself (haidara-media://), so a 10 GB video is on
// the timeline at once; only the timeline and what is asked of حيدرة go over the internet.

export interface DesktopBridge {
  platform: string;
  version: string;
  /** A file from the computer kept where it is: its id in the program, or null (not a file on the disk). */
  keepLocal: (file: File) => Promise<{ id: string; url: string } | null>;
}

export const desktop = (): DesktopBridge | null => {
  if (typeof window === "undefined") return null;
  const d = (window as unknown as { haidaraDesktop?: DesktopBridge }).haidaraDesktop;
  return d && typeof d.keepLocal === "function" ? d : null;
};

/** The link the program serves a kept file at. */
export const LOCAL_SCHEME = "haidara-media";

/** True inside the desktop program (known after the first render, so the page and the server agree first). */
export function useDesktop() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setOn(!!desktop()), 0);
    return () => clearTimeout(t);
  }, []);
  return on;
}
