import { EventEmitter } from "node:events";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  spawn: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  delay: vi.fn(),
}));
vi.mock("node:child_process", () => ({ spawn: mocks.spawn }));
vi.mock("node:timers/promises", () => ({ setTimeout: mocks.delay }));
vi.mock("@testcontainers/postgresql", () => ({
  PostgreSqlContainer: class {
    withDatabase(): this {
      return this;
    }
    start = mocks.start;
  },
}));
const argv = process.argv;
const originalExitCode = process.exitCode;
class Child extends EventEmitter {
  exitCode: number | null = null;
  stderr = new EventEmitter();
  kill = vi.fn((signal: string) => {
    if (signal === "SIGTERM" && this === services[0] && ignoreTermination)
      return true;
    this.exitCode = 0;
    this.emit("exit", 0);
    return true;
  });
}
let services: Child[];
let ignoreTermination: boolean;
let mode = "success";
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  services = [];
  ignoreTermination = false;
  mode = "success";
  process.argv = ["node", "scripts/e2e.ts"];
  process.exitCode = 0;
  mocks.delay.mockResolvedValue(undefined);
  mocks.stop.mockResolvedValue(undefined);
  mocks.start.mockResolvedValue({
    getConnectionUri: () => "postgresql://disposable",
    stop: mocks.stop,
  });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("ok")));
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  mocks.spawn.mockImplementation((_command: string, args: string[]) => {
    const child = new Child();
    if (
      args.includes("packages/app/scripts/worker.ts") ||
      args.includes("start")
    ) {
      services.push(child);
      if (mode === "service-exit") child.exitCode = 1;
      if (mode === "stopped-worker" && services.length === 1)
        child.exitCode = 0;
      queueMicrotask(() => child.stderr.emit("data", "safe code"));
    } else
      queueMicrotask(() => {
        if (mode === "spawn-error")
          child.emit("error", new Error("cannot spawn"));
        else child.emit("exit", mode === "command-error" ? 1 : 0);
      });
    return child;
  });
});
afterEach(() => {
  process.argv = argv;
  process.exitCode = originalExitCode;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
test("runner migrates/seeds, runs Playwright and stops owned services", async () => {
  await import("../../scripts/e2e");
  expect(process.exitCode).toBe(0);
  expect(
    mocks.spawn.mock.calls.map((call: unknown[]) => call[1]),
  ).toContainEqual(["run", "migrate"]);
  expect(
    mocks.spawn.mock.calls.map((call: unknown[]) => call[1]),
  ).toContainEqual(["run", "seed:demo"]);
  expect(services).toHaveLength(2);
  expect(
    services.every((child) => child.kill.mock.calls[0]?.[0] === "SIGTERM"),
  ).toBe(true);
  expect(mocks.stop).toHaveBeenCalledOnce();
});
test("docker browser uses host network and unprivileged workspace owner", async () => {
  process.argv.push("--docker");
  await import("../../scripts/e2e");
  expect(mocks.spawn).toHaveBeenCalledWith(
    "docker",
    expect.arrayContaining([
      "--network",
      "host",
      "--user",
      `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`,
    ]),
    expect.any(Object),
  );
  expect(mocks.stop).toHaveBeenCalledOnce();
});
test("docker runner has a platform fallback for uid/gid", async () => {
  process.argv.push("--docker");
  const uid = Object.getOwnPropertyDescriptor(process, "getuid");
  const gid = Object.getOwnPropertyDescriptor(process, "getgid");
  Object.defineProperty(process, "getuid", {
    value: undefined,
    configurable: true,
  });
  Object.defineProperty(process, "getgid", {
    value: undefined,
    configurable: true,
  });
  try {
    await import("../../scripts/e2e");
    expect(mocks.spawn).toHaveBeenCalledWith(
      "docker",
      expect.arrayContaining(["1000:1000"]),
      expect.any(Object),
    );
  } finally {
    if (uid) Object.defineProperty(process, "getuid", uid);
    if (gid) Object.defineProperty(process, "getgid", gid);
  }
});
test.each(["command-error", "spawn-error", "service-exit"])(
  "failed %s still cleans up PostgreSQL",
  async (value) => {
    mode = value;
    await import("../../scripts/e2e");
    expect(process.exitCode).toBe(1);
    expect(mocks.stop).toHaveBeenCalledOnce();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("Product E2E failed"),
    );
  },
);
test("already stopped worker is not signalled again", async () => {
  mode = "stopped-worker";
  await import("../../scripts/e2e");
  expect(services[0]?.kill).not.toHaveBeenCalled();
});
test("readiness retries network failures and non-OK responses", async () => {
  vi.mocked(fetch)
    .mockRejectedValueOnce(new Error("TCP"))
    .mockResolvedValueOnce(new Response("waiting", { status: 503 }));
  await import("../../scripts/e2e");
  expect(fetch).toHaveBeenCalledTimes(3);
  expect(process.exitCode).toBe(0);
});
test("readiness is bounded and forces termination of a hung worker", async () => {
  ignoreTermination = true;
  vi.spyOn(Date, "now").mockReturnValueOnce(0).mockReturnValue(60_001);
  await import("../../scripts/e2e");
  expect(process.exitCode).toBe(1);
  expect(services[0]?.kill.mock.calls.map((call) => call[0])).toEqual([
    "SIGTERM",
    "SIGKILL",
  ]);
  expect(mocks.stop).toHaveBeenCalledOnce();
});
