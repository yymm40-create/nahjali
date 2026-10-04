import { notFound } from "next/navigation";

/** Deeper unknown paths under JAWAD AI get JAWAD AI's own "not found" (not the main site's). */
export default function Unknown() {
  notFound();
}
