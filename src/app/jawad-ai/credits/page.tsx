import type { Metadata } from "next";
import CreditsShop from "@/components/jawad/credits/CreditsShop";
import { coinBalance } from "@/lib/coins";
import { myCreditOrders } from "@/lib/credits/orders";
import { paylinkEnabled } from "@/lib/credits/paylink";
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
export default async function CreditsPage({ searchParams }: { searchParams: Promise<{ pack?: string; paid?: string; unpaid?: string }> }) {
  const { pack, paid, unpaid } = await searchParams;
  const [{ user, owner }, s, course, units] = await Promise.all([jawadSession(), loadCreditSettings(), loadCourseSettings(), unitPrices().catch(() => null)]);
  const [balance, orders] = user ? await Promise.all([coinBalance(user.id).catch(() => null), myCreditOrders(user.id)]) : [null, []];
  const waiting = orders.filter((o) => o.status === "transferred").map((o) => ({ id: o.id, packName: o.packName, price: o.price, credit: o.credit, support: supportLink(s, { id: o.id, packName: o.packName, price: o.price, email: o.email }) }));
  // back from Paylink: the paid order (one of this buyer's own, already settled by the return route) or «not confirmed»
  const paidOrder = paid ? orders.find((o) => o.id === paid && o.status === "confirmed") : undefined;
  const back = paid || unpaid ? { paid: paidOrder ? { id: paidOrder.id, packName: paidOrder.packName, price: paidOrder.price } : null } : null;
  return (
    <CreditsShop
      packs={s.packs}
      units={units}
      featured={s.featured}
      payable={paylinkEnabled() || !!(course.bank.iban || course.bank.account)}
      bankOk={!!(course.bank.iban || course.bank.account)}
      card={paylinkEnabled()}
      back={back}
      hasSupport={!!s.whatsapp}
      whatsapp={s.whatsapp}
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
