import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  // Playwright and preview builds each use their own .next-* directory (see NEXT_DIST_DIR).
  globalIgnores([".next/**", ".next-*/**", "out/**", "build/**", "test-results*/**", "playwright-report/**", "next-env.d.ts"]),
]);
