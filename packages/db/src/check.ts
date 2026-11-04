import "./env";
import { randomUUID } from "node:crypto";
import { createDatabaseProvider, withEntityManager } from "./runtime";
import { serializeLog } from "./logger";

const provider = createDatabaseProvider();
const requestId = randomUUID();
try {
  const orm = await provider.get();
  await withEntityManager(orm, async (em) => {
    await em.getConnection().execute("select 1");
  });
  console.log(
    serializeLog({
      level: "info",
      requestId,
      operation: "database.check",
      code: "DATABASE_OK",
    }),
  );
} catch {
  console.error(
    serializeLog({
      level: "error",
      requestId,
      operation: "database.check",
      code: "DATABASE_UNAVAILABLE",
    }),
  );
  process.exitCode = 1;
} finally {
  await provider.close();
}
