import { beforeEach, expect, test, vi } from "vitest";
import { createHash } from "node:crypto";
const mocks = vi.hoisted(() => ({
  runtime: vi.fn(),
  handler: vi.fn(),
  session: vi.fn(),
  query: vi.fn(),
  authenticate: vi.fn(),
  platform: vi.fn(),
  profile: vi.fn(),
}));
vi.mock("../server/auth", () => ({ getAuthRuntime: mocks.runtime }));
vi.mock("../server/platform", () => ({
  authenticate: mocks.authenticate,
  withPlatform: mocks.platform,
}));
import {
  demoMailbox,
  handleAuthWrapper,
  handleNativeAuth,
} from "../server/auth-http";
const origin = "http://localhost:3100";
const owner = "a".repeat(64);
const env = { APP_MODE: "demo", APP_URL: origin };
function request(
  path: string,
  body: unknown = {},
  headers: HeadersInit = {},
  method = "POST",
): Request {
  return new Request(origin + "/api/auth/" + path, {
    method,
    headers: { origin, "content-type": "application/json", ...headers },
    ...(method === "GET" ? {} : { body: JSON.stringify(body) }),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.runtime.mockReturnValue({
    env: { ...env },
    auth: { handler: mocks.handler, api: { getSession: mocks.session } },
    pool: { query: mocks.query },
  });
  mocks.handler.mockImplementation(async () =>
    Response.json({ success: true }),
  );
  mocks.session.mockResolvedValue({ session: { id: "session_1" } });
  mocks.authenticate.mockResolvedValue({ id: "u" });
  mocks.profile.mockResolvedValue({ id: "u", name: "User" });
  mocks.platform.mockImplementation(
    (callback: (service: unknown, repository: unknown) => unknown) =>
      callback({ profile: mocks.profile }, {}),
  );
  mocks.query.mockResolvedValue({ rows: [{ id: "mail", subject: "Verify" }] });
});
test("native auth enforces origin, blocks raw registration, translates infrastructure errors", async () => {
  expect(
    (await handleNativeAuth(request("session", {}, {}, "GET"))).status,
  ).toBe(200);
  expect(
    (
      await handleNativeAuth(
        request("session", {}, { origin: "http://evil.test" }),
      )
    ).status,
  ).toBe(403);
  expect((await handleNativeAuth(request("sign-up/email"))).status).toBe(400);
  mocks.handler.mockResolvedValueOnce(new Response("secret", { status: 500 }));
  const failure = await handleNativeAuth(request("session"));
  expect(failure.status).toBe(503);
  expect(await failure.text()).not.toContain("secret");
  mocks.handler.mockRejectedValueOnce(new Error("offline"));
  expect((await handleNativeAuth(request("session"))).status).toBe(503);
  const valid = await handleNativeAuth(request("session"));
  expect(valid.headers.get("cache-control")).toBe("no-store");
});
test("native MFA verifies the returned session using merged cookies and stores session proof", async () => {
  mocks.handler.mockImplementation(
    async () =>
      new Response("{}", {
        headers: { "set-cookie": "session=new; HttpOnly" },
      }),
  );
  await handleNativeAuth(
    request(
      "two-factor/verify-totp",
      {},
      { cookie: "junk; session=old; other=kept" },
    ),
  );
  const headers = mocks.session.mock.calls[0]?.[0].headers as Headers;
  expect(headers.get("cookie")).toBe("session=new; other=kept");
  expect(mocks.query).toHaveBeenCalledWith(
    expect.stringContaining("insert into auth.mfa_session"),
    ["session_1"],
  );
  mocks.session.mockResolvedValueOnce(null);
  await handleNativeAuth(request("two-factor/verify-otp"));
  expect(mocks.query).toHaveBeenCalledOnce();
  mocks.handler.mockImplementationOnce(
    async () => new Response("{}", { status: 400 }),
  );
  await handleNativeAuth(request("two-factor/verify-backup-code"));
  expect(mocks.session).toHaveBeenCalledTimes(2);
  mocks.handler.mockImplementationOnce(
    async () => new Response("{}", { headers: { "set-cookie": "malformed" } }),
  );
  await handleNativeAuth(request("two-factor/verify-backup-code"));
  expect(mocks.query).toHaveBeenCalledTimes(2);
});
test("demo registration allocates an opaque private mailbox owner and reuses existing owner", async () => {
  const input = {
    email: "user@example.test",
    password: "long-password!",
    name: " User ",
    termsVersion: "2026",
  };
  const result = await handleAuthWrapper(
    request("register", input),
    "register",
  );
  expect(result.status).toBe(201);
  expect(await result.json()).toMatchObject({
    data: { emailVerificationRequired: true, demoMailboxAvailable: true },
  });
  expect(result.headers.getSetCookie()).toEqual([
    expect.stringMatching(
      /devmentor_demo_mailbox=[a-f0-9]{64}; HttpOnly; SameSite=Strict/,
    ),
  ]);
  const native = mocks.handler.mock.calls[0]?.[0] as Request;
  expect(native.url).toBe(origin + "/api/auth/sign-up/email");
  expect(await native.json()).toEqual({
    email: input.email,
    password: input.password,
    name: "User",
    callbackURL: "/auth",
  });
  await handleAuthWrapper(
    request("register", input, { cookie: "devmentor_demo_mailbox=" + owner }),
    "register",
  );
  expect(mocks.query.mock.calls[1]?.[1]).toEqual([
    input.email,
    createHash("sha256").update(owner).digest("hex"),
  ]);
  mocks.runtime.mockReturnValue({
    env: { ...env, APP_MODE: "production" },
    auth: { handler: mocks.handler },
    pool: { query: mocks.query },
  });
  const production = await handleAuthWrapper(
    request("register", input),
    "register",
  );
  expect((await production.json()).data.demoMailboxAvailable).toBe(false);
  expect(production.headers.getSetCookie()).toEqual([]);
  expect(mocks.query).toHaveBeenCalledTimes(2);
});
test("login returns fresh profile or MFA redirect and carries auth cookies", async () => {
  const input = { email: "u@example.test", password: "password" };
  mocks.handler.mockImplementationOnce(async () =>
    Response.json(
      { twoFactorRedirect: true },
      { headers: { "set-cookie": "session=new; HttpOnly" } },
    ),
  );
  const mfa = await handleAuthWrapper(request("login", input), "login");
  expect(await mfa.json()).toEqual({ data: { twoFactorRedirect: true } });
  expect(mfa.headers.getSetCookie()).toEqual(["session=new; HttpOnly"]);
  for (const value of [{}, null, "string", { twoFactorRedirect: false }]) {
    mocks.handler.mockImplementationOnce(async () => Response.json(value));
    const result = await handleAuthWrapper(
      request("login", input, { cookie: "session=old; invalid" }),
      "login",
    );
    expect(await result.json()).toEqual({
      data: { user: { id: "u", name: "User" } },
    });
  }
  mocks.handler.mockImplementationOnce(async () => new Response("not json"));
  expect(
    (await handleAuthWrapper(request("login", input), "login")).status,
  ).toBe(200);
  expect(mocks.authenticate).toHaveBeenCalledTimes(5);
});
test("password reset keeps account existence private, confirm/logout use native endpoints", async () => {
  const reset = await handleAuthWrapper(
    request("password-reset", { email: "u@example.test" }),
    "password-reset",
  );
  expect(reset.status).toBe(202);
  expect(mocks.handler.mock.calls[0]?.[0].url).toBe(
    origin + "/api/auth/request-password-reset",
  );
  mocks.handler.mockResolvedValueOnce(new Response("bad", { status: 400 }));
  expect(
    (
      await handleAuthWrapper(
        request("password-reset", { email: "missing@example.test" }),
        "password-reset",
      )
    ).status,
  ).toBe(202);
  const confirm = await handleAuthWrapper(
    request("password-reset/confirm", {
      token: "token",
      newPassword: "long-password!",
    }),
    "password-reset/confirm",
  );
  expect(await confirm.json()).toEqual({ data: { success: true } });
  expect(mocks.handler.mock.calls[2]?.[0].url).toBe(
    origin + "/api/auth/reset-password",
  );
  const logout = await handleAuthWrapper(request("logout"), "logout");
  expect(logout.status).toBe(204);
  expect(mocks.handler.mock.calls[3]?.[0].url).toBe(
    origin + "/api/auth/sign-out",
  );
});
test("wrappers reject unknown paths, invalid fields, rate limits and provider failures", async () => {
  await expect(
    handleAuthWrapper(request("missing"), "missing"),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  await expect(
    handleAuthWrapper(
      request("login", { email: "bad", password: "" }),
      "login",
    ),
  ).rejects.toThrow();
  for (const [path, input, status, code, resultStatus] of [
    ["password-reset", { email: "u@example.test" }, 429, "RATE_LIMITED", 429],
    [
      "login",
      { email: "u@example.test", password: "password" },
      429,
      "RATE_LIMITED",
      429,
    ],
    [
      "login",
      { email: "u@example.test", password: "password" },
      400,
      "INVALID_CREDENTIALS_OR_EMAIL_UNVERIFIED",
      401,
    ],
    ["logout", {}, 400, "AUTH_REQUEST_REJECTED", 422],
    ["logout", {}, 429, "RATE_LIMITED", 429],
  ] as const) {
    mocks.handler.mockResolvedValueOnce(new Response("bad", { status }));
    await expect(
      handleAuthWrapper(request(path, input), path),
    ).rejects.toMatchObject({ code, status: resultStatus });
  }
  mocks.handler.mockResolvedValueOnce(new Response("secret", { status: 503 }));
  await expect(handleAuthWrapper(request("logout"), "logout")).rejects.toThrow(
    "Authentication transport unavailable",
  );
});
test("demo mailbox is loopback-only and queries only the hashed opaque owner", async () => {
  expect(
    await (await demoMailbox(request("mailbox", {}, {}, "GET"))).json(),
  ).toEqual({ data: [] });
  expect(
    await (
      await demoMailbox(
        request(
          "mailbox",
          {},
          { cookie: "other=1; devmentor_demo_mailbox=" + owner + "; x=1" },
          "GET",
        ),
      )
    ).json(),
  ).toMatchObject({ data: [{ id: "mail" }] });
  expect(mocks.query).toHaveBeenLastCalledWith(
    expect.stringContaining("where owner_hash=$1"),
    [createHash("sha256").update(owner).digest("hex")],
  );
  await expect(
    demoMailbox(new Request("http://external.example/api")),
  ).rejects.toThrow("NOT_FOUND");
  mocks.runtime.mockReturnValue({
    env: { ...env, APP_MODE: "production" },
    pool: { query: mocks.query },
  });
  await expect(demoMailbox(request("mailbox", {}, {}, "GET"))).rejects.toThrow(
    "NOT_FOUND",
  );
});

test("blocked native registration does not execute the account-creating auth handler", async () => {
  const result = await handleNativeAuth(
    request("sign-up/email", {
      email: "u@example.test",
      password: "long-password!",
    }),
  );
  expect(result.status).toBe(400);
  expect(mocks.handler).not.toHaveBeenCalled();
});

test("demo email changes bind the new mailbox to the current owner without consuming the auth body", async () => {
  const input = { newEmail: "New@Example.test", callbackURL: "/auth" };
  mocks.handler.mockImplementationOnce(async (native: Request) => {
    expect(await native.json()).toEqual(input);
    return Response.json({ success: true });
  });
  const result = await handleNativeAuth(
    request("change-email", input, {
      cookie: "devmentor_demo_mailbox=" + owner,
    }),
  );
  expect(result.status).toBe(200);
  expect(mocks.query).toHaveBeenCalledWith(
    expect.stringContaining("auth.demo_mailbox_owner"),
    [input.newEmail, createHash("sha256").update(owner).digest("hex")],
  );
  expect(mocks.session).toHaveBeenCalledWith({ headers: expect.any(Headers) });
});
test("email change mailbox binding requires both a session and owner and remains demo-only", async () => {
  mocks.session.mockResolvedValueOnce(null);
  expect(
    (
      await handleNativeAuth(
        request(
          "change-email",
          { newEmail: "new@example.test" },
          { cookie: "devmentor_demo_mailbox=" + owner },
        ),
      )
    ).status,
  ).toBe(200);
  expect(
    (
      await handleNativeAuth(
        request("change-email", { newEmail: "new@example.test" }),
      )
    ).status,
  ).toBe(200);
  expect(mocks.query).not.toHaveBeenCalled();
  mocks.runtime.mockReturnValueOnce({
    env: { ...env, APP_MODE: "production" },
    auth: { handler: mocks.handler, api: { getSession: mocks.session } },
    pool: { query: mocks.query },
  });
  expect(
    (
      await handleNativeAuth(
        request(
          "change-email",
          { newEmail: "new@example.test" },
          { cookie: "devmentor_demo_mailbox=" + owner },
        ),
      )
    ).status,
  ).toBe(200);
  expect(mocks.session).toHaveBeenCalledTimes(2);
  expect(mocks.query).not.toHaveBeenCalled();
});

test("mailbox validates transport Host independently of the Next bind URL and ignores forwarded host", async () => {
  for (const host of [
    "localhost",
    "LOCALHOST:3100",
    "127.0.0.1:3100",
    "[::1]:3100",
  ]) {
    const result = await demoMailbox(
      new Request("http://0.0.0.0:3100/api/v1/demo/mailbox", {
        headers: {
          host,
          cookie: "devmentor_demo_mailbox=" + owner,
          "x-forwarded-host": "untrusted.example",
        },
      }),
    );
    expect(result.status).toBe(200);
    expect(await result.json()).toMatchObject({ data: [{ id: "mail" }] });
  }
  expect(mocks.query).toHaveBeenCalledTimes(4);
  for (const host of [
    "",
    "0.0.0.0:3100",
    "public.example",
    "localhost.evil.test",
    "public.example@localhost",
    "localhost/path",
    "localhost,public.example",
    "localhost:3100:1",
  ]) {
    await expect(
      demoMailbox(
        new Request(origin + "/api/v1/demo/mailbox", {
          headers: {
            host,
            "x-forwarded-host": "localhost:3100",
            cookie: "devmentor_demo_mailbox=" + owner,
          },
        }),
      ),
    ).rejects.toThrow("NOT_FOUND");
  }
  await expect(
    demoMailbox(
      new Request("http://0.0.0.0:3100/api/v1/demo/mailbox", {
        headers: { "x-forwarded-host": "localhost:3100" },
      }),
    ),
  ).rejects.toThrow("NOT_FOUND");
  const empty = await demoMailbox(
    new Request("http://0.0.0.0:3100/api/v1/demo/mailbox", {
      headers: { host: "localhost:3100" },
    }),
  );
  expect(await empty.json()).toEqual({ data: [] });
  expect(mocks.query).toHaveBeenCalledTimes(4);
});
