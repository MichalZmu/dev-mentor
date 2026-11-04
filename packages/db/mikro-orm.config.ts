import "./src/env";
import { Migrator } from "@mikro-orm/migrations";
import { defineConfig } from "@mikro-orm/postgresql";
import { fileURLToPath } from "node:url";
import { createDatabaseConfig } from "./src/config";

export default defineConfig({
  ...createDatabaseConfig(),
  extensions: [Migrator],
  migrations: {
    // SQL-owned migrations do not generate filesystem schema snapshots.
    snapshot: false,
    path: fileURLToPath(new URL("./migrations", import.meta.url)),
    emit: "ts",
  },
});
