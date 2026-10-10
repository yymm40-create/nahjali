// The site's browser-tab icon: JAWAD AI's logo (the site is «الجواد الذكي» only while «نهج علي» is hidden, config/site.ts).
// «نهج علي»'s own icons are kept in public/brand/nahjali-icon.png and nahjali-apple-icon.png: to bring them back, move them here
// as icon.png / apple-icon.png and delete this file and apple-icon.tsx.
import Icon from "./jawad-ai/icon";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";
export const revalidate = 600;
export default Icon;
