import { config } from "dotenv";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { database, withEntityManager, seedDemoPlatform } from "@devmentor/db";
import { createAuthRuntime } from "../server/auth";
import { runtimeEnvironment } from "../server/env";
config({ path: resolve(import.meta.dirname, "../../../.env"), quiet: true });
const runtime = createAuthRuntime(runtimeEnvironment());
if (runtime.env.APP_MODE !== "demo")
  throw new Error("Demo seed requires APP_MODE=demo");
try {
  async function ensureIdentity(email: string, name: string): Promise<string> {
    const existing = await runtime.pool.query<{ id: string }>(
      'select id from auth."user" where email=$1',
      [email],
    );
    const existingId = existing.rows[0]?.id;
    if (existingId) return existingId;
    const userId = randomUUID();
    const password = await hashPassword("DemoOnly_2026!");
    const client = await runtime.pool.connect();
    try {
      await client.query("begin");
      await client.query(
        'insert into auth."user"(id,name,email,"emailVerified","createdAt","updatedAt","twoFactorEnabled") values($1,$2,$3,true,now(),now(),false)',
        [userId, name, email],
      );
      await client.query(
        `insert into auth.account(id,"accountId","providerId","userId",password,"createdAt","updatedAt") values($1,$2,'credential',$2,$3,now(),now())`,
        [randomUUID(), userId, password],
      );
      await client.query("commit");
      return userId;
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }
  const identities = {
    menteeId: await ensureIdentity("demo@example.test", "Uczestnik Demo"),
    mentorId: await ensureIdentity("mentor@example.test", "Anna Kowalska"),
    adminId: await ensureIdentity("admin@example.test", "Administrator Demo"),
  };
  const orm = await database.get();
  const result = await withEntityManager(orm, (em) =>
    seedDemoPlatform(em, identities),
  );
  console.log(
    JSON.stringify({
      level: "info",
      time: new Date().toISOString(),
      operation: "seed.demo",
      code: result.seeded ? "DEMO_SEED_OK" : "DEMO_SEED_SKIPPED",
      users: ["demo@example.test", "mentor@example.test", "admin@example.test"],
    }),
  );
} catch {
  console.error(
    JSON.stringify({
      level: "error",
      time: new Date().toISOString(),
      operation: "seed.demo",
      code: "DEMO_SEED_FAILED",
    }),
  );
  process.exitCode = 1;
} finally {
  await runtime.pool.end();
  await database.close();
}
