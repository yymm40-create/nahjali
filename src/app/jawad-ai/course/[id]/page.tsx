import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CourseLanding, { type OrderView, type Unlocked } from "@/components/jawad/course/CourseLanding";
import { myCourse } from "@/lib/course/orders";
import { loadSettings, publicView } from "@/lib/course/settings";
import { jawadSession } from "@/lib/jawad/server/access";
import { loadTree } from "@/lib/learn/server";
import { DEFAULT_SETTINGS, isLadder, isProduct, type Product } from "@config/course";
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
  // the clock course («دورة صانع المحتوى»): its own words, its terms, and its live group for the live / whole-course buyers
  const ladder = isLadder(s, course.id);
  const paid = own.filter((o) => o.status === "transferred" || o.status === "confirmed");
  const products: Product[] = [...new Set(own.filter((o) => o.status === "confirmed").flatMap((o): Product[] => (o.product === "combo" ? ["combo", "live", "recorded"] : [o.product])))];
  const groupLink = ladder && paid.some((o) => o.product === "live" || o.product === "combo") ? s.groupLink : "";
  const unlocked: Unlocked | null = paid.length ? { confirmed, products: ladder ? products : confirmed ? ["recorded"] : [], groupLink, recordedLink: "" } : null;
  const pub = publicView(s);
  const view = ladder
    ? { ...pub, risks: s.ladderRisks.length ? s.ladderRisks : pub.risks }
    : { ...pub, headline: course.title, subhead: course.summary || DEFAULT_SETTINGS.subhead, problem: "", days: [], terms: "" };
  return <CourseLanding s={view} courseId={course.id} title={course.title} price={course.priceSar} was={course.wasSar ?? course.priceSar} serverNow={nowMs()} user={user?.email ? { email: user.email } : null} orders={orders} unlocked={unlocked} buy={isProduct(buy) ? buy : null} loginHref={`${JAWAD.base}/login`} />;
}
