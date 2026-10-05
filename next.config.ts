import type { NextConfig } from "next";

// Shrine pictures approved in /admin/mahdi live in Supabase's public «mahdi-shrines» folder
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL) : null;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: supabase
      ? [{ protocol: supabase.protocol.replace(":", "") as "http" | "https", hostname: supabase.hostname, port: supabase.port, pathname: "/storage/v1/object/public/mahdi-shrines/**" }]
      : [],
  },
  // Template folders are read from disk at runtime, so ship them with the server functions on Vercel
  outputFileTracingIncludes: {
    "/api/**/*": ["./templates/**/*", "./config/style-reference.png", "./assets/fonts/**/*", "./node_modules/harfbuzzjs/dist/*.wasm"],
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
