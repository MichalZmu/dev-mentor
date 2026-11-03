import assert from "node:assert/strict";
import { setTimeout } from "node:timers/promises";
import test from "node:test";
import { MikroORM, RequestContext } from "@mikro-orm/postgresql";
import { createDatabaseConfig } from "../src/config";
import { createDatabaseProvider, withEntityManager } from "../src/runtime";

const env = { DATABASE_URL: "postgresql://devmentor@127.0.0.1:1/unused" };

test("invalid database and pool settings fail before any database connection", () => {
  assert.throws(() => createDatabaseConfig({}), /DATABASE_URL is required/);
  assert.throws(() => createDatabaseConfig({ DATABASE_URL: "not-a-url" }), /valid PostgreSQL URL/);
  assert.throws(() => createDatabaseConfig({ DATABASE_URL: "https://example.com/db" }), /must specify PostgreSQL/);
  assert.throws(() => createDatabaseConfig({ ...env, DB_POOL_MAX: "0" }), /Pool configuration/);
  assert.throws(() => createDatabaseConfig({ ...env, DB_POOL_MIN: "5", DB_POOL_MAX: "2" }), /Pool configuration/);
  assert.throws(() => createDatabaseConfig({ ...env, DB_POOL_MAX: "2.5" }), /non-negative integer/);
});

test("concurrent calls initialize one ORM; shutdown permits a fresh instance", async () => {
  let initializations = 0;
  const provider = createDatabaseProvider(async () => {
    initializations++;
    await setTimeout(5);
    return new MikroORM(createDatabaseConfig(env));
  });
  try {
    const [first, second] = await Promise.all([provider.get(), provider.get()]);
    assert.equal(first, second);
    assert.equal(initializations, 1);
    await provider.close();
    const next = await provider.get();
    assert.notEqual(next, first);
    assert.equal(initializations, 2);
  } finally {
    await provider.close();
  }
});

test("a rejected initialization can be retried", async () => {
  let attempts = 0;
  const provider = createDatabaseProvider(async () => {
    if (++attempts === 1) throw new Error("temporary failure");
    return new MikroORM(createDatabaseConfig(env));
  });
  try {
    await assert.rejects(provider.get(), /temporary failure/);
    assert.ok(await provider.get());
    assert.equal(attempts, 2);
  } finally {
    await provider.close();
  }
});

test("parallel request contexts use separate EntityManagers and survive an async boundary", async () => {
  const orm = new MikroORM(createDatabaseConfig(env));
  const managers = new Set();
  try {
    await Promise.all([1, 2].map((delay) =>
      withEntityManager(orm, async (em) => {
        managers.add(em);
        assert.notEqual(em, orm.em);
        await setTimeout(delay);
        assert.equal(RequestContext.getEntityManager(), em);
        assert.equal(orm.em.getContext(), em);
      }),
    ));
    assert.equal(managers.size, 2);
    assert.equal(RequestContext.getEntityManager(), undefined);
    await assert.rejects(withEntityManager(orm, async () => {
      throw new Error("request failed");
    }), /request failed/);
    assert.equal(RequestContext.getEntityManager(), undefined);
  } finally {
    await orm.close();
  }
});

test("get waits for an ongoing close and initializes exactly one replacement ORM", async () => {
  let releaseClose!: () => void;
  const closeGate = new Promise<void>((resolve) => { releaseClose = resolve; });
  let notifyCloseStarted!: () => void;
  const closeStarted = new Promise<void>((resolve) => { notifyCloseStarted = resolve; });
  let calls = 0;
  let closeCalls = 0;
  const first = new MikroORM(createDatabaseConfig(env));
  const originalClose = first.close.bind(first);
  first.close = async () => {
    closeCalls++;
    notifyCloseStarted();
    await closeGate;
    await originalClose();
  };
  const provider = createDatabaseProvider(async () => {
    calls++;
    return calls === 1 ? first : new MikroORM(createDatabaseConfig(env));
  });
  try {
    assert.equal(await provider.get(), first);
    const closing = provider.close();
    assert.equal(provider.close(), closing);
    await closeStarted;
    let resolved = false;
    const replacement = provider.get().then((orm) => { resolved = true; return orm; });
    await setTimeout(1);
    assert.equal(resolved, false);
    assert.equal(calls, 1);
    releaseClose();
    await closing;
    const next = await replacement;
    assert.notEqual(next, first);
    assert.equal(await provider.get(), next);
    assert.equal(calls, 2);
    assert.equal(closeCalls, 1);
  } finally {
    releaseClose();
    await provider.close();
  }
});
