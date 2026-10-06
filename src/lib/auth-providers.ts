// Which sign-in ways are switched on in Supabase (Authentication → Providers). «تسجيل الدخول باستخدام Apple» shows
// as soon as the owner turns Apple on there (the App Store asks for it next to Google's), with no change here.

let cached: { at: number; apple: boolean } | null = null;

export async function appleLoginOn() {
  if (cached && Date.now() - cached.at < 5 * 60_000) return cached.apple;
  let apple = false;
  try {
    const r = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "" },
      next: { revalidate: 300 },
    });
    apple = r.ok && (await r.json())?.external?.apple === true;
  } catch {
    apple = false;
  }
  cached = { at: Date.now(), apple };
  return apple;
}
