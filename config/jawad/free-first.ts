// «أول تجربة مجانية» — a limited offer on two branches («حولني الى الستايل الكرتوني» and «في حضرة السيدة زينب (ع)»):
// for 26 hours, the FIRST attempt of each account (one email = one account) is free — one picture. It ends at the
// moment below (UTC); after it the usual prices apply and nothing else changes. To run it again, set a new end.

export const FREE_FIRST_HOURS = 26;
export const FREE_FIRST_ENDS_AT = "2026-10-17T15:13:54Z";
export const freeFirstOpen = (now: number = Date.now()) => now < new Date(FREE_FIRST_ENDS_AT).getTime();

/**
 * Branches the owner closed early (their job prefix): no free attempt there any more, whatever the end above says.
 * «في حضرة السيدة زينب (ع)» — closed by the owner on 2026-10-17: paid only from now on.
 */
export const FREE_FIRST_CLOSED: readonly string[] = ["zaynab_"];
export const freeFirstOpenFor = (prefix: string, now: number = Date.now()) => !FREE_FIRST_CLOSED.includes(prefix) && freeFirstOpen(now);
