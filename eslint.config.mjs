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
    // Supabase Edge Functions are a separate Deno deployment target, not
    // part of the Next.js app — same reasoning as tsconfig.json's
    // "supabase/functions/**" exclude, mirrored here since ESLint has its
    // own file-discovery config and doesn't read tsconfig's `exclude`.
    "supabase/functions/**",
  ]),
]);

export default eslintConfig;
