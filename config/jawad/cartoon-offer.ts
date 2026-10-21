// «حولني الى الستايل الكرتوني» · the opening offer (the owner's order, opened 21 October 2026): the FIRST 20 accounts
// (one email = one account) get their first attempt free — its first picture — and only the FIRST 2 accounts get one
// film free — its first 15-second part. One each per account; an attempt that failed does not count. Counted from the
// moment below; to run it again, set a new start (and the limits).

export const CARTOON_OFFER = { startsAt: "2026-10-21T20:22:21Z", pictures: 20, videos: 2 } as const;
export type CartoonOfferKind = "pic" | "video";
export const offerLimit = (kind: CartoonOfferKind) => (kind === "pic" ? CARTOON_OFFER.pictures : CARTOON_OFFER.videos);
