import { beforeEach, expect, test, vi } from "vitest";
import type { Pool } from "pg";
import { deliverEmail } from "../server/email";
import type { RuntimeEnvironment } from "../server/env";
const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  sendMail: vi.fn(),
  close: vi.fn(),
  createTransport: vi.fn(),
}));
vi.mock("nodemailer", () => ({
  default: { createTransport: mocks.createTransport },
}));
const pool = { query: mocks.query } as unknown as Pool;
const env = {
  APP_MODE: "demo",
  EMAIL_FROM: "from@example.test",
} as RuntimeEnvironment;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.createTransport.mockReturnValue({
    sendMail: mocks.sendMail,
    close: mocks.close,
  });
});
test("demo delivery writes a lowercased mailbox recipient and optional link", async () => {
  await deliverEmail(pool, env, {
    to: "A@Example.test",
    subject: "Verify",
    text: "Hello",
  });
  expect(mocks.query.mock.calls[0]?.[1]).toEqual([
    expect.any(String),
    "a@example.test",
    "Verify",
    "Hello",
    null,
  ]);
  await deliverEmail(pool, env, {
    to: "a@example.test",
    subject: "Verify",
    text: "Hello",
    url: "http://localhost/auth",
  });
  expect(mocks.query.mock.calls[1]?.[1]).toContain("http://localhost/auth");
  expect(mocks.createTransport).not.toHaveBeenCalled();
});
test("production requires SMTP and always closes its transport on success or rejection", async () => {
  await expect(
    deliverEmail(
      pool,
      { ...env, APP_MODE: "production" },
      { to: "a", subject: "s", text: "t" },
    ),
  ).rejects.toThrow("Email transport unavailable");
  const smtp = {
    ...env,
    APP_MODE: "production" as const,
    SMTP_URL: "smtp://localhost",
  };
  await deliverEmail(pool, smtp, { to: "a", subject: "s", text: "t" });
  expect(mocks.sendMail).toHaveBeenCalledWith({
    from: env.EMAIL_FROM,
    to: "a",
    subject: "s",
    text: "t",
  });
  expect(mocks.close).toHaveBeenCalledOnce();
  mocks.sendMail.mockRejectedValueOnce(new Error("offline"));
  await expect(
    deliverEmail(pool, smtp, { to: "a", subject: "s", text: "t" }),
  ).rejects.toThrow("offline");
  expect(mocks.close).toHaveBeenCalledTimes(2);
});
