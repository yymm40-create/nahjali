"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/** Sections that bring their own header, layout and footer (they are full apps of their own). */
const OWN_CHROME = ["/mahdi", "/jawad-ai"];

/** The site's banner, header, centred column and footer — except inside sections with their own chrome. */
export default function SiteChrome({ top, bottom, children }: { top: React.ReactNode; bottom: React.ReactNode; children: React.ReactNode }) {
  const pathname = usePathname();
  const own = OWN_CHROME.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  // Opened inside JAWAD AI (rendered without the main chrome) and then left by the browser's back/forward buttons:
  // load the page fully so the main site gets its header and footer again
  const missing = !own && top === null;
  useEffect(() => {
    if (missing) window.location.reload();
  }, [missing]);
  if (own || missing) return <>{children}</>;
  return (
    <>
      {top}
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-16 pt-4">{children}</main>
      {bottom}
    </>
  );
}
