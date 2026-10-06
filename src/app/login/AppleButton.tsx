/** «تسجيل الدخول باستخدام Apple» (Apple's own look: black, the logo, the words). The server starts it, like Google's. */
export default function AppleButton({ next }: { next: string }) {
  return (
    <a href={`/auth/apple?next=${encodeURIComponent(next)}`} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-black px-4 text-base font-bold text-white">
      <svg width="18" height="22" viewBox="0 0 814 1000" fill="currentColor" aria-hidden>
        <path d="M788 341c-6 4-108 62-108 190 0 148 130 200 134 202-1 3-21 72-69 142-43 62-88 124-156 124s-86-40-165-40c-77 0-104 41-166 41s-106-58-156-128C44 790 0 671 0 557c0-182 118-279 235-279 62 0 114 41 153 41 37 0 95-43 166-43 27 0 124 2 188 95zM554 170c29-35 50-83 50-131 0-7-1-13-2-19-47 2-104 32-138 72-27 30-52 78-52 127 0 7 1 15 2 17 3 1 8 1 13 1 43 0 97-29 127-67z" />
      </svg>
      تسجيل الدخول باستخدام Apple
    </a>
  );
}
