// «قالوا عن الجواد»: real words from real customers, shown on the front page as they wrote them (spelling and all) — never
// edited, never made up, and without their names unless they agreed. The owner adds each one from a customer's message.

export interface Testimonial {
  /** the customer's own words, one bubble each, exactly as sent */
  said: string[];
  /** who they are, without a name (e.g. «عميلة من منصة الجواد») */
  who: string;
  /** when it was sent (YYYY-MM-DD) */
  at: string;
}

export const TESTIMONIALS: Testimonial[] = [
  {
    said: [
      "ان شاء الله بحطهم بوووست وبمنشن لكم\nشكرا الله يعطيكم العافية\nوتنشكرون على هالجهد الجبار",
      "فعلا احس اني سعييدة\nاول انجاز احققه في منصة الجواد",
    ],
    who: "عميلة من منصة الجواد",
    at: "2026-10-29",
  },
];
