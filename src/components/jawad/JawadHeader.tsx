import Image from "next/image";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { JAWAD } from "@config/jawad/brand";
import type { Runtime } from "@/lib/jawad/server/runtime";
import AccountMenu from "./AccountMenu";
import CoinBalance from "./CoinBalance";
import { SoundToggle } from "@/components/UiSounds";
import LayoutToggle from "./LayoutToggle";
import LoginLink from "./LoginLink";
import ReportButton from "./ReportButton";
import ShareReward from "./ShareReward";
import MemoryMenu from "./MemoryMenu";
import SectionsBar from "./SectionsBar";
import Tour from "./tour/Tour";
import { SECTIONS } from "@config/sections";
import { unifiedStudioNavigation } from "@config/jawad/sections";
import JawadPathRail from "./JawadPathRail";
import { SecretKey } from "@/components/SecretButton";

/** JAWAD AI's compact header: the identity (back to JAWAD AI's home), a way back to نهج علي's home, the balance and the account; then the sections bar. */
/** `preview`: JAWAD AI is still in development for this visitor — identity and account only, no sections or balance. */
export default function JawadHeader({ rt, user, owner, balance, username, preview = false, version = "dev", boss = false }: { rt: Runtime; user: User | null; owner: boolean; /** the site's owner himself (not a free guest): the problem button is his */ boss?: boolean; balance: number | null; username: string | null; preview?: boolean; version?: string }) {
  const sections = unifiedStudioNavigation(rt.sections.filter((s) => s.enabled || owner).map((s) => ({ id: s.id, name: s.name, icon: s.icon, path: s.path, hidden: !s.enabled })));
  const siteSections = SECTIONS.filter((section) => section.key !== "booklet").map((section) => ({ id: section.key, name: section.title, icon: section.icon, path: section.href }));
  return (
    <header className="sticky top-0 z-30">
      <div className="border-b border-jw-line bg-jw-bg/90 backdrop-blur">
        <div className="mx-auto flex h-[var(--jw-header-h)] max-w-[1600px] items-center justify-between gap-3 px-3 sm:px-5">
          <div className="flex items-center gap-1.5">
              <Link href={JAWAD.base} className="flex items-center gap-2.5 rounded-lg" aria-label={`${JAWAD.nameEn} — الرئيسية`}>
            <Image src={rt.brand.logoUrl} alt="" width={36} height={36} priority unoptimized={rt.brand.customLogo} className="size-9 rounded-full object-contain" />
            <span className="flex flex-col leading-tight max-[359px]:hidden">
              <span className="text-[15px] font-bold tracking-wide" dir="ltr">{JAWAD.nameEn}</span>
              <span className="text-[11px] text-jw-muted">{JAWAD.nameAr}</span>
            </span>
          </Link>
          </div>
          <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
            {!preview && <SectionsBar sections={sections} siteSections={siteSections} />}
            {/* on a computer: the whole width, or a phone-wide column */}
            {/* «الدورات»: the shop of courses, for everyone (buying is a page of its own, apart from «دوراتي») */}
            <Link href="/jawad-ai/course" className="jw-course-pill inline-flex h-9 min-h-9 items-center whitespace-nowrap rounded-full px-2.5 text-xs font-bold sm:px-3" title="الدورات: اشترِ دورة">
              🛒<span className="hidden sm:inline">&nbsp;الدورات</span>
            </Link>
            {user && !preview && (
              <Link href="/jawad-ai/learn" className="sr-pill inline-flex h-9 min-h-9 items-center whitespace-nowrap rounded-full px-2.5 text-xs font-bold sm:px-3" title="دوراتي">
                📚<span className="hidden sm:inline">&nbsp;دوراتي</span>
              </Link>
            )}
            {!preview && <ShareReward version={version} loginHref={`${JAWAD.base}/login?next=${encodeURIComponent(JAWAD.base)}`} />}
            {boss && <ReportButton />}
            {user && !preview && <MemoryMenu />}
            {!preview && <LayoutToggle />}
            <SoundToggle />
            {!preview && <SecretKey />}
            {user ? (
              <>
                {!preview && <Tour userId={user.id} />}
                {!preview && <CoinBalance initial={balance} unlimited={owner} />}
                <AccountMenu name={username ?? ""} email={user.email ?? ""} owner={owner} />
              </>
            ) : (
              <LoginLink className="jw-btn jw-btn-primary h-9 min-h-9" />
            )}
          </div>
        </div>
      </div>
      {!preview && <JawadPathRail sections={sections} owner={boss} />}
    </header>
  );
}
