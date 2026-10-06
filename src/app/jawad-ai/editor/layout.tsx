import type { Metadata, Viewport } from "next";
import { Noto_Kufi_Arabic, Noto_Naskh_Arabic } from "next/font/google";

// installable: «حيدر كات» on the home screen, opening full-screen like an app
export const metadata: Metadata = {
  manifest: "/editor.webmanifest",
  appleWebApp: { capable: true, title: "حيدر كات", statusBarStyle: "black-translucent" },
  icons: { apple: "/editor-app/apple-180.png" },
};
export const viewport: Viewport = { themeColor: "#0c0d0c", colorScheme: "dark", viewportFit: "cover" };

// the text styles' fonts (drawn on the video by the canvas, so they are loaded with the page)
const naskh = Noto_Naskh_Arabic({ variable: "--font-naskh", subsets: ["arabic"], weight: ["400", "700"] });
const kufi = Noto_Kufi_Arabic({ variable: "--font-kufi", subsets: ["arabic"], weight: ["400", "700", "900"] });

/** «حيدر كات»: its own dark edit-suite look (sections.css) inside JAWAD AI's frame. */
export default function EditorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`jw-sec ${naskh.variable} ${kufi.variable}`} data-jw-section="editor">
      {children}
    </div>
  );
}
