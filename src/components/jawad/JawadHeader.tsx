import Image from "next/image";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { JAWAD } from "@config/jawad/brand";
import type { Runtime } from "@/lib/jawad/server/runtime";
import AccountMenu from "./AccountMenu";
import CoinBalance from "./CoinBalance";
import LoginLink from "./LoginLink";
import SectionsBar from "./SectionsBar";

/** JAWAD AI's compact header: the identity (back to JAWAD AI's home only), the balance and the account; then the sections bar. */
export default function JawadHeader({ rt, user, owner, balance, username }: { rt: Runtime; user: User | null; owner: boolean; balance: number | null; username: string | null }) {
  const sections = rt.sections.filter((s) => s.enabled || owner).map((s) => ({ id: s.id, name: s.name, icon: s.icon, path: s.path, hidden: !s.enabled }));
  return (
    <header className="sticky top-0 z-30">
      <div className="border-b border-jw-line bg-jw-bg/90 backdrop-blur">
        <div className="mx-auto flex h-[var(--jw-header-h)] max-w-[1600px] items-center justify-between gap-3 px-3 sm:px-5">
          <Link href={JAWAD.base} className="flex items-center gap-2.5 rounded-lg" aria-label={`${JAWAD.nameEn} — الرئيسية`}>
            <Image src={rt.brand.logoUrl} alt="" width={36} height={36} priority unoptimized={rt.brand.customLogo} className="size-9 rounded-full object-contain" />
            <span className="flex flex-col leading-tight">
              <span className="text-[15px] font-bold tracking-wide" dir="ltr">{JAWAD.nameEn}</span>
              <span className="text-[11px] text-jw-muted">{JAWAD.nameAr}</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            {user ? (
              <>
                <CoinBalance initial={balance} unlimited={owner} />
                <AccountMenu name={username ?? ""} email={user.email ?? ""} owner={owner} />
              </>
            ) : (
              <LoginLink className="jw-btn jw-btn-primary h-9 min-h-9" />
            )}
          </div>
        </div>
      </div>
      <SectionsBar sections={sections} />
    </header>
  );
}
