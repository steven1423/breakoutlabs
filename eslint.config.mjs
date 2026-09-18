import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  // public/ holds third-party model bundles served as-is; they are not ours to lint.
  globalIgnores([".next/**", "out/**", "node_modules/**", "next-env.d.ts", "public/**"]),
]);
