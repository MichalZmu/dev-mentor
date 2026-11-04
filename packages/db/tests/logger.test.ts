import { expect, test } from "vitest";
import { serializeLog } from "../src/logger";
import { createDatabaseConfig } from "../src/config";

test("database validation never exposes input credentials", () => {
  const secret = "super-secret-value";
  expect(() =>
    createDatabaseConfig({
      DATABASE_URL: `https://user:${secret}@example.com/db`,
    }),
  ).toThrow(/must specify PostgreSQL/);
  try {
    createDatabaseConfig({
      DATABASE_URL: `postgresql://user:${secret}@host/db`,
      DB_POOL_MAX: secret,
    });
  } catch (error) {
    expect(String(error)).not.toContain(secret);
    return;
  }
  throw new Error("invalid pool configuration must fail");
});
test("JSON logging allows only safe fields and UTC timestamps", () => {
  const event = {
    level: "error" as const,
    requestId: "request-1",
    operation: "database.check" as const,
    code: "DATABASE_UNAVAILABLE" as const,
    password: "must-not-log",
    error: new Error("SQL must-not-log"),
  };
  const json = serializeLog(event);
  expect(json).not.toContain("must-not-log");
  expect(JSON.parse(json)).toEqual({
    level: "error",
    requestId: "request-1",
    operation: "database.check",
    code: "DATABASE_UNAVAILABLE",
    time: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T.*Z$/),
  });
});
