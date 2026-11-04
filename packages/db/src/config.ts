import { defineConfig, type Options } from "@mikro-orm/postgresql";
import { z } from "zod";
import { domainEntities, domainTableNames } from "./entities";

const poolSize = (fallback: string) =>
  z
    .string()
    .regex(/^\d+$/, "Pool size must be a non-negative integer.")
    .default(fallback)
    .transform(Number)
    .refine(Number.isSafeInteger, "Pool size is outside the supported range.");

const environmentSchema = z
  .object({
    DATABASE_URL: z
      .string({ error: "DATABASE_URL is required to connect to PostgreSQL." })
      .superRefine((value, context) => {
        let url: URL;
        try {
          url = new URL(value);
        } catch {
          context.addIssue({
            code: "custom",
            message: "DATABASE_URL must be a valid PostgreSQL URL.",
          });
          return;
        }
        if (
          !["postgres:", "postgresql:"].includes(url.protocol) ||
          !url.hostname ||
          url.pathname.length < 2
        ) {
          context.addIssue({
            code: "custom",
            message:
              "DATABASE_URL must specify PostgreSQL, a host and a database.",
          });
        }
      }),
    DB_POOL_MIN: poolSize("0"),
    DB_POOL_MAX: poolSize("10"),
  })
  .refine(
    (env) => env.DB_POOL_MAX >= 1 && env.DB_POOL_MIN <= env.DB_POOL_MAX,
    "Pool configuration must satisfy 0 <= min <= max and max >= 1.",
  );

/** Validate before initializing the pool; errors never include input values. */
export function createDatabaseConfig(
  env: NodeJS.ProcessEnv = process.env,
): Options {
  const parsed = environmentSchema.safeParse(env);
  if (!parsed.success)
    throw new Error(
      parsed.error.issues.map((issue) => issue.message).join(" "),
    );
  return defineConfig({
    clientUrl: parsed.data.DATABASE_URL,
    pool: { min: parsed.data.DB_POOL_MIN, max: parsed.data.DB_POOL_MAX },
    // PostgreSQL exclusion/partial constraints and audit triggers are versioned SQL-owned migrations.
    // Generate a blank migration for domain changes; never infer destructive DDL from scalar metadata.
    entities: domainEntities,
    schemaGenerator: { skipTables: [...domainTableNames, /^auth\./] },
    discovery: { warnWhenNoEntities: false },
    debug: false,
  });
}
