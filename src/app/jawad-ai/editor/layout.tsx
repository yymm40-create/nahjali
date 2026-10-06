import { Noto_Kufi_Arabic, Noto_Naskh_Arabic } from "next/font/google";

// the text styles' fonts (drawn on the video by the canvas, so they are loaded with the page)
const naskh = Noto_Naskh_Arabic({ variable: "--font-naskh", subsets: ["arabic"], weight: ["400", "700"] });
const kufi = Noto_Kufi_Arabic({ variable: "--font-kufi", subsets: ["arabic"], weight: ["400", "700", "900"] });

/** «الممنتج الذكي»: its own dark edit-suite look (sections.css) inside JAWAD AI's frame. */
export default function EditorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`jw-sec ${naskh.variable} ${kufi.variable}`} data-jw-section="editor">
      {children}
    </div>
  );
}
