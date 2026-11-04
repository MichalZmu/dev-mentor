import "server-only";

import { asValue } from "awilix";
import { database, withEntityManager } from "@devmentor/db";
import {
  createAppContainer,
  runInRequestScope,
  type AppServices,
  type DatabaseServices,
} from "./container";

const container = createAppContainer(database);

/** Services which do not query PostgreSQL can run without a database connection. */
export function withAppServices<T>(
  callback: (services: AppServices) => T | Promise<T>,
): Promise<T> {
  return runInRequestScope(container, callback);
}

/** Use for Node.js Route Handlers, Server Actions and background jobs needing data. */
export async function withDatabaseServices<T>(
  callback: (services: DatabaseServices) => T | Promise<T>,
): Promise<T> {
  const orm = await database.get();
  return withEntityManager(orm, async (entityManager) => {
    // EM belongs to this request only, never the singleton container.
    const scope = container.createScope<DatabaseServices>();
    scope.register({ entityManager: asValue(entityManager) });
    try {
      return await runInRequestScope(scope, callback);
    } finally {
      await scope.dispose();
    }
  });
}
