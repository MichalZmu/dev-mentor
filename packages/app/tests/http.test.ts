import { afterEach, expect, test, vi } from "vitest";
import { z } from "zod";
import { DomainError } from "@devmentor/core";
import { runtimeEnvironment } from "../server/env";
import {
  assertOrigin,
  empty,
  errorResponse,
  idempotencyKey,
  jsonBody,
  response,
} from "../server/http";
import { logEvent } from "../server/log";
import { trace } from "@opentelemetry/api";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
test("responses preserve transport metadata and never disclose errors", async () => {
  expect(await response({ ok: true }).json()).toEqual({ data: { ok: true } });
  expect(response(null, 201).status).toBe(201);
  expect(response(null).headers.get("x-content-type-options")).toBe("nosniff");
  expect(empty().status).toBe(204);
  expect(await empty().text()).toBe("");
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const internal = errorResponse(new Error("secret"));
  expect(internal.status).toBe(503);
  expect(await internal.text()).not.toContain("secret");
  expect(log).toHaveBeenCalledOnce();
  const limited = errorResponse(new DomainError("RATE_LIMITED", 429), "req");
  expect(limited.headers.get("retry-after")).toBe("60");
  expect(limited.headers.get("x-request-id")).toBe("req");
  const schema = z.object({
    profile: z.object({ name: z.string() }),
    age: z.number(),
  });
  const parsed = schema.safeParse({ profile: { name: 1 }, age: "old" });
  if (parsed.success) throw new Error("expected invalid fixture");
  const invalid = errorResponse(parsed.error, "validation");
  expect(invalid.status).toBe(422);
  expect(await invalid.json()).toMatchObject({
    error: {
      code: "VALIDATION_ERROR",
      fieldErrors: {
        "profile.name": [expect.any(String)],
        age: [expect.any(String)],
      },
    },
  });
});
test("JSON parsing rejects missing MIME, malformed JSON, declared and actual oversized UTF8 bodies", async () => {
  const request = (
    body: string,
    headers: HeadersInit = { "content-type": "application/json" },
  ): Request =>
    new Request("http://localhost", { method: "POST", body, headers });
  expect(await jsonBody(request('{"x":1}'))).toEqual({ x: 1 });
  expect(
    await jsonBody(
      request("null", { "content-type": "application/json; charset=utf-8" }),
    ),
  ).toBeNull();
  await expect(jsonBody(request("{}", {}))).rejects.toMatchObject({
    code: "JSON_REQUIRED",
  });
  await expect(
    jsonBody(request("{}", { "content-type": "text/plain" })),
  ).rejects.toMatchObject({ code: "JSON_REQUIRED" });
  await expect(
    jsonBody(
      request("{}", {
        "content-type": "application/json",
        "content-length": "32769",
      }),
    ),
  ).rejects.toMatchObject({ code: "BODY_TOO_LARGE" });
  await expect(
    jsonBody(request('"' + "x".repeat(32767) + '"')),
  ).rejects.toMatchObject({ code: "BODY_TOO_LARGE" });
  await expect(jsonBody(request("invalid"))).rejects.toMatchObject({
    code: "INVALID_JSON",
  });
  expect(await jsonBody(request('"' + "x".repeat(32766) + '"'))).toHaveLength(
    32766,
  );
});
test("origin and idempotency checks enforce exact origins and strict bounded keys", () => {
  const request = (headers: HeadersInit): Request =>
    new Request("https://app.example/api", { headers });
  expect(() =>
    assertOrigin(
      request({ origin: "https://app.example" }),
      "https://app.example/path",
    ),
  ).not.toThrow();
  expect(() => assertOrigin(request({}), "https://app.example")).toThrow(
    "ORIGIN_FORBIDDEN",
  );
  expect(() =>
    assertOrigin(
      request({ origin: "https://attacker.example" }),
      "https://app.example",
    ),
  ).toThrow("ORIGIN_FORBIDDEN");
  expect(() =>
    assertOrigin(
      request({
        origin: "https://app.example",
        "sec-fetch-site": "cross-site",
      }),
      "https://app.example",
    ),
  ).toThrow("ORIGIN_FORBIDDEN");
  expect(idempotencyKey(request({ "idempotency-key": "abc_123-" }))).toBe(
    "abc_123-",
  );
  for (const key of [undefined, "short", "a".repeat(129), "invalid!key"]) {
    expect(() =>
      idempotencyKey(request(key ? { "idempotency-key": key } : {})),
    ).toThrow();
  }
});
test("runtime config validates defaults, demo loopback and production secrets without leaking values", () => {
  const demo = { APP_MODE: "demo", DATABASE_URL: "postgres://local" };
  expect(runtimeEnvironment(demo)).toMatchObject({
    APP_URL: "http://localhost:3000",
    DB_AUTH_POOL_MAX: 5,
  });
  for (const hostname of ["localhost", "127.0.0.1", "[::1]"]) {
    expect(
      runtimeEnvironment({ ...demo, APP_URL: `http://${hostname}:3100` })
        .APP_MODE,
    ).toBe("demo");
  }
  for (const input of [
    {},
    { ...demo, APP_URL: "http://external.example" },
    { DATABASE_URL: "db" },
    { DATABASE_URL: "db", APP_URL: "https://example.test" },
    { DATABASE_URL: "db", AUTH_SECRET: "s".repeat(32) },
    { ...demo, DB_AUTH_POOL_MAX: "21" },
  ])
    expect(() => runtimeEnvironment(input)).toThrow(
      "Invalid server configuration",
    );
  expect(
    runtimeEnvironment({
      DATABASE_URL: "db",
      APP_URL: "https://example.test",
      AUTH_SECRET: "s".repeat(32),
    }).APP_MODE,
  ).toBe("production");
  vi.stubEnv("APP_MODE", "demo");
  vi.stubEnv("DATABASE_URL", "db");
  vi.stubEnv("APP_URL", "http://localhost:3000");
  expect(runtimeEnvironment().DATABASE_URL).toBe("db");
});
test("structured logging retains only explicit safe metadata and optional trace", () => {
  const info = vi.spyOn(console, "log").mockImplementation(() => {});
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(trace, "getActiveSpan").mockReturnValue(undefined);
  logEvent("info", "read", "r1", "OK");
  expect(JSON.parse(String(info.mock.calls[0]?.[0]))).toMatchObject({
    level: "info",
    operation: "read",
    requestId: "r1",
    code: "OK",
    time: expect.stringMatching(/Z$/),
  });
  vi.spyOn(trace, "getActiveSpan").mockReturnValue({
    spanContext: () => ({ traceId: "trace" }),
  } as ReturnType<typeof trace.getActiveSpan>);
  logEvent("error", "write", "r2", "RETRY");
  expect(JSON.parse(String(error.mock.calls[0]?.[0]))).toMatchObject({
    traceId: "trace",
    level: "error",
  });
});

test("runtime configuration requires a complete Google OAuth credential pair", () => {
  const base = { APP_MODE: "demo", DATABASE_URL: "postgres://local" };
  for (const credentials of [
    { OAUTH_GOOGLE_CLIENT_ID: "client-id" },
    { OAUTH_GOOGLE_CLIENT_SECRET: "client-secret" },
    { OAUTH_GOOGLE_CLIENT_ID: "", OAUTH_GOOGLE_CLIENT_SECRET: "client-secret" },
  ]) {
    expect(() => runtimeEnvironment({ ...base, ...credentials })).toThrow(
      "Invalid server configuration",
    );
  }
  expect(
    runtimeEnvironment({
      ...base,
      OAUTH_GOOGLE_CLIENT_ID: "client-id",
      OAUTH_GOOGLE_CLIENT_SECRET: "client-secret",
    }),
  ).toMatchObject({
    OAUTH_GOOGLE_CLIENT_ID: "client-id",
    OAUTH_GOOGLE_CLIENT_SECRET: "client-secret",
  });
});
