// Stand-ins for next/link, next/navigation and next/image, so «لأجل المهدي» pages draw in a plain browser page.
// The path the pages see is the real one of the screen being drawn (window.__PV_PATH), so the menus highlight it.
import type { ReactNode } from "react";

declare global {
  interface Window {
    __PV_PATH?: string;
  }
}

const path = () => (typeof window === "undefined" ? "/mahdi" : (window.__PV_PATH ?? location.pathname));

export default function Link({ href, children, prefetch: _p, replace: _r, scroll: _s, ...rest }: { href: string | { pathname: string }; children: ReactNode } & Record<string, unknown>) {
  const to = typeof href === "string" ? href : href.pathname;
  return (
    <a href={to} {...rest} onClick={(e) => { e.preventDefault(); (rest.onClick as ((e: unknown) => void) | undefined)?.(e); }}>
      {children}
    </a>
  );
}

const router = { push: (u: string) => console.log("push", u), replace: (u: string) => console.log("replace", u), refresh: () => {}, back: () => {}, forward: () => {}, prefetch: () => {} };
export const useRouter = () => router;
export const usePathname = () => path();
export const useSearchParams = () => new URLSearchParams(typeof location === "undefined" ? "" : location.search.replace(/[?&]page=[^&]*/, ""));
export const useParams = () => ({});
export const redirect = (u: string) => { throw new Error(`redirect ${u}`); };
export const notFound = () => { throw new Error("notFound"); };

/** next/image: a plain <img>; `fill` stretches it over its positioned parent. */
export function Image({ src, alt, fill, width, height, style, className, sizes: _s, priority: _p, loading, fetchPriority: _f, unoptimized: _u, placeholder: _ph, quality: _q, ...rest }: Record<string, unknown>) {
  const s = typeof src === "string" ? src : (src as { src: string })?.src;
  const fillStyle: React.CSSProperties = fill ? { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" } : {};
  return <img src={s} alt={alt as string} width={fill ? undefined : (width as number)} height={fill ? undefined : (height as number)} className={className as string} loading={loading as "eager" | "lazy"} style={{ ...fillStyle, ...(style as object) }} {...rest} />;
}
