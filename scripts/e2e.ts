import { spawn, type ChildProcess } from "node:child_process";
import { dirname, resolve } from "node:path";
import { setTimeout } from "node:timers/promises";
import { PostgreSqlContainer } from "@testcontainers/postgresql";

const root = process.cwd();
const port = 3100;
const baseURL = `http://localhost:${port}`;
const children: ChildProcess[] = [];
function run(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd: root, env, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0
        ? resolvePromise()
        : reject(new Error("Verification command failed")),
    );
  });
}
async function stop(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise<void>((resolvePromise) =>
      child.once("exit", () => resolvePromise()),
    ),
    setTimeout(3000),
  ]);
  if (child.exitCode === null) child.kill("SIGKILL");
}
const container = await new PostgreSqlContainer("postgres:18.6")
  .withDatabase("devmentor_e2e")
  .start();
const env = {
  ...process.env,
  APP_MODE: "demo",
  APP_URL: baseURL,
  DATABASE_URL: container.getConnectionUri(),
  AUTH_DATABASE_URL: container.getConnectionUri(),
  MIGRATION_DATABASE_URL: container.getConnectionUri(),
  AUTH_MIGRATION_DATABASE_URL: container.getConnectionUri(),
  AUTH_SECRET: "e2e-only-not-a-production-secret-2026",
  PLAYWRIGHT_BASE_URL: baseURL,
  PLAYWRIGHT_EXTERNAL_SERVER: "1",
};
try {
  await run("npm", ["run", "migrate"], env);
  await run("npm", ["run", "seed:demo"], env);
  const worker = spawn(
    process.execPath,
    [
      resolve("node_modules/tsx/dist/cli.mjs"),
      "--conditions=react-server",
      "packages/app/scripts/worker.ts",
    ],
    { cwd: root, env, stdio: ["ignore", "ignore", "pipe"] },
  );
  children.push(worker);
  worker.stderr?.on("data", () => {
    /* Worker logs are safe, but avoid flooding the E2E output. */
  });
  const server = spawn(
    process.execPath,
    [
      resolve("node_modules/next/dist/bin/next"),
      "start",
      "packages/app",
      "--hostname",
      "0.0.0.0",
      "--port",
      String(port),
    ],
    { cwd: root, env, stdio: ["ignore", "inherit", "inherit"] },
  );
  children.push(server);
  const deadline = Date.now() + 60_000;
  let ready = false;
  while (Date.now() < deadline) {
    if (server.exitCode !== null || worker.exitCode !== null)
      throw new Error("E2E service terminated before readiness");
    try {
      const result = await fetch(baseURL + "/api/v1/health");
      if (result.ok) {
        ready = true;
        break;
      }
    } catch {
      /* Readiness probe retries until the bounded deadline. */
    }
    await setTimeout(100);
  }
  if (!ready) throw new Error("E2E web server did not become ready");
  if (process.argv.includes("--docker")) {
    const nodeRoot = dirname(dirname(process.execPath));
    await run(
      "docker",
      [
        "run",
        "--rm",
        "--user",
        `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`,
        "--network",
        "host",
        "--ipc",
        "host",
        "-v",
        `${root}:/workspace`,
        "-v",
        `${nodeRoot}:/opt/node:ro`,
        "-e",
        "PATH=/opt/node/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
        "-e",
        "PLAYWRIGHT_EXTERNAL_SERVER=1",
        "-e",
        `PLAYWRIGHT_BASE_URL=${baseURL}`,
        "-w",
        "/workspace",
        "mcr.microsoft.com/playwright:v1.64.1-noble",
        "node",
        "node_modules/@playwright/test/cli.js",
        "test",
      ],
      env,
    );
  } else
    await run(
      process.execPath,
      [resolve("node_modules/@playwright/test/cli.js"), "test"],
      env,
    );
} catch {
  console.error(
    "Product E2E failed; inspect the test reports and service error codes.",
  );
  process.exitCode = 1;
} finally {
  await Promise.all(children.map(stop));
  await container.stop();
}
