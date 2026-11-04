import { afterEach, beforeEach, expect, test, vi } from "vitest";

const stub = vi.hoisted(() => ({
  get: vi.fn(),
  close: vi.fn(),
  execute: vi.fn(),
  config: vi.fn(),
}));
vi.mock("dotenv", () => ({ config: stub.config }));
vi.mock("../src/runtime", () => ({
  createDatabaseProvider: () => ({ get: stub.get, close: stub.close }),
  withEntityManager: (_orm: unknown, callback: (em: unknown) => unknown) =>
    callback({ getConnection: () => ({ execute: stub.execute }) }),
}));
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  stub.get.mockResolvedValue({});
  stub.close.mockResolvedValue(undefined);
  stub.execute.mockResolvedValue([]);
});
afterEach(() => {
  vi.restoreAllMocks();
  process.exitCode = undefined;
});
test("database CLI loads the root environment and emits only a safe success event", async () => {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  await import("../src/check");
  expect(stub.config).toHaveBeenCalledWith({
    path: expect.stringMatching(/dev-mentor\/\.env$/),
    quiet: true,
  });
  expect(stub.execute).toHaveBeenCalledWith("select 1");
  const serialized: unknown = JSON.parse(String(log.mock.calls[0]?.[0]));
  expect(serialized).toMatchObject({
    level: "info",
    operation: "database.check",
    code: "DATABASE_OK",
    requestId: expect.any(String),
  });
  expect(stub.close).toHaveBeenCalledTimes(1);
});
test.each(["initialization", "query"])(
  "database CLI hides %s errors, fails and closes its provider",
  async (failure) => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    if (failure === "initialization")
      stub.get.mockRejectedValue(new Error("password and SQL"));
    else stub.execute.mockRejectedValue(new Error("password and SQL"));
    await import("../src/check");
    expect(process.exitCode).toBe(1);
    const serialized = String(error.mock.calls[0]?.[0]);
    expect(JSON.parse(serialized)).toMatchObject({
      level: "error",
      code: "DATABASE_UNAVAILABLE",
    });
    expect(serialized).not.toContain("password");
    expect(stub.close).toHaveBeenCalledTimes(1);
  },
);
