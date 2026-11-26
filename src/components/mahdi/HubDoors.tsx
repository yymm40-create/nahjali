import Link from "next/link";
import Icon from "./Icon";
import type { Door } from "./nav";

/**
 * A destination's doors: the screens that lived in the old side menu, as one row of chips at the top of the destination
 * (عاداتي · القراءة · المجتمع), so nothing is more than one tap away (the plan of 26 November 2026).
 */
export default function HubDoors({ doors, label }: { doors: readonly Door[]; label: string }) {
  return (
    <nav aria-label={label} className="m-scroll-x -mx-4 px-4 sm:mx-0 sm:px-0">
      <ul className="flex w-max gap-2">
        {doors.map((d) => (
          <li key={d.href}>
            <Link href={d.href} className="m-door">
              <Icon name={d.icon} size={18} />
              {d.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
