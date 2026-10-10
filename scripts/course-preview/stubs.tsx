// Stand-ins for Next's Link and router, so the page can be drawn in a plain browser page.
import type { ReactNode } from "react";
export default function Link({ href, children, ...rest }: { href: string; children: ReactNode } & Record<string, unknown>) {
  return <a href={href} {...rest}>{children}</a>;
}
export const useRouter = () => ({ push: (u: string) => console.log("push", u), refresh: () => {} });
