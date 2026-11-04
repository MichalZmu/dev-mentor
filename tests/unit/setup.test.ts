import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  unlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve, dirname } from "node:path";
import { runSetup } from "../../scripts/setup";
const mocks = vi.hoisted(() => ({ spawn: vi.fn() }));
vi.mock("node:child_process", () => ({ spawnSync: mocks.spawn }));
let root: string;
const configuration =
  "APP_MODE=demo\nAPP_URL=http://localhost:3000\nPOSTGRES_PASSWORD=local\nDATABASE_URL=postgresql://demo:local@127.0.0.1/demo\n";
const entries = [
  "tsx/dist/cli.mjs",
  "next/dist/bin/next",
  "typescript/bin/tsc",
];
function put(path: string, content = ""): void {
  const target = resolve(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
}
function commands(): string[] {
  return mocks.spawn.mock.calls.map((call: unknown[]) =>
    (call[1] as string[]).slice(1).join(" "),
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  root = mkdtempSync(resolve(tmpdir(), "devmentor-setup-unit-"));
  put("package.json", "{}");
  put("package-lock.json", "{}");
  put("packages/app/package.json", "{}");
  put(".env.example", configuration);
  vi.stubEnv("npm_execpath", resolve(root, "npm.cjs"));
  put("npm.cjs");
  for (const key of [
    "APP_MODE",
    "APP_URL",
    "POSTGRES_PASSWORD",
    "DATABASE_URL",
    "AUTH_DATABASE_URL",
    "MIGRATION_DATABASE_URL",
    "AUTH_MIGRATION_DATABASE_URL",
  ])
    vi.stubEnv(key, undefined);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.spawn.mockImplementation((_node: string, args: string[]) => {
    if (args.includes("ci"))
      for (const path of entries) put("node_modules/" + path);
    return { status: 0, stdout: args.includes("--version") ? "11.20.0\n" : "" };
  });
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
test("fresh setup installs, copies configuration, runs all stages and prints web/worker commands", () => {
  expect(runSetup(root)).toBe(0);
  expect(commands()).toEqual([
    "--version",
    "ci",
    "ls --all --offline",
    "run db:up",
    "run db:check",
    "run migrate",
    "run seed:demo",
  ]);
  expect(readFileSync(resolve(root, ".env"), "utf8")).toBe(configuration);
  expect(console.log).toHaveBeenCalledWith(
    expect.stringContaining("npm run worker"),
  );
  expect(mocks.spawn).toHaveBeenCalledWith(
    process.execPath,
    [process.env.npm_execpath, "run", "db:up"],
    expect.objectContaining({
      timeout: 180000,
      env: expect.objectContaining({ APP_MODE: "demo" }),
    }),
  );
});
test("repeat verifies dependencies, preserves env, checks migrations and skips completed seed", () => {
  expect(runSetup(root)).toBe(0);
  const original = readFileSync(resolve(root, ".env"), "utf8");
  mocks.spawn.mockClear();
  mocks.spawn.mockImplementation((_node: string, args: string[]) => ({
    status: 0,
    stdout: args.includes("--version") ? "11.20.0" : "DEMO_SEED_SKIPPED",
  }));
  vi.stubEnv("DATABASE_URL", "postgresql://override@localhost/process");
  expect(runSetup(root)).toBe(0);
  expect(commands()).not.toContain("ci");
  expect(commands()).toContain("run migrate");
  expect(readFileSync(resolve(root, ".env"), "utf8")).toBe(original);
  expect(mocks.spawn).toHaveBeenLastCalledWith(
    process.execPath,
    expect.any(Array),
    expect.objectContaining({
      env: expect.objectContaining({
        DATABASE_URL: "postgresql://override@localhost/process",
      }),
    }),
  );
  expect(console.log).toHaveBeenCalledWith(
    "[skip] Demo seed already completed",
  );
});
test.each(["lock", "workspace", "binary", "graph"])(
  "stale/incomplete %s dependencies are installed again",
  (kind) => {
    expect(runSetup(root)).toBe(0);
    mocks.spawn.mockClear();
    if (kind === "lock") put("package-lock.json", '{"new":true}');
    if (kind === "workspace") put("packages/app/package.json", '{"new":true}');
    if (kind === "binary")
      unlinkSync(resolve(root, "node_modules/tsx/dist/cli.mjs"));
    if (kind === "graph")
      mocks.spawn
        .mockReturnValueOnce({ status: 0, stdout: "11.20.0" })
        .mockReturnValueOnce({ status: 1, stdout: "private" });
    expect(runSetup(root)).toBe(0);
    expect(commands()).toContain("ci");
  },
);
test.each([
  ["APP_MODE", "production"],
  ["APP_URL", "https://public.example"],
  ["APP_URL", "ftp://localhost"],
  ["POSTGRES_PASSWORD", ""],
  ["DATABASE_URL", ""],
  ["DATABASE_URL", "https://localhost/db"],
  ["DATABASE_URL", "postgresql://public.example/db"],
  ["DATABASE_URL", "postgresql://localhost/"],
  ["AUTH_DATABASE_URL", "broken"],
  ["MIGRATION_DATABASE_URL", "https://localhost/db"],
  ["AUTH_MIGRATION_DATABASE_URL", "postgresql://public.example/db"],
])(
  "rejects invalid %s without printing its value or starting postgres",
  (key, value) => {
    vi.stubEnv(key, value);
    expect(runSetup(root)).toBe(1);
    expect(commands()).not.toContain("run db:up");
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("failed at configuration"),
    );
  },
);
test("missing DATABASE_URL also fails safely; optional URLs may use loopback IPv6", () => {
  put(".env.example", "APP_MODE=demo\nPOSTGRES_PASSWORD=local\n");
  expect(runSetup(root)).toBe(1);
  put(".env", configuration + "AUTH_DATABASE_URL=postgresql://[::1]/auth\n");
  expect(runSetup(root)).toBe(0);
});
test.each(["ci", "db:up", "db:check", "migrate", "seed:demo"])(
  "a failed %s stops dependent work and retries successfully",
  (script) => {
    const implementation = mocks.spawn.getMockImplementation();
    mocks.spawn.mockImplementation((node: string, args: string[]) =>
      args.includes(script)
        ? { status: 1, stderr: "private-secret" }
        : implementation?.(node, args),
    );
    expect(runSetup(root)).toBe(1);
    expect(commands().at(-1)).toBe(script === "ci" ? "ci" : "run " + script);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
      "private-secret",
    );
    mocks.spawn.mockImplementation(implementation as typeof mocks.spawn);
    expect(runSetup(root)).toBe(0);
  },
);
test("spawn error, failed graph after ci and missing installed entry points all fail closed", () => {
  mocks.spawn.mockReturnValueOnce({
    error: new Error("private"),
    status: null,
  });
  expect(runSetup(root)).toBe(1);
  mocks.spawn
    .mockReturnValueOnce({ status: 0, stdout: "11.20.0" })
    .mockReturnValueOnce({ status: 0, stdout: "" })
    .mockReturnValueOnce({ status: 1 });
  expect(runSetup(root)).toBe(1);
  mocks.spawn.mockReturnValue({ status: 0, stdout: "11.20.0" });
  expect(runSetup(root)).toBe(1);
});
test("wrong npm, absent npm and wrong Node stop before installation", () => {
  mocks.spawn.mockReturnValueOnce({ status: 0, stdout: "10.0.0" });
  expect(runSetup(root)).toBe(1);
  vi.stubEnv("npm_execpath", undefined);
  expect(runSetup(root)).toBe(1);
  vi.stubEnv("npm_execpath", "/nonexistent/npm.cjs");
  expect(runSetup(root)).toBe(1);
  vi.spyOn(process.versions, "node", "get").mockReturnValue("0");
  expect(runSetup(root)).toBe(1);
});
test("missing manifests or unwriteable configuration yield safe remediation", () => {
  unlinkSync(resolve(root, "package-lock.json"));
  expect(runSetup(root)).toBe(1);
  put("package-lock.json", "{}");
  unlinkSync(resolve(root, ".env.example"));
  expect(runSetup(root)).toBe(1);
});
test("CLI guard supports absent argv and exits nonzero with no npm invocation", async () => {
  const argv = process.argv;
  const exitCode = process.exitCode;
  vi.stubEnv("npm_execpath", undefined);
  try {
    vi.resetModules();
    process.argv = ["node"];
    await import("../../scripts/setup");
    expect(mocks.spawn).not.toHaveBeenCalled();
    vi.resetModules();
    process.argv = ["node", resolve("scripts/setup.ts")];
    await import("../../scripts/setup");
    expect(process.exitCode).toBe(1);
  } finally {
    process.argv = argv;
    process.exitCode = exitCode;
  }
});
