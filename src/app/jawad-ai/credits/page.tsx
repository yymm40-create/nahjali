import type { Metadata } from "next";
import CreditsShop from "@/components/jawad/credits/CreditsShop";
import { coinBalance } from "@/lib/coins";
import { myCreditOrders } from "@/lib/credits/orders";
import { loadCreditSettings } from "@/lib/credits/settings";
import { unitPrices } from "@/lib/credits/yields";
import { loadSettings as loadCourseSettings } from "@/lib/course/settings";
import { jawadSession } from "@/lib/jawad/server/access";
import { supportLink } from "@config/credits";
import { JAWAD } from "@config/jawad/brand";
import "../course/course.css";
import "./credits.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "اشحن رصيدك", description: "باقات رصيد الجواد الذكي: ادفع بتحويل بنكي ويوصلك الرصيد بعد التأكيد." };

/** «اشحن رصيدك»: the packages, open to everyone; paying needs an account. */
export default async function CreditsPage({ searchParams }: { searchParams: Promise<{ pack?: string }> }) {
  const { pack } = await searchParams;
  const [{ user, owner }, s, course, units] = await Promise.all([jawadSession(), loadCreditSettings(), loadCourseSettings(), unitPrices().catch(() => null)]);
  const [balance, orders] = user ? await Promise.all([coinBalance(user.id).catch(() => null), myCreditOrders(user.id)]) : [null, []];
  const waiting = orders.filter((o) => o.status === "transferred").map((o) => ({ id: o.id, packName: o.packName, price: o.price, credit: o.credit, support: supportLink(s, { id: o.id, packName: o.packName, price: o.price, email: o.email }) }));
  return (
    <CreditsShop
      packs={s.packs}
      units={units}
      featured={s.featured}
      payable={!!(course.bank.iban || course.bank.account)}
      hasSupport={!!s.whatsapp}
      user={user?.email ? { email: user.email } : null}
      balance={owner ? null : balance}
      owner={owner}
      waiting={waiting}
      initialPack={s.packs.some((p) => p.id === pack) ? (pack as string) : null}
      loginHref={`${JAWAD.base}/login`}
      lastName={orders[0]?.name ?? ""}
      lastPhone={orders[0]?.phone ?? ""}
    />
  );
}
