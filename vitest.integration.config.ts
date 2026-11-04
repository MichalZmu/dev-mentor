import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { conditions: ["react-server"] },
  ssr: {
    resolve: {
      conditions: ["react-server"],
      externalConditions: ["react-server"],
    },
  },
  test: {
    server: { deps: { inline: ["server-only"] } },
    execArgv: ["--conditions=react-server"],
    include: [
      "tests/integration/**/*.integration.test.ts",
      "packages/*/tests/**/*.integration.test.ts",
    ],
    testTimeout: 120_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
});
