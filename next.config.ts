import type { NextConfig } from "next";

// Shrine pictures approved in /admin/mahdi live in Supabase's public «mahdi-shrines» folder
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL) : null;

// Security headers on every response (the browser's own protections). No script rules here: the site loads scripts and
// models from several places (MediaPipe, fonts, Supabase), and a script policy needs testing page by page first.
const prod = process.env.NODE_ENV === "production";
// no other site may show ours inside a frame (clickjacking); <base> and plugins can't be injected. Not on a built game's page:
// it sends its own, stricter policy (its own sandbox, nothing loaded or sent — see playCsp in config/games-build.ts), and a
// header from here would replace it.
const SITE_CSP = { key: "Content-Security-Policy", value: `frame-ancestors 'self'; base-uri 'self'; object-src 'none'${prod ? "; upgrade-insecure-requests" : ""}` };
const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // a file is read as what it says it is (an uploaded "picture" can't run as a page)
  { key: "X-Content-Type-Options", value: "nosniff" },
  // other sites get our address without the page's path or its query
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // camera and microphone only for our own pages (stories, recording a voice); nothing else asks for the device
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(), payment=(), usb=(), browsing-topics=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  // HTTPS always, for two years (the domains and their subdomains)
  ...(prod ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  // no «X-Powered-By: Next.js»: nothing told about what runs the site
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      { source: "/", headers: [SITE_CSP] },
      { source: "/:path((?!api/games/play/).*)", headers: [SITE_CSP] },
    ];
  },
  // the build the pages were made from: a page kept open compares it with /api/version («في نسخة جديدة»)
  env: { NEXT_PUBLIC_BUILD: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ?? "dev" },
  images: {
    remotePatterns: supabase
      ? [{ protocol: supabase.protocol.replace(":", "") as "http" | "https", hostname: supabase.hostname, port: supabase.port, pathname: "/storage/v1/object/public/mahdi-shrines/**" }]
      : [],
  },
  // Template folders are read from disk at runtime, so ship them with the server functions on Vercel
  outputFileTracingIncludes: {
    "/api/**/*": ["./templates/**/*", "./config/style-reference.png", "./assets/fonts/**/*", "./node_modules/harfbuzzjs/dist/*.wasm"],
    // The owner's diagnostician (🐞) reads the site's own source and the SQL migrations at runtime: ship them (text only)
    "/api/report/diagnose": ["./src/**/*.{ts,tsx,css,json,md}", "./config/**/*.{ts,json,md}", "./supabase/migrations/*.sql", "./tests/**/*.ts", "./AGENTS.md", "./CLAUDE.md", "./package.json", "./next.config.ts"],
    // The order page reads the template list
    "/new": ["./templates/*/template.json"],
    // JAWAD AI's icons and share image read the shipped logo from disk
    "/jawad-ai/**/*": ["./public/jawad-ai/logo.png"],
    // «الطالب الذكي»: the OFL fonts embedded in its PDFs, and the serverless Chromium that prints them
    "/api/jawad/student/**/*": ["./assets/fonts/**/*", "./node_modules/@sparticuz/chromium/bin/**/*"],
  },
  // sharp is a native module; keep it out of the bundle
  serverExternalPackages: ["sharp", "harfbuzzjs", "@sparticuz/chromium", "puppeteer-core"],
  experimental: {
    // Photo uploads go through a route handler (up to 10 MB)
    proxyClientMaxBodySize: "12mb",
  },
};

export default nextConfig;
