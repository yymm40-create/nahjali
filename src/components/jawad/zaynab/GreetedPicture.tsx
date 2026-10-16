"use client";

import { useEffect, useState } from "react";
import { ZAYNAB_GREETING } from "@config/jawad/zaynab";
import { greet } from "./greeting";

/** A finished picture with the greeting written over its top (the plain picture when it can't be, or isn't wanted). */
export default function GreetedPicture({ url, downloadUrl, greeting, family }: { url: string; downloadUrl: string; greeting: boolean; family: string }) {
  const [made, setMade] = useState<{ src: string; url: string } | null>(null);
  useEffect(() => {
    if (!greeting) return;
    let alive = true;
    let blobUrl = "";
    greet(url, ZAYNAB_GREETING, family)
      .then((blob) => {
        blobUrl = URL.createObjectURL(blob);
        if (alive) setMade({ src: url, url: blobUrl });
        else URL.revokeObjectURL(blobUrl);
      })
      .catch(() => {});
    return () => {
      alive = false;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [url, greeting, family]);
  const shown = greeting && made?.src === url ? made.url : url;
  const written = shown !== url;
  return (
    <figure>
      {/* eslint-disable-next-line @next/next/no-img-element -- a result kept in the person's storage */}
      <img src={shown} alt="صورتك في حضرة السيدة زينب عليها السلام" />
      <a href={written ? shown : downloadUrl} download={written ? "zaynab-greeting.png" : undefined}>تنزيل الصورة ↓</a>
    </figure>
  );
}
