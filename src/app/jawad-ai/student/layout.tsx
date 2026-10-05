import Backdrop from "@/components/jawad/student/Backdrop";
import StudentChrome from "@/components/jawad/student/StudentChrome";
import "./student.css";

/** «الطالب الذكي»: its own bright look (scoped to .st) over JAWAD's dark frame, with the living background. */
export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="st">
      <Backdrop />
      {/* room at the bottom for the floating «رأيك» button */}
      <div className="relative z-[1] pb-24">{children}</div>
      <StudentChrome />
    </div>
  );
}
