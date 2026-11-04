import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { resolve } from "node:path";
const mocks = vi.hoisted(() => ({ spawnSync: vi.fn(), readFileSync: vi.fn() }));
vi.mock("node:child_process", () => ({ spawnSync: mocks.spawnSync }));
vi.mock("node:fs", () => ({ readFileSync: mocks.readFileSync }));
const clean = {
  vulnerabilities: {},
  metadata: { vulnerabilities: { total: 0 } },
};
const argv = process.argv;
const exitCode = process.exitCode;
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.readFileSync.mockImplementation((path: string) =>
    path === "package-lock.json" ? '{"packages":{}}' : "[]",
  );
  mocks.spawnSync.mockReturnValue({ status: 0, stdout: JSON.stringify(clean) });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  process.exitCode = 0;
});
afterEach(() => {
  process.argv = argv;
  process.exitCode = exitCode;
  vi.restoreAllMocks();
});
test("CLI audits both runtime and development dependencies", async () => {
  process.argv = ["node", resolve("scripts/check-audit.ts")];
  await import("../../scripts/check-audit");
  expect(mocks.spawnSync.mock.calls.map((call: unknown[]) => call[1])).toEqual([
    ["audit", "--json", "--omit=dev"],
    ["audit", "--json"],
  ]);
  expect(console.log).toHaveBeenCalledWith(
    expect.stringContaining("Audit passed"),
  );
  expect(process.exitCode).toBe(0);
});
test.each([
  { error: new Error("network"), status: null, stdout: "" },
  { status: 2, stdout: "{}" },
  { status: 0, stdout: "invalid-json" },
])(
  "CLI fails closed when audit cannot produce valid JSON: %o",
  async (result) => {
    mocks.spawnSync.mockReturnValue(result);
    process.argv = ["node", resolve("scripts/check-audit.ts")];
    await import("../../scripts/check-audit");
    expect(process.exitCode).toBe(1);
    expect(console.error).toHaveBeenCalledWith(
      "Security check failed: audit or metadata unavailable.",
    );
  },
);
test("CLI reports invalid metadata even when npm audit exits with advisory status", async () => {
  mocks.spawnSync.mockReturnValue({ status: 1, stdout: "{}" });
  process.argv = ["node", resolve("scripts/check-audit.ts")];
  await import("../../scripts/check-audit");
  expect(process.exitCode).toBe(1);
  expect(console.error).toHaveBeenCalledWith(
    "Invalid or unavailable npm audit report",
  );
});
test("import without a CLI entry has no audit side effect", async () => {
  process.argv = ["node"];
  await import("../../scripts/check-audit");
  expect(mocks.spawnSync).not.toHaveBeenCalled();
});
