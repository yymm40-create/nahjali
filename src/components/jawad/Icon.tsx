/** JAWAD AI's line icons (24×24, stroke = currentColor). */
const PATHS: Record<string, string> = {
  image: "M4 5h16v14H4zM4 16l4.5-4.5L13 16l3-3 4 4M9 9.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z",
  video: "M3 6h12v12H3zM15 10l6-3.5v11L15 14",
  film: "M4 3h16v18H4zM8 3v18M16 3v18M4 7.5h4M4 12h4M4 16.5h4M16 7.5h4M16 12h4M16 16.5h4",
  audio: "M3 10v4M7 7v10M11 4v16M15 8v8M19 11v2",
  book: "M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5M8 7h7M8 11h5",
  sparkles: "M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z",
  wand: "M4 20L15 9M14 4v2M14 10v2M10 8h2M16 8h2M17.5 4.5l-1 1M17.5 11.5l-1-1",
  layers: "M12 3l9 5-9 5-9-5zM3 13l9 5 9-5",
  camera: "M4 7h3l2-3h6l2 3h3v12H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  mic: "M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3",
  music: "M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z",
  palette: "M12 3a9 9 0 1 0 0 18c1.1 0 1.5-.8 1.2-1.7-.4-1.2.4-2.3 1.7-2.3H17a4 4 0 0 0 4-4c0-5.5-4-10-9-10zM7.5 11.5h.01M10 7.5h.01M15 7.5h.01",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  plus: "M12 5v14M5 12h14",
  x: "M6 6l12 12M18 6L6 18",
  check: "M5 12.5l4.5 4.5L19 7",
  download: "M12 4v11M7 10.5l5 5 5-5M5 20h14",
  play: "M8 5v14l11-7z",
  retry: "M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  chevronDown: "M6 9l6 6 6-6",
  chevronUp: "M6 15l6-6 6 6",
  chevronLeft: "M15 6l-6 6 6 6",
  chevronRight: "M9 6l6 6-6 6",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  alert: "M12 9v4M12 17h.01M10.3 3.9L2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7.5h.01",
  lock: "M6 11h12v10H6zM8 11V7a4 4 0 1 1 8 0v4",
  upload: "M12 20V9M7 13.5l5-5 5 5M5 4h14",
  logout: "M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11",
  menu: "M4 7h16M4 12h16M4 17h16",
  copy: "M8 8h12v12H8zM4 16V4h12",
  expand: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
  stop: "M7 7h10v10H7z",
  frames: "M3 5h7v14H3zM14 5h7v14h-7z",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  wallet: "M3 7h18v13H3zM3 7l3-3h12l1 3M16 13.5h2",
  external: "M14 4h6v6M20 4l-9 9M18 14v6H4V6h6",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  eyeOff: "M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.6 6.6C3.9 8.4 2 12 2 12s4 7 10 7a9.6 9.6 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2",
  scissors: "M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.1 7.9L20 20M8.1 16.1L20 4",
  undo: "M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3",
  redo: "M15 14l5-5-5-5M20 9H9a5 5 0 0 0 0 10h3",
  pause: "M7 5h3v14H7zM14 5h3v14h-3z",
  magnet: "M6 4v8a6 6 0 0 0 12 0V4h-4v8a2 2 0 0 1-4 0V4zM6 8h4M14 8h4",
  type: "M5 6V4h14v2M12 4v16M9 20h6",
  volume: "M4 9v6h4l5 4V5L8 9zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12",
  volumeOff: "M4 9v6h4l5 4V5L8 9zM17 9l5 6M22 9l-5 6",
  unlock: "M6 11h12v10H6zM8 11V7a4 4 0 0 1 7.7-1.5",
  zoomIn: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4M11 8v6M8 11h6",
  zoomOut: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4M8 11h6",
  ratio: "M4 6h16v12H4zM8 3v3M16 18v3",
  skipBack: "M19 5L9 12l10 7zM5 5v14",
  skipFwd: "M5 5l10 7-10 7zM19 5v14",
  folder: "M3 6h6l2 2h10v11H3z",
};

export type IconName = keyof typeof PATHS;
export const ICON_NAMES = Object.keys(PATHS);

export default function Icon({ name, size = 18, className = "", strokeWidth = 1.75 }: { name: string; size?: number; className?: string; strokeWidth?: number }) {
  const d = PATHS[name] ?? PATHS.sparkles;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={d} />
    </svg>
  );
}
