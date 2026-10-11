import Backdrop from "@/components/jawad/student/Backdrop";
import StudentChrome from "@/components/jawad/student/StudentChrome";
import { BranchProvider } from "@/components/jawad/student/branch";
import { KHATEEB, KHATEEB_LOOK } from "@config/jawad/khateeb";
import "../../student/student.css";

/** «الخطيب الذكي»: «الطالب الذكي»'s look and pages, under the secret link, with its own name and assistant. */
export default async function KhateebLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <div className="st">
      <Backdrop />
      <div className="relative z-[1] pb-24">
        <BranchProvider look={{ ...KHATEEB_LOOK, base: `${KHATEEB.base}/${slug}` }}>{children}</BranchProvider>
      </div>
      <StudentChrome />
    </div>
  );
}
