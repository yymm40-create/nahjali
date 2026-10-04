// «المساعد»: a simple character in a white turban, a thobe and a dark aba with a gold edge, with a friendly robot
// face (drawn for this app). Decorative: the button around it carries the name.
export default function Robot({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false" className={className}>
      {/* aba (cloak) over the shoulders, open at the front */}
      <path d="M10 64c0-14 6-22 15-24h14c9 2 15 10 15 24z" fill="#2b2420" />
      {/* thobe */}
      <path d="M25.5 40h13l2.5 24H23z" fill="#f3eee4" />
      <path d="M32 44v14" stroke="#d6cdbb" strokeWidth="1.2" strokeLinecap="round" />
      {/* gold edges of the aba */}
      <path d="M25.5 40 23 64M38.5 40 41 64" stroke="#d8b45a" strokeWidth="1.6" strokeLinecap="round" />
      {/* neck */}
      <rect x="28" y="36" width="8" height="5" rx="1.5" fill="#9aa5b1" />
      {/* head: metal with a screen face */}
      <rect x="17.5" y="17" width="29" height="22" rx="8" fill="#d3dae1" stroke="#9aa5b1" strokeWidth="1.2" />
      <circle cx="17.5" cy="28" r="2.4" fill="#9aa5b1" />
      <circle cx="46.5" cy="28" r="2.4" fill="#9aa5b1" />
      <rect x="21.5" y="22.5" width="21" height="13" rx="5.5" fill="#1d2632" />
      <circle cx="28" cy="28.2" r="2.3" fill="#8be6ff" />
      <circle cx="36" cy="28.2" r="2.3" fill="#8be6ff" />
      <path d="M29 32.2q3 2.2 6 0" stroke="#8be6ff" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      {/* turban: white wraps */}
      <path d="M15.5 21.5C15 9.5 22 5 32 5s17 4.5 16.5 16.5c-5-2.4-10.6-3.4-16.5-3.4s-11.5 1-16.5 3.4z" fill="#f8f5ef" stroke="#d9d1c2" strokeWidth="1.1" />
      <path d="M18.5 15.5c4-2.6 8.5-3.6 13.5-3.6s9.5 1 13.5 3.6M20.5 10.5c3.4-1.8 7.2-2.6 11.5-2.6s8.1.8 11.5 2.6" stroke="#ddd5c6" strokeWidth="1.1" fill="none" strokeLinecap="round" />
    </svg>
  );
}
