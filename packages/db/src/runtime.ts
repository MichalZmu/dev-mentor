import {
  MikroORM,
  RequestContext,
  type EntityManager,
} from "@mikro-orm/postgresql";
import { createDatabaseConfig } from "./config";

export type Database = Awaited<ReturnType<typeof MikroORM.init>>;

export interface DatabaseProvider {
  get(): Promise<Database>;
  close(): Promise<void>;
}

/** Coalesces concurrent initialization, permits retries, and serializes shutdown. */
export function createDatabaseProvider(
  initialize: () => Promise<Database> = () =>
    MikroORM.init(createDatabaseConfig()),
): DatabaseProvider {
  let pending: Promise<Database> | undefined;
  let closing: Promise<void> | undefined;

  function get(): Promise<Database> {
    if (closing) return closing.then(get);
    if (!pending) {
      const attempt = Promise.resolve().then(initialize);
      pending = attempt;
      void attempt.catch(() => {
        pending = undefined;
      });
    }
    return pending;
  }

  function close(): Promise<void> {
    if (closing) return closing;
    if (!pending) return Promise.resolve();
    const current = pending;
    closing = current
      .then(
        (orm) => orm.close(),
        () => undefined,
      )
      .finally(() => {
        pending = undefined;
        closing = undefined;
      });
    return closing;
  }

  return { get, close };
}

/** RequestContext creates a fresh identity map while retaining the shared pool. */
export function withEntityManager<T>(
  orm: Database,
  callback: (entityManager: EntityManager) => T,
): T {
  return RequestContext.create(orm.em, () =>
    callback(orm.em.getContext() as EntityManager),
  );
}

// Keep a single provider per Node process, including Next.js development reloads.
const processState = globalThis as typeof globalThis & {
  devmentorDatabase?: DatabaseProvider;
};
export const database = (processState.devmentorDatabase ??=
  createDatabaseProvider());
