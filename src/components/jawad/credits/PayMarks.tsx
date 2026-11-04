// The ways to pay as their own marks (mada, Visa, Mastercard, Apple Pay), each on a small white chip like a card in a wallet:
// buyers in the Gulf know the logos at a glance, faster than any words, and seeing them right above the button answers «can I pay
// with mine?» before the tap. Drawn inline (no files to load); the Visa and Apple glyphs are Simple Icons' paths (CC0).

const VISA = "M9.112 8.262L5.97 15.758H3.92L2.374 9.775c-.094-.368-.175-.503-.461-.658C1.447 8.864.677 8.627 0 8.479l.046-.217h3.3a.904.904 0 01.894.764l.817 4.338 2.018-5.102zm8.033 5.049c.008-1.979-2.736-2.088-2.717-2.972.006-.269.262-.555.822-.628a3.66 3.66 0 011.913.336l.34-1.59a5.207 5.207 0 00-1.814-.333c-1.917 0-3.266 1.02-3.278 2.479-.012 1.079.963 1.68 1.698 2.04.756.367 1.01.603 1.006.931-.005.504-.602.725-1.16.734-.975.015-1.540-.263-1.992-.473l-.351 1.642c.453.208 1.289.39 2.156.398 2.037 0 3.37-1.006 3.377-2.564m5.061 2.447H24l-1.565-7.496h-1.656a.883.883 0 00-.826.55l-2.909 6.946h2.036l.405-1.12h2.488zm-2.163-2.656l1.02-2.815.588 2.815zm-8.16-4.84l-1.603 7.496H8.34l1.605-7.496z";
const APPLE = "M12.152 6.896c-.948 0-2.415-1.078-3.960-1.040-2.040.027-3.910 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.090 1.013 1.454 2.208 3.090 3.792 3.039 1.520-.065 2.090-.987 3.935-.987 1.831 0 2.350.987 3.960.948 1.637-.026 2.676-1.480 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.220-4.857-.026-3.040 2.480-4.494 2.597-4.559-1.429-2.090-3.623-2.324-4.390-2.376-2-.156-3.675 1.090-4.610 1.090zM15.530 3.830c.843-1.012 1.400-2.427 1.245-3.830-1.207.052-2.662.805-3.532 1.818-.780.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701";

function Mada() {
  return (
    <svg viewBox="1 3 56 18" aria-hidden>
      <rect x="2" y="6" width="13" height="5" rx="1" fill="#259bd6" />
      <rect x="2" y="13" width="13" height="5" rx="1" fill="#84b740" />
      <text x="17" y="17" fontFamily="Arial, Helvetica, sans-serif" fontWeight="700" fontSize="15" fill="#1d1d1b">mada</text>
    </svg>
  );
}

function Visa() {
  return (
    <svg viewBox="0 6 24 12" aria-hidden>
      <path d={VISA} fill="#1a1f71" />
    </svg>
  );
}

function Mastercard() {
  return (
    <svg viewBox="0 0 38 24" aria-hidden>
      <circle cx="14" cy="12" r="9" fill="#eb001b" />
      <circle cx="24" cy="12" r="9" fill="#f79e1b" />
      <path d="M19 4.6a9 9 0 0 1 0 14.8 9 9 0 0 1 0-14.8z" fill="#ff5f00" />
    </svg>
  );
}

function ApplePay() {
  return (
    <svg viewBox="0 0 46 24" aria-hidden>
      <path d={APPLE} transform="translate(1 2.2) scale(.8)" fill="#000" />
      <text x="20" y="17.6" fontFamily="-apple-system, 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif" fontWeight="600" fontSize="14" fill="#000">Pay</text>
    </svg>
  );
}

const MARKS = [
  { name: "مدى", Mark: Mada },
  { name: "Visa", Mark: Visa },
  { name: "Mastercard", Mark: Mastercard },
  { name: "Apple Pay", Mark: ApplePay },
] as const;

/** The row of payment marks; `small` for inside a card, the full size under the cards. */
export default function PayMarks({ small = false, label }: { small?: boolean; label?: string }) {
  return (
    <div className={`pm${small ? " sm" : ""}`}>
      {label && <span className="pm-label">{label}</span>}
      <ul className="pm-row" aria-label={`طرق الدفع: ${MARKS.map((m) => m.name).join("، ")}`}>
        {MARKS.map(({ name, Mark }) => (
          <li key={name} className="pm-chip" title={name}>
            <Mark />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A small closed lock, for the pay button. */
export function Lock() {
  return (
    <svg className="pm-lock" viewBox="0 0 24 24" aria-hidden>
      <path d="M7 10V7a5 5 0 0 1 10 0v3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <rect x="4" y="10" width="16" height="11" rx="3" fill="currentColor" />
    </svg>
  );
}
