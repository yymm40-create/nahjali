import { Amiri_Quran } from "next/font/google";

// The mushaf's letters (OFL), only for «الختمة العلوية»: the Uthmani text with its marks needs a Quran font
const quran = Amiri_Quran({ variable: "--font-quran", subsets: ["arabic"], weight: "400", display: "swap" });

export const metadata = { title: "الختمة العلوية" };

export default function KhatmaLayout({ children }: { children: React.ReactNode }) {
  return <div className={quran.variable}>{children}</div>;
}
