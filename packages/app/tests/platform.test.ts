import { beforeEach, expect, test, vi } from "vitest";
import type { PlatformRepository } from "@devmentor/core";
const mocks = vi.hoisted(() => ({
  runtime: vi.fn(),
  session: vi.fn(),
  query: vi.fn(),
  ensure: vi.fn(),
  actor: vi.fn(),
  db: vi.fn(),
  repository: vi.fn(),
  service: vi.fn(),
}));
vi.mock("../server/auth", () => ({ getAuthRuntime: mocks.runtime }));
vi.mock("../server/services", () => ({ withDatabaseServices: mocks.db }));
vi.mock("@devmentor/db", () => ({
  createPlatformRepository: mocks.repository,
}));
vi.mock("@devmentor/core", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  createPlatformService: mocks.service,
}));
import { authenticate, withPlatform } from "../server/platform";
const repository = {
  ensureUser: mocks.ensure,
  getActor: mocks.actor,
} as unknown as PlatformRepository;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.runtime.mockReturnValue({
    auth: { api: { getSession: mocks.session } },
    pool: { query: mocks.query },
    env: { APP_MODE: "production" },
  });
  mocks.session.mockResolvedValue({
    user: {
      id: "u",
      name: "User",
      email: "u@example.test",
      emailVerified: true,
    },
    session: { id: "session" },
  });
  mocks.query.mockResolvedValue({ rows: [{ present: true }] });
  mocks.actor.mockResolvedValue({
    id: "u",
    roles: ["mentee"],
    mfaVerified: true,
  });
});
test("authentication rejects missing/unverified sessions before accessing app data", async () => {
  mocks.session.mockResolvedValueOnce(null);
  await expect(
    authenticate(new Request("http://localhost"), repository),
  ).rejects.toMatchObject({ code: "UNAUTHENTICATED", status: 401 });
  mocks.session.mockResolvedValueOnce({ user: { emailVerified: false } });
  await expect(
    authenticate(new Request("http://localhost"), repository),
  ).rejects.toThrow("UNAUTHENTICATED");
  expect(mocks.ensure).not.toHaveBeenCalled();
});
test("authentication reads fresh roles and binds MFA proof to a session", async () => {
  const request = new Request("http://localhost", {
    headers: { cookie: "session=cookie" },
  });
  expect(await authenticate(request, repository)).toMatchObject({ id: "u" });
  expect(mocks.session).toHaveBeenCalledWith({
    headers: request.headers,
    query: { disableCookieCache: true },
  });
  expect(mocks.ensure).toHaveBeenCalledWith({
    id: "u",
    name: "User",
    email: "u@example.test",
  });
  expect(mocks.query).toHaveBeenCalledWith(
    expect.stringContaining("auth.mfa_session"),
    ["session"],
  );
  expect(mocks.actor).toHaveBeenLastCalledWith("u", true);
  mocks.query.mockResolvedValueOnce({ rows: [{ present: false }] });
  await authenticate(request, repository);
  expect(mocks.actor).toHaveBeenLastCalledWith("u", false);
  mocks.query.mockResolvedValueOnce({ rows: [] });
  await authenticate(request, repository);
  expect(mocks.actor).toHaveBeenLastCalledWith("u", false);
  mocks.runtime.mockReturnValue({
    auth: { api: { getSession: mocks.session } },
    pool: { query: mocks.query },
    env: { APP_MODE: "demo" },
  });
  await authenticate(request, repository);
  expect(mocks.actor).toHaveBeenLastCalledWith("u", true);
});
test("platform composition passes a scoped repository and explicit clock/id dependencies", async () => {
  const entityManager = { name: "scoped" };
  const service = { name: "service" };
  mocks.db.mockImplementation((callback: (value: unknown) => unknown) =>
    callback({ entityManager }),
  );
  mocks.repository.mockReturnValue(repository);
  mocks.service.mockReturnValue(service);
  const result = await withPlatform(async (value, repo) => {
    expect(value).toBe(service);
    expect(repo).toBe(repository);
    return "result";
  });
  expect(result).toBe("result");
  expect(mocks.repository).toHaveBeenCalledWith(entityManager);
  const deps = mocks.service.mock.calls[0]?.[0] as {
    now: () => Date;
    id: () => string;
    repository: unknown;
  };
  expect(deps.repository).toBe(repository);
  expect(deps.now()).toBeInstanceOf(Date);
  expect(deps.id()).toMatch(/^[a-f0-9-]{36}$/);
});
