import "server-only";

export { database, createDatabaseProvider, withEntityManager } from "./runtime";
export type { Database, DatabaseProvider } from "./runtime";
export type { EntityManager } from "@mikro-orm/postgresql";

export { createPlatformRepository } from "./platform-repository";
export { runDomainMigrations } from "./migrate";
export { domainEntities, domainTableNames } from "./entities";

export { seedDemoPlatform } from "./seed";
export type { DemoIdentities } from "./seed";
