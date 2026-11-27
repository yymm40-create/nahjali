// «تصويت محبوبة الباري» in «لأجل المهدي»: the solo performances of the qasida «محبوبة الباري» people vote on. Pure data.
// The page is unlisted (/mahdi/vote): no link to it anywhere in the app, not for search engines, only its own address.

export interface VotePerformer {
  /** kept with each vote: never rename one after voting starts */
  id: string;
  name: string;
  /** a still from the qasida's video (public/mahdi/vote) */
  photo: string;
}

export const VOTE_TITLE = "تصويت محبوبة الباري";
export const VOTE_LINE = "اختر أفضل أداء في قصيدة محبوبة الباري";

export const VOTE_PERFORMERS: VotePerformer[] = [
  { id: "hasan-qattan", name: "حسن القطان", photo: "/mahdi/vote/hasan-qattan.webp" },
  { id: "yusuf-owaishir", name: "يوسف العويشير", photo: "/mahdi/vote/yusuf-owaishir.webp" },
  { id: "mahmoud-bukhodor", name: "محمود بوخضر", photo: "/mahdi/vote/mahmoud-bukhodor.webp" },
  { id: "hassoun", name: "حسن العويشير (حسّون)", photo: "/mahdi/vote/hassoun.webp" },
  { id: "mhussain-bukhodor", name: "محمد حسين بوخضر", photo: "/mahdi/vote/mhussain-bukhodor.webp" },
  { id: "mubarak", name: "محمد المبارك", photo: "/mahdi/vote/mubarak.webp" },
  { id: "yusuf-bukhodor", name: "يوسف بوخضر", photo: "/mahdi/vote/yusuf-bukhodor.webp" },
  { id: "hasan-kuwaiti", name: "حسن الكويتي", photo: "/mahdi/vote/hasan-kuwaiti.webp" },
  { id: "abdullah-qattan", name: "عبدالله القطان", photo: "/mahdi/vote/abdullah-qattan.webp" },
];

/** a vote from the public counts 1 point; from «الرواديد» 2 */
export const VOTE_POINTS = { public: 1, radood: 2 } as const;

export const VOTE_LIMITS = {
  name: 40,
  reason: 500,
  /** votes one address may send in an hour (a family on one home connection votes together) */
  perAddressHour: 15,
  /** the same name from the same address again within this time is the same person: refused */
  sameNameMinutes: 24 * 60,
} as const;
