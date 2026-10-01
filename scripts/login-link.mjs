// DEV ONLY: opens a one-time sign-in link for an existing user, without sending an email
// (Supabase's free email service only allows a few emails per hour).
// Usage: node --env-file=.env.local scripts/login-link.mjs you@example.com
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const email = process.argv[2];
if (!email) throw new Error("Usage: node --env-file=.env.local scripts/login-link.mjs <email>");

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
if (error) throw error;

const url = new URL("http://localhost:3000/auth/confirm");
url.searchParams.set("token_hash", data.properties.hashed_token);
url.searchParams.set("type", "magiclink");
url.searchParams.set("next", "/new");
// Open in the default browser; the link is single-use and is not printed
execFileSync("open", [url.toString()]);
console.log(`Opened a sign-in link for ${email} in your browser.`);
