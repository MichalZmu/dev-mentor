import { EventEmitter } from "node:events";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  spawn: vi.fn(),
  execFile: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  mkdir: vi.fn(),
  logEnd: vi.fn(),
  fetch: vi.fn(),
}));
vi.mock("node:child_process", () => ({
  spawn: mocks.spawn,
  execFile: mocks.execFile,
}));
vi.mock("node:fs", () => ({
  createWriteStream: () => ({ end: mocks.logEnd }),
}));
vi.mock("node:fs/promises", () => ({ mkdir: mocks.mkdir }));
vi.mock("node:timers/promises", () => ({
  setTimeout: () => Promise.resolve(),
}));
vi.mock("@testcontainers/postgresql", () => ({
  PostgreSqlContainer: class {
    withDatabase(): this {
      return this;
    }
    start = mocks.start;
  },
}));
class Child extends EventEmitter {
  pid: number | undefined = 123;
  exitCode: number | null = null;
  signalCode: string | null = null;
  stdout = { pipe: vi.fn() };
  stderr = { pipe: vi.fn() };
  kill = vi.fn((signal: string) => {
    this.signalCode = signal;
    this.emit("exit", null, signal);
    return true;
  });
}
let child: Child;
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  child = new Child();
  mocks.spawn.mockReturnValue(child);
  mocks.mkdir.mockResolvedValue(undefined);
  mocks.start.mockResolvedValue({
    getConnectionUri: () => "postgresql://disposable-only",
    stop: mocks.stop,
  });
  mocks.stop.mockResolvedValue(undefined);
  mocks.fetch.mockResolvedValue(new Response("ok"));
  vi.stubGlobal("fetch", mocks.fetch);
  mocks.execFile.mockImplementation(
    (
      _exe: string,
      _args: string[],
      _options: unknown,
      callback: (error: Error | null, stdout: string, stderr: string) => void,
    ) => {
      callback(null, "", "");
      return new Child();
    },
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
test("owns migrated seeded server and stops it once before destroying PostgreSQL", async () => {
  const { startTestApplication } = await import("../support/application");
  const app = await startTestApplication(3201);
  expect(app.url).toBe("http://127.0.0.1:3201");
  expect(mocks.execFile).toHaveBeenCalledTimes(2);
  const options = mocks.spawn.mock.calls[0]?.[2] as {
    env: Record<string, string>;
  };
  expect(options.env.DATABASE_URL).toBe("postgresql://disposable-only");
  expect(options.env.AUTH_DATABASE_URL).toBe(options.env.DATABASE_URL);
  expect(options.env.APP_MODE).toBe("demo");
  await app.stop();
  await app.stop();
  expect(child.kill).toHaveBeenCalledWith("SIGTERM");
  expect(mocks.stop).toHaveBeenCalledOnce();
  expect(child.kill.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.stop.mock.invocationCallOrder[0] ?? 0,
  );
});
test("failed spawn has no exit event and still stops PostgreSQL promptly", async () => {
  child.pid = undefined;
  mocks.spawn.mockImplementation(() => {
    queueMicrotask(() => {
      child.exitCode = -2;
      child.emit("error", new Error("spawn ENOENT"));
    });
    return child;
  });
  mocks.fetch.mockRejectedValue(new Error("not listening"));
  const { startTestApplication } = await import("../support/application");
  await expect(startTestApplication(3201)).rejects.toThrow(
    "Disposable test application failed",
  );
  expect(child.kill).not.toHaveBeenCalled();
  expect(mocks.stop).toHaveBeenCalledOnce();
});
test("migration/seed failures stop the owned database before propagating", async () => {
  mocks.execFile.mockImplementation(
    (
      _exe: string,
      _args: string[],
      _options: unknown,
      callback: (error: Error) => void,
    ) => {
      callback(new Error("CLI failed"));
      return new Child();
    },
  );
  const { startTestApplication } = await import("../support/application");
  await expect(startTestApplication(3201)).rejects.toThrow(
    "Disposable test application failed",
  );
  expect(mocks.spawn).not.toHaveBeenCalled();
  expect(mocks.stop).toHaveBeenCalledOnce();
});
test("readiness retries non-OK HTTP and TCP failures", async () => {
  mocks.fetch
    .mockRejectedValueOnce(new Error("TCP"))
    .mockResolvedValueOnce(new Response("starting", { status: 503 }));
  const { startTestApplication } = await import("../support/application");
  const app = await startTestApplication(3201);
  expect(mocks.fetch).toHaveBeenCalledTimes(3);
  await app.stop();
});
test("an exited server or elapsed readiness deadline cleans up", async () => {
  child.exitCode = 1;
  const { startTestApplication } = await import("../support/application");
  await expect(startTestApplication(3201)).rejects.toThrow(
    "Disposable test application failed",
  );
  expect(mocks.stop).toHaveBeenCalledOnce();
  expect(child.kill).not.toHaveBeenCalled();
  child.exitCode = null;
  vi.spyOn(Date, "now").mockReturnValueOnce(0).mockReturnValue(60_001);
  await expect(startTestApplication(3201)).rejects.toThrow(
    "Disposable test application failed",
  );
  expect(mocks.stop).toHaveBeenCalledTimes(2);
});
test("unresponsive server is force-stopped after its grace period", async () => {
  vi.useFakeTimers();
  child.kill.mockImplementation((signal: string) => {
    if (signal === "SIGKILL") child.emit("exit", null, signal);
    return true;
  });
  const { startTestApplication } = await import("../support/application");
  const app = await startTestApplication(3201);
  const stopping = app.stop();
  await vi.advanceTimersByTimeAsync(5000);
  await stopping;
  expect(child.kill.mock.calls.map((call) => call[0])).toEqual([
    "SIGTERM",
    "SIGKILL",
  ]);
  expect(mocks.stop).toHaveBeenCalledOnce();
});
