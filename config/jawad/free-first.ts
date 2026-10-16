// «أول تجربة مجانية» — a limited offer on two branches («حولني الى الستايل الكرتوني» and «في حضرة السيدة زينب (ع)»):
// for 26 hours, the FIRST attempt of each account (one email = one account) is free — one picture. It ends at the
// moment below (UTC); after it the usual prices apply and nothing else changes. To run it again, set a new end.

export const FREE_FIRST_HOURS = 26;
export const FREE_FIRST_ENDS_AT = "2026-10-17T15:13:54Z";
export const freeFirstOpen = (now: number = Date.now()) => now < new Date(FREE_FIRST_ENDS_AT).getTime();
