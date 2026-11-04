import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { afterAll, beforeAll, expect, test } from "vitest";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { MikroORM, RequestContext } from "@mikro-orm/postgresql";
import { createDatabaseConfig } from "../../packages/db/src/config";
import { withEntityManager } from "../../packages/db/src/runtime";

const run = promisify(execFile);
let container: StartedPostgreSqlContainer | undefined;
let orm: MikroORM | undefined;
beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:18.6")
    .withDatabase("devmentor_integration")
    .start();
  orm = new MikroORM(
    createDatabaseConfig({ DATABASE_URL: container.getConnectionUri() }),
  );
});
afterAll(async () => {
  try {
    await orm?.close(true);
  } finally {
    await container?.stop();
  }
});

test("CLI migrates an empty database and is safe to rerun", async () => {
  if (!container || !orm) throw new Error("PostgreSQL setup did not complete");
  const env = { ...process.env, DATABASE_URL: container.getConnectionUri() };
  await run("npm", ["run", "db:migrate"], { env, timeout: 60_000 });
  await run("npm", ["run", "db:migrate"], { env, timeout: 60_000 });
  const rows = await orm.em
    .getConnection()
    .execute<{ name: string }[]>(
      "select tablename as name from pg_tables where schemaname = 'public'",
    );
  expect(rows.some((row) => row.name === "mikro_orm_migrations")).toBe(true);
});
test("real queries retain isolated request contexts and share the process ORM", async () => {
  if (!orm) throw new Error("PostgreSQL setup did not complete");
  const database = orm;
  const managers = new Set();
  await Promise.all(
    [1, 2].map(() =>
      withEntityManager(database, async (em) => {
        managers.add(em);
        const rows = await em
          .getConnection()
          .execute<{ value: number }[]>("select 1 as value");
        expect(rows).toEqual([{ value: 1 }]);
        expect(RequestContext.getEntityManager()).toBe(em);
        expect(database.em.getContext()).toBe(em);
      }),
    ),
  );
  expect(managers.size).toBe(2);
  expect(RequestContext.getEntityManager()).toBeUndefined();
});
test("failed transactions roll back SQL writes", async () => {
  if (!orm) throw new Error("PostgreSQL setup did not complete");
  const connection = orm.em.getConnection();
  await connection.execute(
    "create table integration_probe (id integer primary key)",
  );
  try {
    await expect(
      orm.em.fork().transactional(async (em) => {
        await em
          .getConnection()
          .execute(
            "insert into integration_probe values (1)",
            [],
            "run",
            em.getTransactionContext(),
          );
        throw new Error("rollback probe");
      }),
    ).rejects.toThrow("rollback probe");
    expect(await connection.execute("select * from integration_probe")).toEqual(
      [],
    );
  } finally {
    await connection.execute("drop table integration_probe");
  }
});
