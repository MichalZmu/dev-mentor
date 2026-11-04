import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { cp, mkdtemp, readFile, rm, access } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "node:net";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { expect, test } from "vitest";
import { MikroORM } from "@mikro-orm/postgresql";
import { Migrator } from "@mikro-orm/migrations";
import { createDatabaseConfig } from "../../packages/db/src/config";
import { Migration202611030001 } from "../../packages/db/migrations/Migration202611030001";
import { Migration202611030002 } from "../../packages/db/migrations/Migration202611030002";
import { Migration202611030003 } from "../../packages/db/migrations/Migration202611030003";
import { Migration202611030004 } from "../../packages/db/migrations/Migration202611030004";

const run = promisify(execFile);

test("real fresh setup, repeat, preservation, restart, database replacement and recovery after partial failure", async () => {
  const root = process.cwd();
  const scratch = await mkdtemp(
    resolve(tmpdir(), "devmentor-setup-integration-"),
  );
  const server = createServer();
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("missing test port");
  const port = address.port;
  await new Promise<void>((done, reject) =>
    server.close((error) => (error ? reject(error) : done())),
  );
  const password = randomUUID();
  const url =
    "postgresql://setup:" + password + "@127.0.0.1:" + port + "/setup_test";
  const env = {
    ...process.env,
    APP_MODE: "demo",
    APP_URL: "http://localhost:3000",
    POSTGRES_DB: "setup_test",
    POSTGRES_USER: "setup",
    POSTGRES_PASSWORD: password,
    POSTGRES_PORT: String(port),
    DATABASE_URL: url,
    AUTH_DATABASE_URL: url,
    MIGRATION_DATABASE_URL: url,
    AUTH_MIGRATION_DATABASE_URL: url,
    COMPOSE_PROJECT_NAME: "devmentor-setup-" + randomUUID().slice(0, 8),
    COMPOSE_FILE: resolve(scratch, "compose.yaml"),
  };
  let pool = new Pool({ connectionString: url });
  let retryPool: Pool | undefined;
  async function command(args: string[], values: NodeJS.ProcessEnv = env) {
    const npm = process.env.npm_execpath;
    if (!npm) throw new Error("run integration through npm");
    try {
      return await run(process.execPath, [npm, ...args], {
        cwd: scratch,
        env: values,
        timeout: 600_000,
        maxBuffer: 16 * 1024 * 1024,
      });
    } catch {
      throw new Error("isolated setup command failed: " + args.join(" "));
    }
  }
  try {
    for (const path of [
      "package.json",
      "package-lock.json",
      ".npmrc",
      ".env.example",
      "compose.yaml",
      "tsconfig.base.json",
      "scripts",
      "packages",
    ])
      await cp(resolve(root, path), resolve(scratch, path), {
        recursive: true,
        filter: (path) => !["node_modules", ".next"].includes(basename(path)),
      });
    await expect(access(resolve(scratch, "node_modules"))).rejects.toThrow();
    const fresh = await command(["run", "setup"]);
    expect(fresh.stdout).toContain("[done] Dependencies installed");
    expect(fresh.stdout).toContain("Setup complete");
    const initialEnv = await readFile(resolve(scratch, ".env"), "utf8");
    const counts = (
      await pool.query(
        "select (select count(*) from availability_slots)::int as slots, (select count(*) from auth.account)::int as accounts",
      )
    ).rows;
    const hashes = (
      await pool.query("select id,password from auth.account order by id")
    ).rows;
    await pool.query(
      'update domain_users set goals=\'{"description":"my goal"}\',roles=\'["mentee","support"]\' where email=\'demo@example.test\'',
    );
    const before = (
      await pool.query(
        "select goals,roles from domain_users where email='demo@example.test'",
      )
    ).rows;
    const second = await command(["run", "setup"]);
    expect(second.stdout).toContain("[skip] Dependencies verified");
    expect(second.stdout).toContain("[skip] Demo seed already completed");
    expect(await readFile(resolve(scratch, ".env"), "utf8")).toBe(initialEnv);
    expect(
      (
        await pool.query(
          "select goals,roles from domain_users where email='demo@example.test'",
        )
      ).rows,
    ).toEqual(before);
    expect(
      (await pool.query("select id,password from auth.account order by id"))
        .rows,
    ).toEqual(hashes);
    expect(
      (
        await pool.query(
          "select (select count(*) from availability_slots)::int as slots, (select count(*) from auth.account)::int as accounts",
        )
      ).rows,
    ).toEqual(counts);
    await pool.end();
    await run("docker", ["compose", "stop", "postgres"], {
      cwd: scratch,
      env,
      timeout: 60_000,
    });
    expect((await command(["run", "setup"])).stdout).toContain(
      "Setup complete",
    );
    pool = new Pool({ connectionString: url });
    await pool.query("create database setup_retry");
    const retryUrl = url.replace("/setup_test", "/setup_retry");
    const retryEnv = {
      ...env,
      DATABASE_URL: retryUrl,
      AUTH_DATABASE_URL: retryUrl,
      MIGRATION_DATABASE_URL: retryUrl,
      AUTH_MIGRATION_DATABASE_URL: retryUrl,
    };
    const previous = await MikroORM.init({
      ...createDatabaseConfig(retryEnv),
      extensions: [Migrator],
      migrations: {
        snapshot: false,
        migrationsList: [
          Migration202611030001,
          Migration202611030002,
          Migration202611030003,
          Migration202611030004,
        ],
      },
    });
    try {
      await previous.migrator.up();
    } finally {
      await previous.close(true);
    }
    retryPool = new Pool({ connectionString: retryUrl });
    await retryPool.query(
      "insert into domain_users(id,name,email,goals,roles) values('legacy','Legacy','legacy@example.test','{\"description\":\"keep\"}','[\"mentee\"]')",
    );
    await retryPool.query(
      "create function fail_demo_seed() returns trigger language plpgsql as $$begin raise exception 'synthetic failure'; end;$$; create trigger fail_demo_seed before insert on mentor_profiles for each row execute function fail_demo_seed()",
    );
    await expect(command(["run", "setup"], retryEnv)).rejects.toThrow(
      "isolated setup command failed",
    );
    expect(
      (await retryPool.query("select count(*)::int as n from demo_seed_state"))
        .rows,
    ).toEqual([{ n: 0 }]);
    expect(
      (await retryPool.query("select count(*)::int as n from domain_users"))
        .rows,
    ).toEqual([{ n: 1 }]);
    const retryHashes = (
      await retryPool.query("select id,password from auth.account order by id")
    ).rows;
    expect(retryHashes).toHaveLength(3);
    await retryPool.query(
      "drop trigger fail_demo_seed on mentor_profiles; drop function fail_demo_seed()",
    );
    expect((await command(["run", "setup"], retryEnv)).stdout).toContain(
      "[done] Demo seed",
    );
    expect(
      (
        await retryPool.query(
          "select id,password from auth.account order by id",
        )
      ).rows,
    ).toEqual(retryHashes);
    expect(
      (
        await retryPool.query(
          "select goals from domain_users where id='legacy'",
        )
      ).rows,
    ).toEqual([{ goals: { description: "keep" } }]);
    expect(
      (
        await retryPool.query(
          "select completed_at is not null as done from demo_seed_state",
        )
      ).rows,
    ).toEqual([{ done: true }]);
    await retryPool.query(
      'delete from demo_seed_state; update domain_users set goals=\'{"description":"edited"}\',roles=\'["mentee","support"]\' where email=\'demo@example.test\'',
    );
    await command(["run", "setup"], retryEnv);
    expect(
      (
        await retryPool.query(
          "select goals,roles from domain_users where email='demo@example.test'",
        )
      ).rows,
    ).toEqual([
      { goals: { description: "edited" }, roles: ["mentee", "support"] },
    ]);
    for (const path of [
      "tsx/dist/cli.mjs",
      "dotenv/lib/main.js",
      "pg/lib/client.js",
    ]) {
      await rm(resolve(scratch, "node_modules", path));
      // The package graph remains valid despite the missing executable/module file.
      await command(["ls", "--all", "--offline"], retryEnv);
      const repaired = await command(["run", "setup"], retryEnv);
      expect(repaired.stdout).toContain("[done] Dependencies installed");
      expect(repaired.stdout).toContain("[skip] Demo seed already completed");
    }
    expect(
      (
        await retryPool.query(
          "select id,password from auth.account order by id",
        )
      ).rows,
    ).toEqual(retryHashes);
  } finally {
    await pool.end();
    await retryPool?.end();
    await run("docker", ["compose", "down", "--volumes", "--remove-orphans"], {
      cwd: scratch,
      env,
      timeout: 60_000,
    });
    await rm(scratch, { recursive: true, force: true });
  }
}, 600_000);
