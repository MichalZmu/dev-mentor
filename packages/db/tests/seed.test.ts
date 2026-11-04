import { afterEach, expect, test, vi } from "vitest";
import type { EntityManager } from "@mikro-orm/postgresql";
import { localTimeCandidates } from "@devmentor/core";
import type * as Core from "@devmentor/core";
import { seedDemoPlatform } from "../src/seed";

const repository = vi.hoisted(() => ({
  ensureUser: vi.fn(),
  saveGoals: vi.fn(),
  conversation: vi.fn(),
}));
vi.mock("../src/platform-repository", () => ({
  createPlatformRepository: () => repository,
}));
vi.mock("@devmentor/core", async (importOriginal) => ({
  ...(await importOriginal<typeof Core>()),
  localTimeCandidates: vi.fn(),
}));
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});
test("demo seeding bootstraps trusted roles, future availability and an explicitly paid historical session", async () => {
  vi.useFakeTimers();
  vi.setSystemTime("2026-11-03T10:00:00Z");
  const resolveTime = vi.mocked(localTimeCandidates);
  resolveTime.mockReturnValue(["2026-11-05T09:00:00.000Z"]);
  resolveTime.mockReturnValueOnce([]); // DST gaps produce no synthetic slot.
  const execute = vi.fn().mockResolvedValue([]);
  const manager = {
    getConnection: () => ({ execute }),
    getTransactionContext: () => "transaction",
  };
  const em = {
    transactional: (fn: (em: unknown) => unknown) => fn(manager),
  } as unknown as EntityManager;
  const identities = {
    menteeId: "mentee",
    mentorId: "mentor",
    adminId: "admin",
  };
  await expect(seedDemoPlatform(em, identities)).resolves.toEqual({
    mentorId: "demo-mentor",
    bookingId: "demo-completed-session",
    seeded: true,
  });
  expect(
    repository.ensureUser.mock.calls.map((call) => call[0]?.roles),
  ).toEqual([
    ["mentee"],
    ["mentee", "mentor"],
    ["mentee", "admin", "moderator", "support"],
  ]);
  expect(resolveTime).toHaveBeenCalledTimes(58);
  const slots = execute.mock.calls.filter((call) =>
    String(call[0]).startsWith("insert into availability_slots"),
  );
  expect(slots).toHaveLength(57);
  expect(slots[0]?.[1]?.slice(2)).toEqual([
    "2026-11-05T09:00:00.000Z",
    "2026-11-05T09:50:00.000Z",
    "Europe/Warsaw",
  ]);
  expect(repository.saveGoals).toHaveBeenCalledWith(
    expect.objectContaining({ id: "mentee", roles: ["mentee"] }),
    expect.objectContaining({ goal: "career" }),
  );
  expect(repository.conversation).toHaveBeenCalledWith(
    expect.objectContaining({ id: "mentee" }),
    "demo-mentor",
  );
});

test.each([true, false])(
  "completed=%s seed checks the database marker under its transaction",
  async (completed) => {
    const execute = vi.fn().mockImplementation((sql: string) => {
      if (sql.startsWith("select completed_at")) return [{ completed }];
      if (sql.startsWith("select id from domain_users"))
        return [{ id: "mentee" }, { id: "mentor" }, { id: "admin" }];
      if (sql.startsWith("select (goals")) return [{ initialized: true }];
      return [];
    });
    vi.useFakeTimers();
    vi.setSystemTime("2027-01-01T10:00:00Z");
    const context = {};
    const manager = {
      getConnection: () => ({ execute }),
      getTransactionContext: () => context,
    };
    const em = {
      transactional: (fn: (em: unknown) => unknown) => fn(manager),
    } as unknown as EntityManager;
    vi.mocked(localTimeCandidates).mockReturnValue([]);
    const result = await seedDemoPlatform(em, {
      menteeId: "mentee",
      mentorId: "mentor",
      adminId: "admin",
    });
    expect(result.seeded).toBe(!completed);
    if (completed) expect(localTimeCandidates).not.toHaveBeenCalled();
    expect(repository.ensureUser).not.toHaveBeenCalled();
    expect(repository.saveGoals).not.toHaveBeenCalled();
    expect(repository.conversation).toHaveBeenCalledTimes(completed ? 0 : 1);
    expect(execute.mock.calls.every((call) => call[3] === context)).toBe(true);
    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining("for update"),
      [],
      "all",
      context,
    );
  },
);
test("an explicit incomplete marker and empty goals resume seed work", async () => {
  const execute = vi.fn().mockImplementation((sql: string) => {
    if (sql.startsWith("select completed_at")) return [{ completed: false }];
    if (sql.startsWith("select (goals")) return [{ initialized: false }];
    return [];
  });
  const manager = {
    getConnection: () => ({ execute }),
    getTransactionContext: () => undefined,
  };
  const em = {
    transactional: (fn: (em: unknown) => unknown) => fn(manager),
  } as unknown as EntityManager;
  await seedDemoPlatform(em, { menteeId: "m", mentorId: "t", adminId: "a" });
  expect(repository.ensureUser).toHaveBeenCalledTimes(3);
  expect(repository.saveGoals).toHaveBeenCalledOnce();
});
