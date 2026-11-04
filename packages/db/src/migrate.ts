import { MikroORM } from "@mikro-orm/postgresql";
import { Migrator } from "@mikro-orm/migrations";
import { createDatabaseConfig } from "./config";
import { Migration202611030001 } from "../migrations/Migration202611030001";
import { Migration202611030002 } from "../migrations/Migration202611030002";
import { Migration202611030003 } from "../migrations/Migration202611030003";
import { Migration202611030004 } from "../migrations/Migration202611030004";
import { Migration202611040001 } from "../migrations/Migration202611040001";

/** Explicit deployment/CLI operation. Never call this from web or worker startup. */
export async function runDomainMigrations(
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const orm = await MikroORM.init({
    ...createDatabaseConfig(env),
    extensions: [Migrator],
    migrations: {
      // SQL-owned migrations do not generate filesystem schema snapshots.
      snapshot: false,
      migrationsList: [
        Migration202611030001,
        Migration202611030002,
        Migration202611030003,
        Migration202611030004,
        Migration202611040001,
      ],
    },
  });
  try {
    await orm.migrator.up();
  } finally {
    await orm.close(true);
  }
}
