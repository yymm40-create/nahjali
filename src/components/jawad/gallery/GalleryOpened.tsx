"use client";

import { useEffect } from "react";
import { track } from "@/lib/feature-track";

/** «استخدام المزايا»: «معرض الناس» was opened (counted for a signed-in person only). */
export default function GalleryOpened() {
  useEffect(() => track("studio.gallery_open"), []);
  return null;
}
