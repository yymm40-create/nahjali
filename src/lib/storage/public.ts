/** The site's own link to a file of an old public Supabase bucket (served by app/files). */
export const publicFileUrl = (bucket: string, path: string) => `/files/${bucket}/${path.replace(/^\/+/, "").split("/").map(encodeURIComponent).join("/")}`;

/** Buckets whose pictures may be served small (app/files/thumb): the public samples only. */
export const THUMB_BUCKETS = ["jawad-public"] as const;
/** The widths a thumbnail is made at (a few, so the CDN keeps few copies). */
export const THUMB_WIDTHS = [240, 480, 960] as const;

/**
 * A small WebP of a public sample picture, kept by the CDN for a year (app/files/thumb), for a link made by
 * `publicFileUrl` («/files/jawad-public/…»). Anything else — a video, another bucket, an outside link — is left as it is.
 */
export function thumbOf(url: string | null | undefined, width: (typeof THUMB_WIDTHS)[number] = 480): string | null {
  if (!url) return null;
  const m = /^\/files\/([a-z-]+)\/([^?#]+\.(?:png|jpe?g|webp))$/i.exec(url);
  if (!m || !(THUMB_BUCKETS as readonly string[]).includes(m[1])) return url;
  return `/files/thumb/${m[1]}/${m[2]}?w=${width}`;
}
