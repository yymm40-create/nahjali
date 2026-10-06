/** The site's own link to a file of an old public Supabase bucket (served by app/files). */
export const publicFileUrl = (bucket: string, path: string) => `/files/${bucket}/${path.replace(/^\/+/, "").split("/").map(encodeURIComponent).join("/")}`;
