import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import tseslint from "typescript-eslint";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  { settings: { next: { rootDir: "packages/app/" } } },
  {
    files: [
      "packages/**/*.{ts,tsx}",
      "scripts/**/*.ts",
      "tests/**/*.ts",
      "*.config.ts",
    ],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: ["./packages/*/tsconfig.json", "./tsconfig.tools.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports" },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/explicit-module-boundary-types": "error",
    },
  },
  {
    files: ["packages/core/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            "@devmentor/*",
            "next",
            "next/*",
            "react",
            "react/*",
            "@mikro-orm/*",
            "awilix",
          ],
        },
      ],
    },
  },
  {
    files: ["packages/ui/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            "@devmentor/*",
            "!@devmentor/ui",
            "!@devmentor/ui/*",
            "awilix",
            "@mikro-orm/*",
            "server-only",
          ],
        },
      ],
    },
  },
  {
    files: ["packages/db/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            "@devmentor/app",
            "@devmentor/app/*",
            "@devmentor/ui",
            "@devmentor/ui/*",
          ],
        },
      ],
    },
  },
  globalIgnores([
    "**/node_modules/**",
    "**/.next/**",
    "**/out/**",
    "**/build/**",
    "**/dist/**",
    "**/next-env.d.ts",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "docs/**",
  ]),
]);
