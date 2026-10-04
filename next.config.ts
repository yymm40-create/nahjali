import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Template folders are read from disk at runtime, so ship them with the server functions on Vercel
  outputFileTracingIncludes: {
    "/api/**/*": ["./templates/**/*", "./config/style-reference.png", "./assets/fonts/**/*", "./node_modules/harfbuzzjs/dist/*.wasm"],
    // The order page reads the template list
    "/new": ["./templates/*/template.json"],
    // JAWAD AI's icons and share image read the shipped logo from disk
    "/jawad-ai/**/*": ["./public/jawad-ai/logo.png"],
  },
  // sharp is a native module; keep it out of the bundle
  serverExternalPackages: ["sharp", "harfbuzzjs"],
  experimental: {
    // Photo uploads go through a route handler (up to 10 MB)
    proxyClientMaxBodySize: "12mb",
  },
};

export default nextConfig;
