import { notFound } from "next/navigation";
import ContentChat from "@/components/jawad/content/ContentChat";
import { contentAllowed } from "@/lib/content/access";
import { jawadLogin, jawadSession } from "@/lib/jawad/server/access";
import { loadRuntime } from "@/lib/jawad/server/runtime";
import { CONTENT } from "@config/content";
import "./content.css";

export const dynamic = "force-dynamic";
export const metadata = { title: CONTENT.name, description: "«محمد باقر» صانع المحتوى بالذكاء الاصطناعي: كاروسيل انستقرام ثابت ومتحرك، ونصوص ريلز ومحتوى يبيع، بأكثر من ١٠٠ ستايل وخطوط عربية." };

/** «صانع المحتوى»: a chat with «محمد باقر». The owner always; others by the owner's switch and the «content» permission. */
export default async function ContentPage() {
  const [{ user, owner }, rt] = await Promise.all([jawadSession(), loadRuntime()]);
  const section = rt.sections.find((s) => s.implementation === "content");
  if (!section) notFound();
  // the page's one heading for search engines and screen readers (the chat draws its own look)
  if (!user)
    return (
      <>
        <h1 className="sr-only">محمد باقر: صانع الكاروسيل والمحتوى بالذكاء الاصطناعي</h1>
        <ContentChat name={section.name} persona={CONTENT.persona} loginHref={jawadLogin(CONTENT.base)} />
      </>
    );
  if (!owner && !(await contentAllowed(user.email))) notFound();
  return <ContentChat name={section.name} persona={CONTENT.persona} loginHref={null} owner={owner} />;
}
