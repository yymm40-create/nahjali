import type { Metadata } from "next";
import CourseLanding, { type OrderView, type Unlocked } from "@/components/jawad/course/CourseLanding";
import { myCourse } from "@/lib/course/orders";
import { loadSettings, publicView } from "@/lib/course/settings";
import { jawadSession } from "@/lib/jawad/server/access";
import { COURSE, isProduct } from "@config/course";
import { JAWAD } from "@config/jawad/brand";
import "./course.css";

export const dynamic = "force-dynamic";

const nowMs = () => Date.now();

export async function generateMetadata(): Promise<Metadata> {
  const s = await loadSettings();
  return { title: COURSE.name, description: s.subhead, openGraph: { title: COURSE.name, description: s.subhead, type: "website" } };
}

/** «دورة الجواد الذكي»: the sales page. Open to everyone with the link; paying needs an account. */
export default async function CoursePage({ searchParams }: { searchParams: Promise<{ buy?: string }> }) {
  const { buy } = await searchParams;
  const [{ user }, s] = await Promise.all([jawadSession(), loadSettings()]);
  const mine = user ? await myCourse(user.id).catch(() => null) : null;
  const orders: OrderView[] = (mine?.orders ?? []).map((o) => ({ id: o.id, product: o.product, status: o.status, amount: o.amount, bonus: o.bonus, lockedUntil: o.lockedUntil, name: o.name, phone: o.phone }));
  // the group link shows from «تم التحويل» (the owner approves each join in WhatsApp); the recorded course only once confirmed
  const unlocked: Unlocked | null = mine?.groupOpen ? { confirmed: mine.unlocked, products: mine.products, groupLink: s.groupLink, recordedLink: mine.unlocked ? s.recordedLink : "" } : null;
  return <CourseLanding s={publicView(s)} serverNow={nowMs()} user={user?.email ? { email: user.email } : null} orders={orders} unlocked={unlocked} buy={isProduct(buy) ? buy : null} loginHref={`${JAWAD.base}/login`} />;
}
