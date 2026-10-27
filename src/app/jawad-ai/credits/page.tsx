import type { Metadata } from "next";
import CreditsShop from "@/components/jawad/credits/CreditsShop";
import { coinBalance } from "@/lib/coins";
import { myCreditOrders } from "@/lib/credits/orders";
import { paylinkEnabled } from "@/lib/credits/paylink";
import { loadCreditSettings } from "@/lib/credits/settings";
import { unitPrices } from "@/lib/credits/yields";
import { loadSettings as loadCourseSettings } from "@/lib/course/settings";
import { jawadSession } from "@/lib/jawad/server/access";
import { contactComplete, contactOf } from "@/lib/contact";
import { exactPackOf, supportLink } from "@config/credits";
import { BANK_TRANSFER_ENABLED, CARD_PAYMENT_PUBLIC } from "@config/pricing";
import { JAWAD } from "@config/jawad/brand";
import "../course/course.css";
import "./credits.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "اشحن رصيدك", description: "باقات رصيد الجواد الذكي: اختر باقتك وادفع بضغطة وحدة." };

/** «اشحن رصيدك»: the packages, open to everyone; paying needs an account with a name and a WhatsApp number (read from it, not asked here). */
export default async function CreditsPage({ searchParams }: { searchParams: Promise<{ pack?: string; paid?: string; unpaid?: string; for?: string }> }) {
  const { pack, paid, unpaid, for: forWhat } = await searchParams;
  // «خلص رصيدك»: a top-up of exactly what an operation needed (exact-<riyals>), offered above the packages
  const exact = exactPackOf(pack);
  const [{ user, owner }, s, course, units] = await Promise.all([jawadSession(), loadCreditSettings(), loadCourseSettings(), unitPrices().catch(() => null)]);
  const [balance, orders] = user ? await Promise.all([coinBalance(user.id).catch(() => null), myCreditOrders(user.id)]) : [null, []];
  const waiting = orders.filter((o) => o.status === "transferred").map((o) => ({ id: o.id, packName: o.packName, price: o.price, credit: o.credit, support: supportLink(s, { id: o.id, packName: o.packName, price: o.price, email: o.email }) }));
  // back from Paylink: the paid order (one of this buyer's own, already settled by the return route) or «not confirmed»
  const paidOrder = paid ? orders.find((o) => o.id === paid && o.status === "confirmed") : undefined;
  const back = paid || unpaid ? { paid: paidOrder ? { id: paidOrder.id, packName: paidOrder.packName, price: paidOrder.price } : null } : null;
  const contactOk = !!user && contactComplete(contactOf(user));
  const bankOk = BANK_TRANSFER_ENABLED && !!(course.bank.iban || course.bank.account);
  return (
    <CreditsShop
      packs={s.packs}
      units={units}
      featured={s.featured}
      bankOk={bankOk}
      card={paylinkEnabled() && (owner || CARD_PAYMENT_PUBLIC)}
      cardSoon={!CARD_PAYMENT_PUBLIC}
      back={back}
      hasSupport={!!s.whatsapp}
      whatsapp={s.whatsapp}
      user={user?.email ? { email: user.email } : null}
      contactOk={contactOk}
      balance={owner ? null : balance}
      owner={owner}
      waiting={waiting}
      exact={exact ? { pack: exact, what: typeof forWhat === "string" ? forWhat.slice(0, 40) : "" } : null}
      initialPack={s.packs.some((p) => p.id === pack) || exact ? (pack as string) : null}
      loginHref={`${JAWAD.base}/login`}
    />
  );
}
