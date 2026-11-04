import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, expect, test, vi } from "vitest";
import { checkDependencies } from "../../scripts/check-dependencies";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true });
});
function fixture(files: Record<string, string>): string {
  const root = mkdtempSync(resolve(tmpdir(), "devmentor-architecture-"));
  roots.push(root);
  for (const name of ["app", "core", "db", "ui"]) {
    const dir = resolve(root, "packages", name, "src");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      resolve(dir, "../package.json"),
      JSON.stringify({
        exports: {
          ".": "./src/index.ts",
          "./components/*": "./src/components/*.tsx",
        },
      }),
    );
    writeFileSync(resolve(dir, "index.ts"), "export const value = 1;");
  }
  for (const [name, content] of Object.entries(files)) {
    const path = resolve(root, name);
    mkdirSync(resolve(path, ".."), { recursive: true });
    writeFileSync(path, content);
  }
  return root;
}
test("public app imports and type-only db -> core imports are allowed", () => {
  expect(
    checkDependencies(
      fixture({
        "packages/app/src/index.ts": 'import {value} from "@devmentor/core";',
        "packages/db/src/index.ts":
          'import type { value } from "@devmentor/core";',
      }),
    ),
  ).toEqual([]);
});
test.each([
  ['import {value} from "@devmentor/core";', "forbidden ui -> core"],
  [
    'export {value} from "../../core/src/index";',
    "relative import crosses package boundary",
  ],
  ['const load = () => import("@devmentor/db");', "forbidden ui -> db"],
  ['type Value = import("@devmentor/db").value;', "forbidden ui -> db"],
  ['const value = require("@devmentor/db");', "forbidden ui -> db"],
  [
    'import {value} from "@devmentor/db/src/index";',
    "non-public package import",
  ],
])("forbidden source dependency is detected: %s", (source, message) => {
  expect(
    checkDependencies(fixture({ "packages/ui/src/index.ts": source })).join(
      "\n",
    ),
  ).toContain(message);
});
test("source cycles are rejected", () => {
  const root = fixture({
    "packages/core/src/index.ts": 'export {value} from "./other";',
    "packages/core/src/other.ts": 'export {value} from "./index";',
  });
  expect(checkDependencies(root).join("\n")).toContain("dependency cycle");
});
test("forbidden declared dependencies are rejected even if unused", () => {
  const root = fixture({
    "packages/ui/package.json": '{"dependencies":{"@devmentor/core":"*"}}',
  });
  expect(checkDependencies(root).join("\n")).toContain(
    "forbidden manifest dependency",
  );
});

test("aliases cannot traverse into another package's private implementation", () => {
  expect(
    checkDependencies(
      fixture({
        "packages/app/src/index.ts": 'import {value} from "@/../db/src/index";',
      }),
    ).join("\n"),
  ).toContain("package alias traversal");
});
test("core cannot declare React infrastructure even without importing it", () => {
  expect(
    checkDependencies(
      fixture({
        "packages/core/package.json": '{"dependencies":{"react":"19.3.1"}}',
      }),
    ).join("\n"),
  ).toContain("forbidden infrastructure dependency react");
});

test.each([
  ['import "react";', "core infrastructure import"],
  ['import "@devmentor/missing";', "unknown internal package"],
  ['import "@devmentor/ui/../db";', "package alias traversal"],
  ['import "./missing";', "unresolved relative import"],
  ['import "@/missing";', "unresolved local alias"],
  [
    'const path="./other"; import(path);',
    "non-literal module import cannot be checked",
  ],
])("invalid source is diagnosed: %s", (source, message) => {
  expect(
    checkDependencies(fixture({ "packages/core/src/index.ts": source })).join(
      "\n",
    ),
  ).toContain(message);
});
test("UI rejects server infrastructure and legacy require-style imports", () => {
  expect(
    checkDependencies(
      fixture({
        "packages/ui/src/index.ts": 'import orm = require("@mikro-orm/core");',
      }),
    ).join("\n"),
  ).toContain("UI server import");
});
test("export wildcards, local aliases, JS ESM targets and ignored build output resolve", () => {
  const root = fixture({
    "packages/ui/package.json": JSON.stringify({
      exports: {
        ".": "./src/index.ts",
        "./components/*.js": "./src/components/*.tsx",
      },
    }),
    "packages/ui/src/components/button.tsx": "export const Button = 1;",
    "packages/app/src/index.ts":
      'import { Button } from "@devmentor/ui/components/button.js"; import "@/src/local"; import "./other.js"; import "./dir";',
    "packages/app/src/local.ts": "export const local = 1;",
    "packages/app/src/other.ts": "export const other = 1;",
    "packages/app/src/dir/index.tsx": "export const nested = 1;",
    "packages/app/.next/bad.ts": 'import "@devmentor/missing";',
    "packages/app/src/types.d.ts": 'import "@devmentor/missing";',
    "packages/app/src/style.css": "body {}",
  });
  expect(checkDependencies(root)).toEqual([]);
});
test("exports must point to existing public files", () => {
  expect(
    checkDependencies(
      fixture({
        "packages/ui/package.json": '{"exports":{".":"./src/absent.ts"}}',
        "packages/app/src/index.ts": 'import "@devmentor/ui";',
      }),
    ).join("\n"),
  ).toContain("unresolved package export");
});
test("manifest dev and peer declarations are checked", () => {
  expect(
    checkDependencies(
      fixture({
        "packages/core/package.json":
          '{"devDependencies":{"next":"*"},"peerDependencies":{"@devmentor/db":"*"}}',
      }),
    ).join("\n"),
  ).toContain("forbidden manifest dependency");
});
test("CLI emits success or boundary diagnostics and exit code", async () => {
  const argv = process.argv;
  const exitCode = process.exitCode;
  const cwd = vi.spyOn(process, "cwd");
  const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
  const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
  try {
    process.argv = ["node", resolve("scripts/check-dependencies.ts")];
    cwd.mockReturnValue(fixture({}));
    vi.resetModules();
    await import("../../scripts/check-dependencies");
    expect(log).toHaveBeenCalledWith(
      "Package boundaries, public exports and source cycles OK.",
    );
    cwd.mockReturnValue(
      fixture({ "packages/core/src/index.ts": 'import "react";' }),
    );
    vi.resetModules();
    await import("../../scripts/check-dependencies");
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("core infrastructure import"),
    );
    expect(process.exitCode).toBe(1);
    process.argv = ["node"];
    vi.resetModules();
    await import("../../scripts/check-dependencies");
  } finally {
    process.argv = argv;
    process.exitCode = exitCode;
    vi.restoreAllMocks();
  }
});

test("open-ended wildcard exports and non-code graph leaves resolve", () => {
  expect(
    checkDependencies(
      fixture({
        "packages/ui/package.json":
          '{"exports":{".":"./src/index.ts","./components/*":"./src/components/*.tsx"}}',
        "packages/ui/src/components/button.tsx": "export const Button=1;",
        "packages/app/src/index.ts":
          'import "@devmentor/ui/components/button"; import "./config.json";',
        "packages/app/src/config.json": "{}",
      }),
    ),
  ).toEqual([]);
});

test("missing exports do not expose package private files", () => {
  expect(
    checkDependencies(
      fixture({
        "packages/ui/package.json": "{}",
        "packages/app/src/index.ts": 'import "@devmentor/ui";',
      }),
    ).join("\n"),
  ).toContain("non-public package import");
});
