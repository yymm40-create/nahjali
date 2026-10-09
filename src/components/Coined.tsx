import SmartCoin from "./SmartCoin";

/**
 * A sentence that holds prices written as «¤2.50» (config/coins.ts → coinStr): each price shows as the coin's logo and the
 * amount, and nothing else — no currency word anywhere. Plain text without prices comes out unchanged.
 */
export default function Coined({ text, size = 13, className = "" }: { text: string | null | undefined; size?: number; className?: string }) {
  const parts = String(text ?? "").split(/(¤\s?\d[\d.,]*|¤)/);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("¤") ? (
          <span key={i} dir="ltr" className={`inline-flex items-center gap-1 whitespace-nowrap align-middle tabular-nums ${className}`}>
            <SmartCoin size={size} />
            {p.slice(1).trim() && <span>{p.slice(1).trim()}</span>}
          </span>
        ) : (
          p
        ),
      )}
    </>
  );
}
