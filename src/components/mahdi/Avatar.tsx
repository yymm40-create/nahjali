import { FRAME_STYLES } from "@config/mahdi-rewards";
import type { Profile } from "@/lib/mahdi/types";

/** Profile picture, or the first letter of the name when there is none. */
export default function Avatar({ profile, size = 44 }: { profile: Pick<Profile, "displayName" | "avatarUrl"> & { frame?: string }; size?: number }) {
  const letter = [...profile.displayName.trim()][0] ?? "؟";
  return (
    <span
      className="inline-grid shrink-0 place-items-center overflow-hidden rounded-full font-semibold"
      style={{ width: size, height: size, fontSize: size * 0.42, background: "linear-gradient(180deg, var(--m-gold-2), var(--m-gold))", color: "var(--m-gold-ink)", boxShadow: profile.frame ? FRAME_STYLES[profile.frame] : undefined }}
      aria-hidden="true"
    >
      {profile.avatarUrl ? (
        // A small user picture from storage; next/image would need the storage host whitelisted for no gain here
        // eslint-disable-next-line @next/next/no-img-element
        <img src={profile.avatarUrl} alt="" width={size} height={size} className="size-full object-cover" loading="lazy" decoding="async" />
      ) : (
        letter
      )}
    </span>
  );
}
