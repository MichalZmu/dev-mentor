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
  const em = { getConnection: () => ({ execute }) } as unknown as EntityManager;
  const identities = {
    menteeId: "mentee",
    mentorId: "mentor",
    adminId: "admin",
  };
  await expect(seedDemoPlatform(em, identities)).resolves.toEqual({
    mentorId: "demo-mentor",
    bookingId: "demo-completed-session",
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
