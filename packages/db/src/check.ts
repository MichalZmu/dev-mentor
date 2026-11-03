import "./env";
import { createDatabaseProvider, withEntityManager } from "./runtime";

const provider = createDatabaseProvider();
try {
  const orm = await provider.get();
  await withEntityManager(orm, async (em) => {
    await em.getConnection().execute("select 1");
  });
  console.log("PostgreSQL connection OK.");
} catch {
  // Driver errors may contain connection details; do not log credentials.
  console.error("PostgreSQL connection failed. Check DATABASE_URL and database availability.");
  process.exitCode = 1;
} finally {
  await provider.close();
}
