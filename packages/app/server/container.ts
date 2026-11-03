import "server-only";

import { randomUUID } from "node:crypto";
import { asFunction, asValue, createContainer, InjectionMode, type AwilixContainer } from "awilix";
import { applicationInfo, type ApplicationInfo, type RequestMetadata } from "@devmentor/core";
import type { DatabaseProvider, EntityManager } from "@devmentor/db";

export interface AppServices {
  applicationInfo: Readonly<ApplicationInfo>;
  request: Readonly<RequestMetadata>;
  database: DatabaseProvider;
}

export interface DatabaseServices extends AppServices {
  entityManager: EntityManager;
}

export function createAppContainer(database: DatabaseProvider): AwilixContainer<AppServices> {
  const container = createContainer<AppServices>({
    injectionMode: InjectionMode.PROXY,
    strict: true,
  });
  container.register({
    applicationInfo: asValue(applicationInfo),
    database: asValue(database),
  });
  return container;
}

/** Always dispose request-scoped resources, including when the callback rejects. */
export async function runInRequestScope<TServices extends AppServices, T>(
  container: AwilixContainer<TServices>,
  callback: (services: TServices) => T | Promise<T>,
  request?: RequestMetadata,
): Promise<T> {
  const scope = container.createScope();
  scope.register({
    // Generate an identifier only if a caller uses request metadata.
    // Pure application-info reads remain safe during Next.js prerendering.
    request: asFunction(() => Object.freeze(request ? { ...request } : { id: randomUUID() })).scoped(),
  });
  try {
    return await callback(scope.cradle);
  } finally {
    await scope.dispose();
  }
}
