import Link from "next/link";
import { TB } from "@config/tables-booklet";
import "../booklet.css";

/** A booklet's steps (its photo, its character, the drawing, the download) on light paper, with the way back. */
export default function BookletOrderLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="tb">
      <Link href={TB.base} className="tb-back">→ {TB.name}</Link>
      <div className="tb-paper">{children}</div>
    </div>
  );
}
