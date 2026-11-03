import "./src/env";
import { Migrator } from "@mikro-orm/migrations";
import { defineConfig } from "@mikro-orm/postgresql";
import { fileURLToPath } from "node:url";
import { createDatabaseConfig } from "./src/config";

export default defineConfig({
  ...createDatabaseConfig(),
  extensions: [Migrator],
  migrations: {
    path: fileURLToPath(new URL("./migrations", import.meta.url)),
    emit: "ts",
  },
});
