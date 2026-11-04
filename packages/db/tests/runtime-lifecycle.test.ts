import { expect, test, vi } from "vitest";
import { MikroORM } from "@mikro-orm/postgresql";
import { createDatabaseConfig } from "../src/config";
import { createDatabaseProvider } from "../src/runtime";

test("an unused provider closes without initialization and failed initialization can close safely", async () => {
  const initialize = vi.fn(async () => {
    throw new Error("offline");
  });
  const provider = createDatabaseProvider(initialize);
  await provider.close();
  expect(initialize).not.toHaveBeenCalled();
  const pending = provider.get();
  const closing = provider.close();
  await expect(pending).rejects.toThrow("offline");
  await closing;
  expect(initialize).toHaveBeenCalledTimes(1);
});
test("default initialization uses validated process configuration and the exported provider survives module reloads", async () => {
  vi.stubEnv("DATABASE_URL", "postgresql://test@127.0.0.1:1/unused");
  const orm = new MikroORM(createDatabaseConfig());
  const initialize = vi.spyOn(MikroORM, "init").mockResolvedValue(orm);
  const provider = createDatabaseProvider();
  try {
    await expect(provider.get()).resolves.toBe(orm);
    expect(initialize).toHaveBeenCalledWith(
      expect.objectContaining({ clientUrl: process.env.DATABASE_URL }),
    );
    const first = await import("../src/index");
    vi.resetModules();
    const second = await import("../src/runtime");
    expect(second.database).toBe(first.database);
  } finally {
    await provider.close();
    initialize.mockRestore();
    vi.unstubAllEnvs();
  }
});
