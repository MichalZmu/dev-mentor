import { spawn, execFile, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";
import { PostgreSqlContainer } from "@testcontainers/postgresql";

const run = promisify(execFile);
export interface TestApplication {
  url: string;
  stop(): Promise<void>;
}

async function unusedPort(): Promise<number> {
  const listener = createServer();
  listener.listen(0, "127.0.0.1");
  await once(listener, "listening");
  const address = listener.address();
  if (!address || typeof address === "string")
    throw new Error("No TCP test port");
  await new Promise<void>((resolve, reject) =>
    listener.close((error) => (error ? reject(error) : resolve())),
  );
  return address.port;
}
async function stopServer(server: ChildProcess): Promise<void> {
  if (server.exitCode !== null || server.signalCode !== null) return;
  const exited = once(server, "exit");
  server.kill("SIGTERM");
  const timer = setTimeout(() => server.kill("SIGKILL"), 5000);
  timer.unref();
  try {
    await exited;
  } finally {
    clearTimeout(timer);
  }
}

/** Only owns disposable Testcontainers resources; never uses the developer database. */
export async function startTestApplication(
  port?: number,
): Promise<TestApplication> {
  const chosenPort = port ?? (await unusedPort());
  const url = `http://127.0.0.1:${chosenPort}`;
  await mkdir("test-results", { recursive: true });
  const postgres = await new PostgreSqlContainer("postgres:18.6")
    .withDatabase("devmentor_browser_test")
    .start();
  let server: ChildProcess | undefined;
  let stopped = false;
  const log = createWriteStream(`test-results/test-app-${chosenPort}.log`);
  const stop = async (): Promise<void> => {
    if (stopped) return;
    stopped = true;
    try {
      if (server) await stopServer(server);
    } finally {
      log.end();
      await postgres.stop();
    }
  };
  try {
    const databaseUrl = postgres.getConnectionUri();
    const env = {
      ...process.env,
      NODE_ENV: "production",
      APP_MODE: "demo",
      APP_URL: url,
      DATABASE_URL: databaseUrl,
      AUTH_DATABASE_URL: databaseUrl,
      MIGRATION_DATABASE_URL: databaseUrl,
      AUTH_MIGRATION_DATABASE_URL: databaseUrl,
      AUTH_SECRET: "disposable-test-app-secret-never-used-outside-tests",
    };
    const nodeArgs = ["--conditions=react-server", "--import", "tsx"];
    await run(
      process.execPath,
      [...nodeArgs, "packages/app/scripts/migrate.ts"],
      { env, timeout: 120_000 },
    );
    await run(process.execPath, [...nodeArgs, "tests/support/seed-app.ts"], {
      env,
      timeout: 60_000,
    });
    server = spawn(
      process.execPath,
      [
        resolve("node_modules/next/dist/bin/next"),
        "start",
        "packages/app",
        "--hostname",
        "127.0.0.1",
        "--port",
        String(chosenPort),
      ],
      { env, stdio: ["ignore", "pipe", "pipe"] },
    );
    server.stdout?.pipe(log);
    server.stderr?.pipe(log);
    // Handle spawn errors through the readiness loop, without unhandled events.
    let spawnError: Error | undefined;
    server.on("error", (error) => {
      spawnError = error;
    });
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      if (spawnError || server.exitCode !== null)
        throw new Error(
          "Test application exited before readiness; see test-results log.",
        );
      try {
        const result = await fetch(url + "/api/v1/mentors", {
          signal: AbortSignal.timeout(1000),
        });
        if (result.ok) return { url, stop };
      } catch {
        /* TCP readiness can precede Next.js and database readiness. */
      }
      await delay(250);
    }
    throw new Error(
      "Test application readiness timed out; see test-results log.",
    );
  } catch (error) {
    await stop();
    // Child-process errors can contain environment-dependent output. Keep it local.
    throw new Error(
      "Disposable test application failed to start. Check migrations, production build and test-results logs.",
      { cause: error },
    );
  }
}
