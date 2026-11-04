import { afterEach, expect, test, vi } from "vitest";
import { fileURLToPath } from "node:url";
import { Migrator } from "@mikro-orm/migrations";
vi.mock("dotenv", () => ({ config: vi.fn() }));
afterEach(() => {
  vi.unstubAllEnvs();
});
test("CLI migration configuration disables filesystem snapshots and resolves migrations beside the package", async () => {
  vi.stubEnv("DATABASE_URL", "postgresql://test@127.0.0.1:1/unused");
  const { default: config } = await import("../mikro-orm.config");
  expect(config.migrations).toEqual({
    snapshot: false,
    path: fileURLToPath(new URL("../migrations", import.meta.url)),
    emit: "ts",
  });
  expect(config.extensions).toEqual([Migrator]);
  expect(config.clientUrl).toBe(process.env.DATABASE_URL);
});
