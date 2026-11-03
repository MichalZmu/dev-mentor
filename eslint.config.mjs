import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  { settings: { next: { rootDir: "packages/app/" } } },
  {
    files: ["packages/{core,db,ui}/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{ group: ["@devmentor/app", "@devmentor/app/*"], message: "Shared packages must not depend on app." }],
      }],
    },
  },
  {
    files: ["packages/core/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{ group: ["@devmentor/*", "next", "next/*", "react", "react/*", "@mikro-orm/*", "awilix"], message: "core must remain independent of infrastructure and UI." }],
      }],
    },
  },
  {
    files: ["packages/ui/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{ group: ["@devmentor/app", "@devmentor/app/*", "@devmentor/db", "@devmentor/db/*", "awilix", "@mikro-orm/*"], message: "UI must not import server infrastructure." }],
      }],
    },
  },
  {
    files: ["packages/db/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{ group: ["@devmentor/app", "@devmentor/app/*", "@devmentor/ui", "@devmentor/ui/*"], message: "db must not depend on app or UI." }],
      }],
    },
  },
  globalIgnores(["**/node_modules/**", "**/.next/**", "**/out/**", "**/build/**", "**/dist/**", "**/next-env.d.ts"]),
]);
