import { Amiri } from "next/font/google";
import StudentChrome from "@/components/jawad/student/StudentChrome";
import { BranchProvider } from "@/components/jawad/student/branch";
import { KHATEEB, KHATEEB_LOOK } from "@config/jawad/khateeb";
import "../../student/student.css";
import "../khateeb.css";

const amiri = Amiri({ variable: "--font-amiri", subsets: ["arabic"], weight: ["400", "700"] });

/**
 * «الخطيب الذكي»: «الطالب الذكي»'s pages, under the secret link, with its own name and assistant — and the Husseini
 * minbar's look (khateeb.css): ivory, green and gold, a black banner, the star lattice, and the Amiri naskh for headings.
 */
export default async function KhateebLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <div className={`st kh ${amiri.variable}`}>
      <div className="kh-band">السلام عليك يا أبا عبد الله الحسين</div>
      <div className="relative z-[1] pb-24">
        <BranchProvider look={{ ...KHATEEB_LOOK, base: `${KHATEEB.base}/${slug}` }}>{children}</BranchProvider>
      </div>
      <StudentChrome />
    </div>
  );
}
