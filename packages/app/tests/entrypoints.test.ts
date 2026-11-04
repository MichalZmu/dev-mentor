import { afterEach, beforeEach, expect, test, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  config: vi.fn(),
  auth: vi.fn(),
  env: vi.fn(),
  query: vi.fn(),
  end: vi.fn(),
  connect: vi.fn(),
  clientQuery: vi.fn(),
  release: vi.fn(),
  migrations: vi.fn(),
  runMigrations: vi.fn(),
  domainMigrations: vi.fn(),
  get: vi.fn(),
  close: vi.fn(),
  entityManager: vi.fn(),
  seed: vi.fn(),
  password: vi.fn(),
  uuid: vi.fn(),
  worker: vi.fn(),
  closeAuth: vi.fn(),
  log: vi.fn(),
  sleep: vi.fn(),
  telemetry: vi.fn(),
}));
vi.mock("dotenv", () => ({ config: mocks.config }));
vi.mock("../server/auth", () => ({
  createAuthRuntime: mocks.auth,
  closeAuthRuntime: mocks.closeAuth,
}));
vi.mock("../server/env", () => ({ runtimeEnvironment: mocks.env }));
vi.mock("better-auth/db/migration", () => ({
  getMigrations: mocks.migrations,
}));
vi.mock("better-auth/crypto", () => ({ hashPassword: mocks.password }));
vi.mock("node:crypto", () => ({ randomUUID: mocks.uuid }));
vi.mock("@devmentor/db", () => ({
  runDomainMigrations: mocks.domainMigrations,
  database: { get: mocks.get, close: mocks.close },
  withEntityManager: mocks.entityManager,
  seedDemoPlatform: mocks.seed,
}));
vi.mock("../server/worker", () => ({ runWorkerOnce: mocks.worker }));
vi.mock("../server/log", () => ({ logEvent: mocks.log }));
vi.mock("node:timers/promises", () => ({ setTimeout: mocks.sleep }));
vi.mock("../server/telemetry", () => ({ startTelemetry: mocks.telemetry }));
const originalArgv = process.argv;
const originalExitCode = process.exitCode;
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  process.exitCode = 0;
  process.argv = ["node", "script"];
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.env.mockImplementation((env: unknown) => env ?? { APP_MODE: "demo" });
  mocks.auth.mockReturnValue({
    env: { APP_MODE: "demo" },
    auth: { options: {} },
    pool: { query: mocks.query, end: mocks.end, connect: mocks.connect },
  });
  mocks.query.mockResolvedValue({ rows: [] });
  mocks.connect.mockResolvedValue({
    query: mocks.clientQuery,
    release: mocks.release,
  });
  mocks.clientQuery.mockResolvedValue({ rows: [] });
  mocks.migrations.mockResolvedValue({ runMigrations: mocks.runMigrations });
  mocks.password.mockResolvedValue("hash");
  mocks.uuid.mockReturnValue("generated-id");
  mocks.get.mockResolvedValue("orm");
  mocks.entityManager.mockImplementation(
    (_orm: unknown, callback: (em: unknown) => unknown) => callback("em"),
  );
  mocks.worker.mockResolvedValue({ processed: 2, failed: 1 });
});
afterEach(() => {
  process.argv = originalArgv;
  process.exitCode = originalExitCode;
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
test("migration CLI respects separate auth/domain URLs and always closes the auth pool", async () => {
  for (const name of [
    "DATABASE_URL",
    "MIGRATION_DATABASE_URL",
    "AUTH_DATABASE_URL",
    "AUTH_MIGRATION_DATABASE_URL",
  ])
    vi.stubEnv(name, undefined);
  await import("../scripts/migrate");
  expect(mocks.domainMigrations).toHaveBeenCalledWith(
    expect.objectContaining({
      DATABASE_URL: undefined,
      AUTH_DATABASE_URL: undefined,
    }),
  );
  expect(mocks.query).toHaveBeenCalledWith("create schema if not exists auth");
  expect(mocks.runMigrations).toHaveBeenCalledOnce();
  expect(mocks.end).toHaveBeenCalledOnce();
  for (const [values, domain, auth] of [
    [{ DATABASE_URL: "app" }, "app", "app"],
    [{ DATABASE_URL: "app", AUTH_DATABASE_URL: "auth" }, "app", "auth"],
    [
      { DATABASE_URL: "app", MIGRATION_DATABASE_URL: "migration" },
      "migration",
      "migration",
    ],
    [
      {
        MIGRATION_DATABASE_URL: "migration",
        AUTH_MIGRATION_DATABASE_URL: "auth_migration",
      },
      "migration",
      "auth_migration",
    ],
  ] as const) {
    vi.resetModules();
    for (const name of [
      "DATABASE_URL",
      "MIGRATION_DATABASE_URL",
      "AUTH_DATABASE_URL",
      "AUTH_MIGRATION_DATABASE_URL",
    ])
      vi.stubEnv(name, undefined);
    for (const [key, value] of Object.entries(values)) vi.stubEnv(key, value);
    await import("../scripts/migrate");
    expect(mocks.domainMigrations).toHaveBeenLastCalledWith(
      expect.objectContaining({
        DATABASE_URL: domain,
        AUTH_DATABASE_URL: auth,
      }),
    );
  }
  vi.resetModules();
  mocks.runMigrations.mockRejectedValueOnce(new Error("secret"));
  await import("../scripts/migrate");
  expect(process.exitCode).toBe(1);
  expect(console.error).toHaveBeenCalledWith(
    expect.stringContaining("MIGRATIONS_FAILED"),
  );
  expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
    "secret",
  );
  expect(mocks.end).toHaveBeenCalledTimes(6);
});
test("demo seed reuses accounts, seeds domain data and closes resources", async () => {
  mocks.query.mockResolvedValue({ rows: [{ id: "existing" }] });
  await import("../scripts/seed-demo");
  expect(mocks.connect).not.toHaveBeenCalled();
  expect(mocks.entityManager).toHaveBeenCalledWith("orm", expect.any(Function));
  expect(mocks.seed).toHaveBeenCalledWith("em", {
    menteeId: "existing",
    mentorId: "existing",
    adminId: "existing",
  });
  expect(mocks.end).toHaveBeenCalledOnce();
  expect(mocks.close).toHaveBeenCalledOnce();
});
test("new demo accounts hash passwords and commit each identity before domain seeding", async () => {
  await import("../scripts/seed-demo");
  expect(mocks.password).toHaveBeenCalledTimes(3);
  expect(mocks.password).toHaveBeenCalledWith("DemoOnly_2026!");
  expect(mocks.clientQuery).toHaveBeenCalledWith("begin");
  expect(mocks.clientQuery).toHaveBeenCalledWith("commit");
  expect(mocks.release).toHaveBeenCalledTimes(3);
  expect(process.exitCode).toBe(0);
});
test("demo seed rolls back failed identity inserts and reports a safe error", async () => {
  mocks.clientQuery.mockRejectedValueOnce(new Error("secret"));
  await import("../scripts/seed-demo");
  expect(mocks.clientQuery).toHaveBeenCalledWith("rollback");
  expect(mocks.release).toHaveBeenCalledOnce();
  expect(mocks.seed).not.toHaveBeenCalled();
  expect(process.exitCode).toBe(1);
  expect(mocks.end).toHaveBeenCalledOnce();
  expect(mocks.close).toHaveBeenCalledOnce();
  expect(console.error).toHaveBeenCalledWith(
    expect.stringContaining("DEMO_SEED_FAILED"),
  );
});
test("demo seed rejects production mode before making identity changes", async () => {
  mocks.auth.mockReturnValueOnce({ env: { APP_MODE: "production" } });
  await expect(import("../scripts/seed-demo")).rejects.toThrow(
    "Demo seed requires APP_MODE=demo",
  );
  expect(mocks.query).not.toHaveBeenCalled();
});
test("worker once records results or errors and always closes resources", async () => {
  process.argv = ["node", "worker", "--once"];
  await import("../scripts/worker");
  expect(mocks.log).toHaveBeenCalledWith(
    "info",
    "worker.tick",
    "worker",
    "PROCESSED_2_FAILED_1",
  );
  expect(mocks.closeAuth).toHaveBeenCalledOnce();
  expect(mocks.close).toHaveBeenCalledOnce();
  expect(mocks.sleep).not.toHaveBeenCalled();
  vi.resetModules();
  mocks.worker.mockRejectedValueOnce(new Error("secret"));
  await import("../scripts/worker");
  expect(process.exitCode).toBe(1);
  expect(mocks.log).toHaveBeenCalledWith(
    "error",
    "worker.tick",
    "worker",
    "WORKER_UNAVAILABLE",
  );
});
test("worker loop continues after errors and exits on either shutdown signal", async () => {
  for (const signal of ["SIGINT", "SIGTERM"]) {
    vi.resetModules();
    const callbacks = new Map<string, () => void>();
    vi.spyOn(process, "on").mockImplementation((event, listener) => {
      callbacks.set(String(event), listener as () => void);
      return process;
    });
    mocks.worker.mockRejectedValueOnce(new Error("offline"));
    mocks.sleep
      .mockImplementationOnce(async () => {})
      .mockImplementationOnce(async () => {
        callbacks.get(signal)?.();
      });
    await import("../scripts/worker");
    expect(process.exitCode).toBe(0);
    expect(mocks.sleep).toHaveBeenCalledWith(1000);
  }
});
test("Next instrumentation only starts server telemetry in node runtime", async () => {
  const { register } = await import("../instrumentation");
  vi.stubEnv("NEXT_RUNTIME", "edge");
  await register();
  expect(mocks.telemetry).not.toHaveBeenCalled();
  vi.stubEnv("NEXT_RUNTIME", "nodejs");
  await register();
  expect(mocks.telemetry).toHaveBeenCalledOnce();
});
