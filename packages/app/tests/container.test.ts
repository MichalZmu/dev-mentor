import assert from "node:assert/strict";
import { setTimeout } from "node:timers/promises";
import test from "node:test";
import { asFunction } from "awilix";
import type { DatabaseProvider } from "@devmentor/db";
import { RequestContext } from "@mikro-orm/postgresql";
import { database } from "@devmentor/db";
import { withDatabaseServices } from "../server/services";
import { createAppContainer, runInRequestScope } from "../server/container";

function noDatabase(): DatabaseProvider {
  return {
    get: async () => { throw new Error("database should stay lazy"); },
    close: async () => {},
  };
}

test("application scopes stay independent without opening a database connection", async () => {
  const database = noDatabase();
  const root = createAppContainer(database);
  try {
    const results = await Promise.all(["first", "second"].map((id) =>
      runInRequestScope(root, async (services) => {
        assert.equal(services.database, database);
        assert.equal(services.applicationInfo.name, "DevMentor");
        const request = services.request;
        await setTimeout(2);
        assert.equal(services.request, request);
        return services.request.id;
      }, { id }),
    ));
    assert.deepEqual(results, ["first", "second"]);
    assert.throws(() => root.resolve("request"), /Could not resolve/);
  } finally {
    await root.dispose();
  }
});

test("request-scoped resources are disposed when a callback fails", async () => {
  let disposals = 0;
  const root = createAppContainer(noDatabase());
  root.register({
    applicationInfo: asFunction(() => ({ name: "DevMentor", description: "test" }))
      .scoped()
      .disposer(() => { disposals++; }),
  });
  try {
    await assert.rejects(runInRequestScope(root, async ({ applicationInfo }) => {
      assert.equal(applicationInfo.name, "DevMentor");
      throw new Error("callback failed");
    }), /callback failed/);
    assert.equal(disposals, 1);
    await runInRequestScope(root, ({ applicationInfo }) => assert.equal(applicationInfo.name, "DevMentor"));
    assert.equal(disposals, 2);
  } finally {
    await root.dispose();
  }
});

test("composed database services isolate both DI request state and EntityManager", async () => {
  const previousUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = "postgresql://devmentor@127.0.0.1:1/unused";
  const requests = new Set<string>();
  const managers = new Set();
  try {
    await Promise.all([1, 2].map((delay) => withDatabaseServices(async (services) => {
      const requestId = services.request.id;
      requests.add(requestId);
      managers.add(services.entityManager);
      assert.equal(RequestContext.getEntityManager(), services.entityManager);
      await setTimeout(delay);
      assert.equal(services.request.id, requestId);
      assert.equal(RequestContext.getEntityManager(), services.entityManager);
    })));
    assert.equal(requests.size, 2);
    assert.equal(managers.size, 2);
    assert.equal(RequestContext.getEntityManager(), undefined);
    await assert.rejects(withDatabaseServices(async () => { throw new Error("database callback failed"); }), /database callback failed/);
    assert.equal(RequestContext.getEntityManager(), undefined);
    await withDatabaseServices(({ entityManager }) => assert.equal(RequestContext.getEntityManager(), entityManager));
  } finally {
    await database.close();
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
  }
});
