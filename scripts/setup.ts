import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  constants,
  copyFileSync,
  existsSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";

/** Dependency-free bootstrap: it must run before npm ci or tsx is available. */
export function runSetup(
  root: string = resolve(import.meta.dirname, ".."),
): number {
  let stage = "toolchain";
  let repair = "Use Node 26.13.0 and npm 11.20.0, then run npm run setup.";
  try {
    const npmPath = process.env.npm_execpath;
    if (process.versions.node !== "26.13.0" || !npmPath || !existsSync(npmPath))
      throw new Error("toolchain");
    const npm = npmPath;
    let env = { ...process.env };
    function command(args: string[], timeout = 180_000): string {
      const result = spawnSync(process.execPath, [npm, ...args], {
        cwd: root,
        env,
        encoding: "utf8",
        timeout,
        maxBuffer: 16 * 1024 * 1024,
      });
      if (result.error || result.status !== 0) throw new Error("command");
      return result.stdout;
    }
    if (command(["--version"]).trim() !== "11.20.0") throw new Error("npm");
    console.log("[done] Node and npm");

    stage = "dependencies";
    repair = "Run npm ci from the repository root, then retry npm run setup.";
    const manifests = [
      "package.json",
      "package-lock.json",
      ...readdirSync(resolve(root, "packages"))
        .sort()
        .map((name) => "packages/" + name + "/package.json"),
    ];
    const fingerprint = createHash("sha256");
    for (const path of manifests)
      fingerprint.update(readFileSync(resolve(root, path)));
    const expected = fingerprint.digest("hex");
    const stamp = resolve(root, "node_modules/.devmentor-setup");
    const entries = [
      "tsx/dist/cli.mjs",
      "next/dist/bin/next",
      "typescript/bin/tsc",
    ];
    let installed =
      existsSync(stamp) &&
      readFileSync(stamp, "utf8") === expected &&
      entries.every((path) => existsSync(resolve(root, "node_modules", path)));
    if (installed) {
      try {
        command(["ls", "--all", "--offline"], 120_000);
      } catch {
        installed = false;
      }
    }
    if (!installed) {
      command(["ci"], 600_000);
      command(["ls", "--all", "--offline"], 120_000);
      if (
        !entries.every((path) =>
          existsSync(resolve(root, "node_modules", path)),
        )
      )
        throw new Error("incomplete");
      writeFileSync(stamp, expected);
    }
    console.log(
      installed
        ? "[skip] Dependencies verified"
        : "[done] Dependencies installed",
    );

    stage = "configuration";
    repair =
      "Check root .env and process variables: APP_MODE=demo, loopback URLs and PostgreSQL settings. Existing values were preserved.";
    const envPath = resolve(root, ".env");
    const existing = existsSync(envPath);
    if (!existing)
      copyFileSync(
        resolve(root, ".env.example"),
        envPath,
        constants.COPYFILE_EXCL,
      );
    env = { ...parseEnv(readFileSync(envPath, "utf8")), ...process.env };
    const loopback = ["localhost", "127.0.0.1", "[::1]"];
    const app = new URL(env.APP_URL ?? "http://localhost:3000");
    if (
      env.APP_MODE !== "demo" ||
      !loopback.includes(app.hostname) ||
      !["http:", "https:"].includes(app.protocol) ||
      !env.POSTGRES_PASSWORD
    )
      throw new Error("configuration");
    for (const name of [
      "DATABASE_URL",
      "AUTH_DATABASE_URL",
      "MIGRATION_DATABASE_URL",
      "AUTH_MIGRATION_DATABASE_URL",
    ]) {
      const value = env[name];
      if (name !== "DATABASE_URL" && value === undefined) continue;
      const url = new URL(value ?? "");
      if (
        !["postgres:", "postgresql:"].includes(url.protocol) ||
        !loopback.includes(url.hostname) ||
        url.pathname.length < 2
      )
        throw new Error("database");
    }
    console.log(
      existing
        ? "[skip] Existing .env preserved"
        : "[done] Created .env from example",
    );

    for (const [name, script] of [
      ["PostgreSQL readiness", "db:up"],
      ["Database connection", "db:check"],
      ["Pending migrations", "migrate"],
      ["Demo seed", "seed:demo"],
    ] as const) {
      stage = name;
      repair =
        "Check local configuration and Docker; diagnose with npm run " +
        script +
        ", then retry npm run setup. Data and volumes are preserved.";
      console.log("[run] " + stage);
      const output = command(["run", script]);
      console.log(
        output.includes("DEMO_SEED_SKIPPED")
          ? "[skip] Demo seed already completed"
          : "[done] " + stage,
      );
    }
    console.log(
      "Setup complete. Start web: npm run dev --workspace=@devmentor/app -- --hostname 127.0.0.1",
    );
    console.log("In a second terminal at the repository root: npm run worker");
    return 0;
  } catch {
    console.error("Setup failed at " + stage + ". " + repair);
    return 1;
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  process.exitCode = runSetup();
