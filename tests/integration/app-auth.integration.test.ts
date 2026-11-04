import { createHmac } from "node:crypto";
import { Pool } from "pg";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { beforeAll, afterAll, expect, test } from "vitest";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { database } from "@devmentor/db";
import { handleApi } from "../../packages/app/server/api";
import { handleNativeAuth } from "../../packages/app/server/auth-http";
import {
  closeAuthRuntime,
  getAuthRuntime,
} from "../../packages/app/server/auth";
import { runWorkerOnce } from "../../packages/app/server/worker";

const run = promisify(execFile);
const origin = "http://localhost:3000";
let container: StartedPostgreSqlContainer | undefined;
const previous = { ...process.env };
function request(
  path: string,
  method = "GET",
  body?: unknown,
  cookie = "",
  extra: Record<string, string> = {},
): Request {
  return new Request(origin + "/api/v1/" + path, {
    method,
    headers: { origin, "content-type": "application/json", cookie, ...extra },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
function cookieOf(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
}
async function login(
  email: string,
  password = "DemoOnly_2026!",
): Promise<string> {
  const result = await handleApi(
    request("auth/login", "POST", { email, password }),
  );
  expect(result.status).toBe(200);
  return cookieOf(result);
}
beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:18.6")
    .withDatabase("app_integration")
    .start();
  Object.assign(process.env, {
    APP_MODE: "demo",
    APP_URL: origin,
    DATABASE_URL: container.getConnectionUri(),
    AUTH_DATABASE_URL: container.getConnectionUri(),
    MIGRATION_DATABASE_URL: container.getConnectionUri(),
    AUTH_MIGRATION_DATABASE_URL: container.getConnectionUri(),
  });
  await run("npm", ["run", "migrate"], { env: process.env, timeout: 90_000 });
  await run("npm", ["run", "seed:demo"], { env: process.env, timeout: 90_000 });
});
afterAll(async () => {
  await closeAuthRuntime();
  await database.close();
  await container?.stop();
  for (const key of Object.keys(process.env))
    if (!(key in previous)) delete process.env[key];
  Object.assign(process.env, previous);
});

test("register, browser-owned demo verification, login, reset and revoke real sessions", async () => {
  const email = "auth-test@example.test";
  const password = "Valid_TestPassword2026!";
  const signup = await handleApi(
    request("auth/register", "POST", {
      email,
      password,
      name: "Test User",
      termsVersion: "2026-11-03",
    }),
  );
  expect(signup.status).toBe(201);
  const mailboxCookie = cookieOf(signup);
  expect(mailboxCookie).toContain("devmentor_demo_mailbox=");
  expect(signup.headers.getSetCookie().join(";")).toContain("HttpOnly");
  const inaccessible = await handleApi(request("demo/mailbox"));
  expect((await inaccessible.json()).data).toEqual([]);
  const mailbox = await handleApi(
    request("demo/mailbox", "GET", undefined, mailboxCookie),
  );
  const boundAddressMailbox = await handleApi(
    new Request("http://0.0.0.0:3000/api/v1/demo/mailbox", {
      headers: {
        host: "localhost:3000",
        cookie: mailboxCookie,
        "x-forwarded-host": "public.example",
      },
    }),
  );
  expect(boundAddressMailbox.status).toBe(200);
  expect(await boundAddressMailbox.json()).toEqual(
    await mailbox.clone().json(),
  );
  const publicHost = await handleApi(
    new Request(origin + "/api/v1/demo/mailbox", {
      headers: {
        host: "public.example",
        cookie: mailboxCookie,
        "x-forwarded-host": "localhost:3000",
      },
    }),
  );
  expect(publicHost.status).toBe(404);
  const messages = (await mailbox.json()).data as { url: string }[];
  expect(messages.length).toBe(1);
  const verification = messages[0]?.url;
  if (!verification) throw new Error("No verification mail");
  const verified = await handleNativeAuth(new Request(verification));
  expect([200, 302]).toContain(verified.status);
  const cookie = await login(email, password);
  const me = await handleApi(request("me", "GET", undefined, cookie));
  expect(me.status).toBe(200);
  expect((await me.json()).data.roles).toEqual(["mentee"]);
  const csrf = await handleApi(
    request(
      "me/goals",
      "PUT",
      {
        goal: "career",
        level: "beginner",
        description: "My development plan for the coming months",
      },
      cookie,
      { origin: "https://untrusted.invalid" },
    ),
  );
  expect(csrf.status).toBe(403);
  const reset = await handleApi(
    request("auth/password-reset", "POST", { email }, mailboxCookie),
  );
  const unknown = await handleApi(
    request("auth/password-reset", "POST", { email: "missing@example.test" }),
  );
  expect(reset.status).toBe(202);
  expect(await reset.json()).toEqual(await unknown.json());
  const updated = (
    await (
      await handleApi(request("demo/mailbox", "GET", undefined, mailboxCookie))
    ).json()
  ).data as { url: string }[];
  const resetUrl = updated.find((item) =>
    item.url.includes("mode=confirm"),
  )?.url;
  if (!resetUrl) throw new Error("No password reset mail");
  const token = new URL(resetUrl).searchParams.get("token");
  const changed = await handleApi(
    request("auth/password-reset/confirm", "POST", {
      token,
      newPassword: "Different_Password2026!",
    }),
  );
  expect(changed.status).toBe(200);
  expect(
    (await handleApi(request("me", "GET", undefined, cookie))).status,
  ).toBe(401);
  const newCookie = await login(email, "Different_Password2026!");
  expect(
    (await handleApi(request("auth/logout", "POST", {}, newCookie))).status,
  ).toBe(204);
  expect(
    (await handleApi(request("me", "GET", undefined, newCookie))).status,
  ).toBe(401);
});
test("demo checkout only confirms through durable inbox and worker; foreign resource is denied", async () => {
  const cookie = await login("demo@example.test");
  const foreign = await login("mentor@example.test");
  const slotsResponse = await handleApi(
    request("mentors/demo-mentor/availability"),
  );
  expect(slotsResponse.status).toBe(200);
  const slots = (await slotsResponse.json()).data as {
    id: string;
    available: boolean;
    startsAt: string;
  }[];
  const slot = slots.find(
    (item) =>
      item.available && Date.parse(item.startsAt) > Date.now() + 25 * 3600000,
  );
  if (!slot) throw new Error("Seed must provide future cancellable slot");
  const holdResponse = await handleApi(
    request(
      "booking-holds",
      "POST",
      { mentorId: "demo-mentor", slotId: slot.id, durationMinutes: 50 },
      cookie,
    ),
  );
  expect(holdResponse.status).toBe(201);
  const hold = (await holdResponse.json()).data;
  const checkout = await handleApi(
    request(
      "checkout-sessions",
      "POST",
      {
        holdId: hold.id,
        paymentMode: "psp",
        acceptedPolicyVersion: hold.policyVersion,
      },
      cookie,
      { "idempotency-key": "integration_checkout_1" },
    ),
  );
  expect(checkout.status).toBe(201);
  expect((await checkout.json()).data.paymentState).toBe("pending");
  const unauthorized = await handleApi(
    request("orders/" + hold.id, "GET", undefined, foreign),
  );
  expect(unauthorized.status).toBe(404);
  const payment = await handleApi(
    request("demo/payments/" + hold.id, "POST", {}, cookie),
  );
  expect(payment.status).toBe(202);
  expect(
    (
      await (
        await handleApi(request("orders/" + hold.id, "GET", undefined, cookie))
      ).json()
    ).data.paymentState,
  ).toBe("pending");
  for (let i = 0; i < 3; i++) await runWorkerOnce();
  const paid = (
    await (
      await handleApi(request("orders/" + hold.id, "GET", undefined, cookie))
    ).json()
  ).data;
  expect(paid.paymentState).toBe("paid");
  expect(paid.state).toBe("confirmed");
});

test("password reset preserves native throttling instead of reporting a false success", async () => {
  const { pool } = getAuthRuntime();
  await pool.query('delete from auth."rateLimit"');
  let result: Response | undefined;
  for (let attempt = 0; attempt < 7; attempt++)
    result = await handleApi(
      request("auth/password-reset", "POST", {
        email: "throttle@example.test",
      }),
    );
  expect(result?.status).toBe(429);
  expect(result?.headers.get("retry-after")).toBe("60");
});

test("MFA proof is bound to a real verified session for production administration", async () => {
  await closeAuthRuntime();
  const saved = {
    APP_MODE: process.env.APP_MODE,
    APP_URL: process.env.APP_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
  };
  Object.assign(process.env, {
    APP_MODE: "production",
    APP_URL: "https://localhost:3000",
    AUTH_SECRET: "integration-only-production-configuration-secret-2026",
  });
  const send = (path: string, body: unknown, cookie = ""): Request =>
    new Request("https://localhost:3000" + path, {
      method: "POST",
      headers: {
        origin: "https://localhost:3000",
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify(body),
    });
  try {
    await getAuthRuntime().pool.query('delete from auth."rateLimit"');
    const signin = await handleApi(
      send("/api/v1/auth/login", {
        email: "admin@example.test",
        password: "DemoOnly_2026!",
      }),
    );
    expect(signin.status).toBe(200);
    const cookie = cookieOf(signin);
    expect(signin.headers.getSetCookie().join(";")).toContain("Secure");
    const before = await handleApi(
      new Request("https://localhost:3000/api/v1/admin/overview", {
        headers: { cookie },
      }),
    );
    expect(before.status).toBe(403);
    const enabled = await handleNativeAuth(
      send(
        "/api/auth/two-factor/enable",
        { password: "DemoOnly_2026!" },
        cookie,
      ),
    );
    expect(enabled.status).toBe(200);
    const result = await enabled.json();
    const secret = new URL(result.totpURI).searchParams.get("secret");
    if (!secret) throw new Error("No TOTP enrollment secret");
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    let bits = "";
    for (const character of secret.toUpperCase().replace(/=+$/, ""))
      bits += alphabet.indexOf(character).toString(2).padStart(5, "0");
    const bytes = [];
    for (let i = 0; i + 8 <= bits.length; i += 8)
      bytes.push(parseInt(bits.slice(i, i + 8), 2));
    const counter = Buffer.alloc(8);
    counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
    const mac = createHmac("sha1", Buffer.from(bytes)).update(counter).digest();
    const offset = (mac.at(-1) ?? 0) & 15;
    const code = String(
      (mac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000,
    ).padStart(6, "0");
    const verified = await handleNativeAuth(
      send("/api/auth/two-factor/verify-totp", { code }, cookie),
    );
    expect(verified.status).toBe(200);
    const jar = new Map<string, string>();
    for (const entry of (
      cookie +
      "; " +
      cookieOf(enabled) +
      "; " +
      cookieOf(verified)
    ).split(";")) {
      const index = entry.indexOf("=");
      if (index > 0)
        jar.set(entry.slice(0, index).trim(), entry.slice(index + 1).trim());
    }
    const combined = [...jar]
      .map(([key, value]) => `${key}=${value}`)
      .join("; ");
    const after = await handleApi(
      new Request("https://localhost:3000/api/v1/admin/overview", {
        headers: { cookie: combined },
      }),
    );
    expect(after.status).toBe(200);
  } finally {
    await closeAuthRuntime();
    for (const [key, value] of Object.entries(saved))
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
  }
});

test("runtime SQL roles permit DML and reject DDL; dump restores to a new isolated database", async () => {
  if (!container) throw new Error("Container unavailable");
  const runtime = getAuthRuntime();
  await runtime.pool.query(
    "create role domain_probe login password 'local_test_only_password_2026'",
  );
  await runtime.pool.query(
    "grant usage on schema public to domain_probe; grant select,insert,update,delete on all tables in schema public to domain_probe; grant usage,select on all sequences in schema public to domain_probe",
  );
  const connection = new URL(container.getConnectionUri());
  connection.username = "domain_probe";
  connection.password = "local_test_only_password_2026";
  const restricted = new Pool({ connectionString: connection.href });
  try {
    expect(
      (await restricted.query("select count(*) from public.domain_users")).rows
        .length,
    ).toBe(1);
    await expect(
      restricted.query("create table public.must_not_create(id int)"),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      restricted.query('select * from auth."user"'),
    ).rejects.toMatchObject({ code: "42501" });
  } finally {
    await restricted.end();
  }
  const dump = await container.exec([
    "pg_dump",
    "-U",
    container.getUsername(),
    "-d",
    container.getDatabase(),
    "--no-owner",
    "--no-privileges",
    "--clean",
    "--if-exists",
  ]);
  expect(dump.exitCode).toBe(0);
  const restored = await new PostgreSqlContainer("postgres:18.6")
    .withDatabase("restored_probe")
    .start();
  const restoredPool = new Pool({
    connectionString: restored.getConnectionUri(),
  });
  try {
    // This is a new, disposable restore container, never the source/developer database.
    // A schema-filtered SQL dump recreates public, which initdb already provided.
    // Full-database dump retains extensions; the pristine initdb public schema is required.
    await restored.copyContentToContainer([
      { content: dump.stdout, target: "/tmp/restore.sql" },
    ]);
    const result = await restored.exec([
      "psql",
      "-U",
      restored.getUsername(),
      "-d",
      restored.getDatabase(),
      "-v",
      "ON_ERROR_STOP=1",
      "-f",
      "/tmp/restore.sql",
    ]);
    expect(
      result.exitCode,
      result.stderr
        .split("\n")
        .filter((line) => line.includes("ERROR:"))
        .join("\n"),
    ).toBe(0);
    for (const table of [
      'auth."user"',
      "public.domain_users",
      "public.bookings",
      "public.inbox",
      "public.outbox_jobs",
    ]) {
      const expected = await runtime.pool.query(
        `select count(*)::int as count from ${table}`,
      );
      const actual = await restoredPool.query(
        `select count(*)::int as count from ${table}`,
      );
      expect(actual.rows).toEqual(expected.rows);
    }
    const constraints = await restoredPool.query(
      "select count(*)::int as count from pg_constraint where contype='x'",
    );
    expect(constraints.rows[0]?.count).toBeGreaterThan(0);
  } finally {
    await restoredPool.end();
    await restored.stop();
  }
});

test("a foreign parent learning-plan identifier cannot mutate an own milestone", async () => {
  const cookie = await login("demo@example.test");
  const current = await handleApi(
    request("me/learning-plan", "GET", undefined, cookie),
  );
  expect(current.status).toBe(200);
  const plan = (await current.json()).data;
  const attempted = await handleApi(
    request(
      "learning-plans/not-my-plan/milestones/any-milestone",
      "PATCH",
      { completed: true, version: plan.version },
      cookie,
    ),
  );
  expect(attempted.status).toBe(404);
});

test("signup retains the three-per-ten-second client limit while a distinct test-ingress client has its own bucket", async () => {
  const input = {
    password: "TestOnly_RateLimit2026!",
    name: "Rate test",
    termsVersion: "2026-11-03",
  };
  for (let index = 0; index < 4; index++) {
    const result = await handleApi(
      request(
        "auth/register",
        "POST",
        { ...input, email: `rate-client-${index}@example.test` },
        "",
        { "x-forwarded-for": "192.0.2.240" },
      ),
    );
    expect(result.status).toBe(index < 3 ? 201 : 429);
  }
  const independent = await handleApi(
    request(
      "auth/register",
      "POST",
      { ...input, email: "rate-independent@example.test" },
      "",
      { "x-forwarded-for": "192.0.2.241" },
    ),
  );
  expect(independent.status).toBe(201);
});
