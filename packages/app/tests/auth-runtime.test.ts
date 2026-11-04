import { beforeEach, expect, test, vi } from "vitest";
import type { BetterAuthOptions } from "better-auth";
import type { RuntimeEnvironment } from "../server/env";
const mocks = vi.hoisted(() => ({
  pool: vi.fn(),
  end: vi.fn(),
  auth: vi.fn(),
  twoFactor: vi.fn(),
  email: vi.fn(),
  env: vi.fn(),
}));
vi.mock("pg", () => ({
  Pool: class {
    constructor(...args: unknown[]) {
      mocks.pool(...args);
    }
    end = mocks.end;
  },
}));
vi.mock("better-auth", () => ({ betterAuth: mocks.auth }));
vi.mock("better-auth/plugins", () => ({ twoFactor: mocks.twoFactor }));
vi.mock("../server/email", () => ({ deliverEmail: mocks.email }));
vi.mock("../server/env", () => ({ runtimeEnvironment: mocks.env }));
const env: RuntimeEnvironment = {
  APP_MODE: "demo",
  APP_URL: "http://localhost:3100",
  DATABASE_URL: "postgres://app",
  EMAIL_FROM: "from@example.test",
  DB_AUTH_POOL_MAX: 5,
};
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.env.mockReturnValue(env);
  mocks.auth.mockReturnValue({ handler: "auth" });
});
test("auth runtime uses dedicated schema/pool and secure production cookies", async () => {
  const { createAuthRuntime } = await import("../server/auth");
  expect(createAuthRuntime(env)).toMatchObject({
    auth: { handler: "auth" },
    env,
  });
  expect(mocks.pool).toHaveBeenCalledWith({
    connectionString: env.DATABASE_URL,
    options: "-c search_path=auth",
    max: 5,
  });
  let options = mocks.auth.mock.calls[0]?.[0] as BetterAuthOptions;
  expect(options).toMatchObject({
    secret: expect.stringContaining("local-demo"),
    advanced: { useSecureCookies: false },
    emailAndPassword: { requireEmailVerification: true },
    logger: { disabled: true },
  });
  createAuthRuntime({
    ...env,
    APP_MODE: "production",
    AUTH_DATABASE_URL: "postgres://auth",
    AUTH_SECRET: "s".repeat(32),
  });
  options = mocks.auth.mock.calls[1]?.[0] as BetterAuthOptions;
  expect(options).toMatchObject({
    secret: "s".repeat(32),
    advanced: {
      useSecureCookies: true,
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "lax",
        secure: true,
      },
    },
  });
  expect(mocks.pool).toHaveBeenLastCalledWith(
    expect.objectContaining({ connectionString: "postgres://auth" }),
  );
});
test("auth callbacks deliver verification and reset links through the explicit email boundary", async () => {
  const { createAuthRuntime } = await import("../server/auth");
  const runtime = createAuthRuntime(env);
  const options = mocks.auth.mock.calls[0]?.[0] as BetterAuthOptions;
  const reset = options.emailAndPassword
    ?.sendResetPassword as unknown as (input: {
    user: { email: string };
    token: string;
  }) => Promise<void>;
  const verify = options.emailVerification
    ?.sendVerificationEmail as unknown as (input: {
    user: { email: string };
    url: string;
  }) => Promise<void>;
  await reset({ user: { email: "user@example.test" }, token: "token &?" });
  expect(mocks.email).toHaveBeenCalledWith(
    runtime.pool,
    env,
    expect.objectContaining({
      to: "user@example.test",
      url: "http://localhost:3100/auth?mode=confirm&token=token+%26%3F",
    }),
  );
  await verify({
    user: { email: "user@example.test" },
    url: "http://localhost/verify",
  });
  const change = options.user?.changeEmail
    ?.sendChangeEmailConfirmation as unknown as (input: {
    user: { email: string };
    url: string;
  }) => Promise<void>;
  await change({
    user: { email: "user@example.test" },
    url: "http://localhost/change",
  });
  expect(mocks.email).toHaveBeenCalledWith(
    runtime.pool,
    env,
    expect.objectContaining({
      to: "user@example.test",
      url: "http://localhost/change",
    }),
  );

  expect(mocks.email).toHaveBeenCalledWith(
    runtime.pool,
    env,
    expect.objectContaining({ url: "http://localhost/verify" }),
  );
});
test("auth singleton closes idempotently and can be recreated", async () => {
  const { getAuthRuntime, closeAuthRuntime } = await import("../server/auth");
  await closeAuthRuntime();
  expect(mocks.end).not.toHaveBeenCalled();
  const runtime = getAuthRuntime();
  expect(getAuthRuntime()).toBe(runtime);
  expect(mocks.env).toHaveBeenCalledOnce();
  await closeAuthRuntime();
  expect(mocks.end).toHaveBeenCalledOnce();
  expect(getAuthRuntime()).not.toBe(runtime);
  await closeAuthRuntime();
});

test("Google OAuth is enabled only with both credentials and passes secrets solely to server auth", async () => {
  const { createAuthRuntime } = await import("../server/auth");
  createAuthRuntime(env);
  expect(mocks.auth.mock.calls[0]?.[0].socialProviders).toEqual({});
  createAuthRuntime({ ...env, OAUTH_GOOGLE_CLIENT_ID: "client-id" });
  expect(mocks.auth.mock.calls[1]?.[0].socialProviders).toEqual({});
  createAuthRuntime({
    ...env,
    OAUTH_GOOGLE_CLIENT_ID: "client-id",
    OAUTH_GOOGLE_CLIENT_SECRET: "client-secret",
  });
  expect(mocks.auth.mock.calls[2]?.[0].socialProviders).toEqual({
    google: { clientId: "client-id", clientSecret: "client-secret" },
  });
});
