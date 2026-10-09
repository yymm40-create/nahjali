import { redirect } from "next/navigation";

// The site's home is «الجواد الذكي» (www.aljawadai.app opens it directly). The old home — «نهج علي» and «لأجل المهدي»
// side by side — is cancelled for now: it is kept whole in src/components/HomeLanding.tsx, and putting it back is
// returning this page to `export { default } from "@/components/HomeLanding"` (and removing the redirect in src/proxy.ts).
export default function Home() {
  redirect("/jawad-ai");
}
