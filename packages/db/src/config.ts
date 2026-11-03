import { defineConfig, type Options } from "@mikro-orm/postgresql";
function poolSize(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value)) throw new Error(`${name} must be a non-negative integer.`);
  const size = Number(value);
  if (!Number.isSafeInteger(size)) throw new Error(`${name} is outside the supported range.`);
  return size;
}

export function createDatabaseConfig(env: NodeJS.ProcessEnv = process.env): Options {
  if (!env.DATABASE_URL) throw new Error("DATABASE_URL is required to connect to PostgreSQL.");
  let url: URL;
  try {
    url = new URL(env.DATABASE_URL);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL URL.");
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || url.pathname.length < 2) {
    throw new Error("DATABASE_URL must specify PostgreSQL, a host and a database.");
  }

  const min = poolSize(env.DB_POOL_MIN, 0, "DB_POOL_MIN");
  const max = poolSize(env.DB_POOL_MAX, 10, "DB_POOL_MAX");
  if (max < 1 || min > max) throw new Error("Pool configuration must satisfy 0 <= min <= max and max >= 1.");

  return defineConfig({
    clientUrl: env.DATABASE_URL,
    pool: { min, max },
    // Register entity schemas explicitly here when domain entities are introduced.
    entities: [],
    discovery: { warnWhenNoEntities: false },
    debug: false,
  });
}
