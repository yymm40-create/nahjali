import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // the desktop program (its own package, plain Node)
    "desktop/**",
    "mobile/**",
    // the owner's installed skills (vendor code, kept verbatim — never "fixed" to pass our lint)
    "config/editor/skills/higgsfield-motion/**",
    "config/editor/skills/higgsfield-motion-saas/**",
    "public/editor/skills/**",
  ]),
]);

export default eslintConfig;
