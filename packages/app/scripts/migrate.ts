import "@devmentor/db";
import { config } from "dotenv";
import { resolve } from "node:path";
import { getMigrations } from "better-auth/db/migration";
import { runDomainMigrations } from "@devmentor/db";
import { createAuthRuntime } from "../server/auth";
import { runtimeEnvironment } from "../server/env";

config({ path: resolve(import.meta.dirname, "../../../.env"), quiet: true });
const env = {
  ...process.env,
  DATABASE_URL: process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL,
  AUTH_DATABASE_URL:
    process.env.AUTH_MIGRATION_DATABASE_URL ??
    process.env.MIGRATION_DATABASE_URL ??
    process.env.AUTH_DATABASE_URL ??
    process.env.DATABASE_URL,
};
const runtime = createAuthRuntime(runtimeEnvironment(env));
try {
  await runtime.pool.query("create schema if not exists auth");
  const migrations = await getMigrations(runtime.auth.options);
  await migrations.runMigrations();
  await runtime.pool
    .query(`create table if not exists auth.mfa_session(session_id text primary key references auth.session(id) on delete cascade, verified_at timestamptz not null);
    create table if not exists auth.demo_mailbox_owner(email text primary key,owner_hash text not null);
    create table if not exists auth.demo_mailbox(id uuid primary key,owner_hash text not null,subject text not null,body text not null,url text,created_at timestamptz not null);
    create index if not exists demo_mailbox_owner_idx on auth.demo_mailbox(owner_hash,created_at);
    create table if not exists auth.api_rate_limit(key text primary key,window_start timestamptz not null,count integer not null);`);
  await runDomainMigrations(env);
  console.log(
    JSON.stringify({
      level: "info",
      time: new Date().toISOString(),
      operation: "migrate",
      code: "MIGRATIONS_OK",
    }),
  );
} catch {
  console.error(
    JSON.stringify({
      level: "error",
      time: new Date().toISOString(),
      operation: "migrate",
      code: "MIGRATIONS_FAILED",
    }),
  );
  process.exitCode = 1;
} finally {
  await runtime.pool.end();
}
