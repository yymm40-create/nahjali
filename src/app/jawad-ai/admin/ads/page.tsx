import AdsAdmin from "@/components/jawad/admin/AdsAdmin";
import { AD_SLOTS, adRows, adView, emptyAd, liveAds, type AdSlot, type AdView } from "@/lib/jawad/server/ads";
import { requireJawadOwnerPage } from "@/lib/jawad/server/access";

export const metadata = { title: "الإعلانات" };

/** The home page's three ads: edit drafts, preview them, publish. */
export default async function AdsPage() {
  await requireJawadOwnerPage("/jawad-ai/admin/ads");
  const [rows, live] = await Promise.all([adRows(), liveAds()]);
  const draftPreview: Record<AdSlot, AdView | null> = { main: null, side_top: null, side_bottom: null };
  for (const r of rows) {
    const d = { ...emptyAd(), ...r.draft };
    if (d.enabled && d.media && AD_SLOTS.includes(d.slot) && !draftPreview[d.slot]) draftPreview[d.slot] = adView(r.id, d);
  }
  return (
    <AdsAdmin
      ads={rows.map((r) => {
        const d = { ...emptyAd(), ...r.draft };
        return { id: r.id, draft: d, live: r.live, draftView: adView(r.id, d), publishedAt: r.published_at };
      })}
      draftPreview={draftPreview}
      livePreview={live}
    />
  );
}
