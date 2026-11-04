import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        resolve: {
          alias: {
            "@": fileURLToPath(new URL("./packages/app", import.meta.url)),
          },
          conditions: ["react-server"],
        },
        ssr: {
          resolve: {
            conditions: ["react-server"],
            externalConditions: ["react-server"],
          },
        },
        test: {
          name: "server",
          server: { deps: { inline: ["server-only"] } },
          execArgv: ["--conditions=react-server"],
          include: ["packages/*/tests/**/*.test.ts", "tests/unit/**/*.test.ts"],
          exclude: ["**/*.integration.test.ts"],
        },
      },
      {
        resolve: {
          alias: {
            "@": fileURLToPath(new URL("./packages/app", import.meta.url)),
          },
        },
        test: {
          name: "client",
          environment: "jsdom",
          setupFiles: ["./packages/app/tests-ui/setup.ts"],
          include: [
            "packages/app/tests-ui/**/*.test.{ts,tsx}",
            "packages/ui/tests/**/*.test.tsx",
          ],
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: [
        "packages/*/src/**/*.{ts,tsx}",
        "packages/app/server/**/*.ts",
        "packages/app/scripts/**/*.ts",
        "packages/app/instrumentation.ts",
        "packages/app/next.config.ts",
        "packages/db/migrations/**/*.ts",
        "packages/app/components/**/*.{ts,tsx}",
        "packages/app/app/**/*.{ts,tsx}",
        "scripts/**/*.ts",
      ],
      exclude: ["**/*.d.ts"],
      reporter: ["text", "html", "lcov", "json", "json-summary"],
      thresholds: {
        perFile: true,
        lines: 100,
        branches: 100,
        functions: 100,
        statements: 100,
      },
    },
  },
});
