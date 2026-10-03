// Makes the keys Web Push needs for «لأجل المهدي». Run once:   npx tsx scripts/generate-mahdi-vapid.mts
// It only PRINTS them. Copy the values into your hosting environment (Vercel → Settings → Environment Variables) and
// into .env.local for local tests. Never commit them. Run it again only if you want to replace the keys
// (every device then has to turn notifications on again).
import { randomBytes } from "node:crypto";
import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();
const secret = randomBytes(32).toString("base64url");

console.log(`
Copy these 4 lines into Vercel (Production + Preview) and into .env.local:

NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}
VAPID_PRIVATE_KEY=${keys.privateKey}
VAPID_SUBJECT=mailto:yymm40@gmail.com
MAHDI_CRON_SECRET=${secret}

Notes:
  • VAPID_PRIVATE_KEY and MAHDI_CRON_SECRET are secrets: server only, never in the browser, never in git.
  • NEXT_PUBLIC_VAPID_PUBLIC_KEY is public by design, but it is read when the site is built, so redeploy after adding it.
  • Use the same MAHDI_CRON_SECRET inside supabase/migrations/0009_mahdi_notifications_cron.sql (step 1 in that file).
`);
