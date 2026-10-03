"use client";

import { usePathname } from "next/navigation";

/** Sections that bring their own header, layout and footer (they are full apps of their own). */
const OWN_CHROME = ["/mahdi"];

/** The site's banner, header, centred column and footer — except inside sections with their own chrome. */
export default function SiteChrome({ top, bottom, children }: { top: React.ReactNode; bottom: React.ReactNode; children: React.ReactNode }) {
  const pathname = usePathname();
  if (OWN_CHROME.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return <>{children}</>;
  return (
    <>
      {top}
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-16 pt-4">{children}</main>
      {bottom}
    </>
  );
}
