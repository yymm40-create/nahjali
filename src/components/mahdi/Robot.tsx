// «المساعد»: a friendly robot dressed as a Shia cleric (الزي الحوزوي): a white turban (a sheikh's; black is for a
// sayyid) wound round and wide with its folds crossing at the front; a long grey صاية (qaba) whose front panel crosses
// over the other and buttons at the side, over a white thobe whose round collar shows in the V; and an open dark
// aba (بشت) falling from the shoulders. Drawn for this app. Decorative: the button around it carries the name.
export default function Robot({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false" className={className}>
      {/* aba (بشت): open at the front, over both shoulders */}
      <path d="M2 64C2.6 52 9 44.6 21 40h22c12 4.6 18.4 12 19 24z" fill="#29211b" stroke="#4d4136" strokeWidth="1" strokeLinejoin="round" />
      {/* its soft folds falling from the shoulders */}
      <path d="M10.6 50c1.4 4.6 1.6 9.2.8 14M15.6 46.4c.6 6 .4 11.8-.4 17.6M53.4 50c-1.4 4.6-1.6 9.2-.8 14M48.4 46.4c-.6 6-.4 11.8.4 17.6" stroke="#4d4136" strokeWidth="1" fill="none" strokeLinecap="round" />
      {/* صاية (qaba), between the open edges of the aba */}
      <path d="M21.6 40h20.8l4.4 24H17.2z" fill="#9a9385" />
      {/* white thobe in the V of the qaba, with its round collar */}
      <path d="M26.4 39.8h11.2L32 51.6z" fill="#f4efe6" />
      <path d="M27.6 40.2q4.4 2.8 8.8 0" stroke="#d9d1c2" strokeWidth="1" fill="none" strokeLinecap="round" />
      {/* the qaba's front panel crosses over to the side, buttoned */}
      <path d="M37.6 39.8 32 51.6" stroke="#6f685c" strokeWidth="1.1" strokeLinecap="round" />
      <path d="M26.4 39.8 32 51.6l9.6 8.8" stroke="#5f584d" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="35.6" cy="55" r="1" fill="#5f584d" />
      <circle cx="38.8" cy="57.9" r="1" fill="#5f584d" />
      {/* the inner edges of the aba */}
      <path d="M21.6 40 17.2 64M42.4 40 46.8 64" stroke="#14100d" strokeWidth="1.3" strokeLinecap="round" />
      {/* neck */}
      <rect x="28.5" y="35" width="7" height="5.4" rx="1.5" fill="#9aa5b1" />
      {/* head: metal with a screen face */}
      <rect x="18" y="17.5" width="28" height="20.5" rx="8" fill="#d3dae1" stroke="#9aa5b1" strokeWidth="1.2" />
      <circle cx="18" cy="28.5" r="2.3" fill="#9aa5b1" />
      <circle cx="46" cy="28.5" r="2.3" fill="#9aa5b1" />
      <rect x="21.8" y="23" width="20.4" height="12.4" rx="5.4" fill="#1d2632" />
      <circle cx="28.2" cy="28.6" r="2.2" fill="#8be6ff" />
      <circle cx="35.8" cy="28.6" r="2.2" fill="#8be6ff" />
      <path d="M29.2 32.4q2.8 2 5.6 0" stroke="#8be6ff" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      {/* turban (عمامة): a wide round roll, wider than the head, sitting low over the forehead */}
      <path d="M14 22.4C11.2 17.4 11.6 10.6 16.8 7.4 20.8 5 26.4 4.2 32 4.2s11.2.8 15.2 3.2c5.2 3.2 5.6 10 2.8 15-5-1.9-11.2-2.8-18-2.8s-13 .9-18 2.8z" fill="#f8f5ef" stroke="#cbc1b0" strokeWidth="1.1" strokeLinejoin="round" />
      {/* its wraps, wound from both sides and crossing over each other at the front */}
      <path d="M15.2 15.6c5-3.8 10.8-7.6 18.6-10.6M14.8 10.6c3.8-2.4 7.6-4.4 12-5.6" stroke="#ddd4c4" strokeWidth="1.1" fill="none" strokeLinecap="round" />
      <path d="M48.8 15.6c-5-3.8-10.8-7.6-18.6-10.6M49.2 10.6c-3.8-2.4-7.6-4.4-12-5.6M42.4 19.6c-3.2-3.6-6.4-6.6-10.4-9.4" stroke="#cbc1b0" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      {/* the lowest wrap, across the forehead */}
      <path d="M14.4 19.8c5.4-1.9 11.2-2.8 17.6-2.8s12.2.9 17.6 2.8" stroke="#ddd4c4" strokeWidth="1.1" fill="none" strokeLinecap="round" />
    </svg>
  );
}
