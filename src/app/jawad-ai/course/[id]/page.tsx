import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CourseLanding, { type OrderView, type Unlocked } from "@/components/jawad/course/CourseLanding";
import { myCourse } from "@/lib/course/orders";
import { loadSettings, publicView } from "@/lib/course/settings";
import { jawadSession } from "@/lib/jawad/server/access";
import { loadTree } from "@/lib/learn/server";
import { isProduct } from "@config/course";
import { JAWAD } from "@config/jawad/brand";
import "../course.css";

export const dynamic = "force-dynamic";

const nowMs = () => Date.now();

const forSale = async (id: string) => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [c] = await loadTree({ courseId: id, onlyPublished: true }).catch(() => []);
  return c?.priceSar ? c : null;
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const c = await forSale((await params).id);
  if (!c) return { title: "الدورة" };
  return { title: c.title, description: c.summary, openGraph: { title: c.title, description: c.summary, type: "website" } };
}

/** One course's own sales page (/jawad-ai/course/<id>): its name, its price, its buyers. Another course has another page; an old one stays on sale while it is shown and priced. */
export default async function CourseSalePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ buy?: string }> }) {
  const [{ id }, { buy }] = await Promise.all([params, searchParams]);
  const course = await forSale(id);
  if (!course || !course.priceSar) notFound();
  const [{ user }, s] = await Promise.all([jawadSession(), loadSettings()]);
  const mine = user ? await myCourse(user.id).catch(() => null) : null;
  const own = (mine?.orders ?? []).filter((o) => o.courseId === course.id);
  const orders: OrderView[] = own.map((o) => ({ id: o.id, product: o.product, status: o.status, amount: o.amount, bonus: o.bonus, lockedUntil: o.lockedUntil, name: o.name, phone: o.phone }));
  const confirmed = own.some((o) => o.status === "confirmed");
  const unlocked: Unlocked | null = own.some((o) => o.status === "transferred" || o.status === "confirmed") ? { confirmed, products: confirmed ? ["recorded"] : [], groupLink: "", recordedLink: "" } : null;
  const view = { ...publicView(s), headline: course.title, subhead: course.summary || s.subhead, problem: "", days: [] };
  return <CourseLanding s={view} courseId={course.id} price={course.priceSar} serverNow={nowMs()} user={user?.email ? { email: user.email } : null} orders={orders} unlocked={unlocked} buy={isProduct(buy) ? buy : null} loginHref={`${JAWAD.base}/login`} />;
}
