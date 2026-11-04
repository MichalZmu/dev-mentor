import { afterEach, expect, test, vi } from "vitest";
import { MikroORM } from "@mikro-orm/postgresql";
import { runDomainMigrations } from "../src/migrate";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
test.each([true, false])(
  "explicit migrations close the owned ORM after success=%s",
  async (success) => {
    const up = success
      ? vi.fn().mockResolvedValue(undefined)
      : vi.fn().mockRejectedValue(new Error("migration failed"));
    const close = vi.fn().mockResolvedValue(undefined);
    const initialize = vi
      .spyOn(MikroORM, "init")
      .mockResolvedValue({ migrator: { up }, close } as unknown as Awaited<
        ReturnType<typeof MikroORM.init>
      >);
    vi.stubEnv("DATABASE_URL", "postgresql://test@127.0.0.1:1/unused");
    if (success) await runDomainMigrations();
    else
      await expect(
        runDomainMigrations({ DATABASE_URL: process.env.DATABASE_URL }),
      ).rejects.toThrow("migration failed");
    expect(up).toHaveBeenCalledTimes(1);
    expect(initialize).toHaveBeenCalledWith(
      expect.objectContaining({
        migrations: {
          snapshot: false,
          migrationsList: expect.arrayContaining([expect.any(Function)]),
        },
      }),
    );
    expect(close).toHaveBeenCalledWith(true);
  },
);
