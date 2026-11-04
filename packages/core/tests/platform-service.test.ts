import { beforeEach, expect, test, vi } from "vitest";
import { createPlatformService } from "../src/platform-service";
import type {
  Actor,
  AvailabilitySlot,
  Booking,
  Mentor,
  PlatformRepository,
} from "../src/platform";

const now = new Date("2026-11-03T10:00:00Z");
const actor: Actor = { id: "mentee", roles: ["mentee"], mfaVerified: false };
const mentorActor: Actor = {
  id: "mentor-user",
  roles: ["mentor"],
  mfaVerified: false,
};
const slot: AvailabilitySlot = {
  id: "slot",
  mentorId: "mentor",
  startsAt: "2026-11-05T10:00:00Z",
  endsAt: "2026-11-05T10:50:00Z",
  timezone: "Europe/Warsaw",
  available: true,
};
const booking: Booking = {
  id: "booking",
  mentorId: "mentor",
  menteeId: "mentee",
  mentorUserId: "mentor-user",
  startsAt: slot.startsAt,
  endsAt: slot.endsAt,
  timezone: slot.timezone,
  state: "confirmed",
  expiresAt: "2026-11-03T10:15:00Z",
  amountMinor: "18000",
  currency: "PLN",
  feeMinor: "2700",
  paymentState: "paid",
  refundState: "none",
  checkoutUrl: null,
  checkoutId: null,
  version: 3,
  policyVersion: "2026-11-03",
  paymentMode: "psp",
};
const mentor = { id: "mentor", userId: "mentor-user" } as Mentor;
const repository = {
  mentor: vi.fn(),
  booking: vi.fn(),
  availability: vi.fn(),
  createHold: vi.fn(),
  checkout: vi.fn(),
  cancel: vi.fn(),
  reschedule: vi.fn(),
  complete: vi.fn(),
  addReview: vi.fn(),
  sendMessage: vi.fn(),
  goals: vi.fn(),
};
const service = createPlatformService({
  repository: repository as unknown as PlatformRepository,
  now: () => now,
  id: () => "hold-id",
});
beforeEach(() => {
  vi.resetAllMocks();
  repository.mentor.mockResolvedValue(mentor);
  repository.booking.mockResolvedValue(booking);
  repository.availability.mockResolvedValue([slot]);
  for (const fn of [
    repository.createHold,
    repository.checkout,
    repository.cancel,
    repository.reschedule,
    repository.complete,
  ])
    fn.mockResolvedValue(booking);
});
test("holds enforce role, duration and mentor ownership before persistence", async () => {
  const input = { mentorId: "mentor", slotId: "slot" };
  await expect(service.createHold(actor, input)).resolves.toBe(booking);
  expect(repository.createHold).toHaveBeenCalledWith(
    actor,
    input,
    now.toISOString(),
    "hold-id",
  );
  await service.createHold(actor, { ...input, durationMinutes: 50 });
  await expect(service.createHold(mentorActor, input)).rejects.toThrow(
    "FORBIDDEN",
  );
  await expect(
    service.createHold(actor, { ...input, durationMinutes: 60 }),
  ).rejects.toThrow("INVALID_DURATION");
  repository.mentor.mockResolvedValue({ ...mentor, userId: actor.id });
  await expect(service.createHold(actor, input)).rejects.toThrow(
    "OWN_MENTOR_BOOKING",
  );
});
test("checkout checks owner and policy and forwards a stable clock and idempotency key", async () => {
  const input = {
    holdId: "booking",
    paymentMode: "psp" as const,
    acceptedPolicyVersion: "2026-11-03",
  };
  await expect(service.checkout(actor, input, "checkout-key")).resolves.toBe(
    booking,
  );
  expect(repository.checkout).toHaveBeenCalledWith(
    actor,
    input,
    "checkout-key",
    now.toISOString(),
  );
  await expect(
    service.checkout(actor, { ...input, acceptedPolicyVersion: "old" }, "key"),
  ).rejects.toThrow("POLICY_REQUIRED");
  repository.booking.mockResolvedValue({ ...booking, menteeId: "different" });
  await expect(service.checkout(actor, input, "key")).rejects.toThrow(
    "NOT_FOUND",
  );
});
test("cancellation validates membership, version, state, cutoff and reason", async () => {
  const reason = "A valid cancellation reason";
  await expect(
    service.cancel(actor, booking.id, reason, 3, "cancel-key"),
  ).resolves.toBe(booking);
  expect(repository.cancel).toHaveBeenCalledWith(
    actor,
    booking.id,
    reason,
    3,
    "cancel-key",
    now.toISOString(),
  );
  await expect(
    service.cancel(actor, booking.id, reason, 2, "key"),
  ).rejects.toThrow("STALE_VERSION");
  await expect(
    service.cancel(actor, booking.id, "short", 3, "key"),
  ).rejects.toThrow("INVALID_REASON");
  await expect(
    service.cancel(actor, booking.id, "x".repeat(501), 3, "key"),
  ).rejects.toThrow("INVALID_REASON");
  repository.booking.mockResolvedValue({ ...booking, state: "cancelled" });
  await service.cancel(actor, booking.id, reason, 1, "cancel-key");
  repository.booking.mockResolvedValue({
    ...booking,
    menteeId: "stranger",
    mentorUserId: "other",
  });
  await expect(
    service.cancel(actor, booking.id, reason, 3, "key"),
  ).rejects.toThrow("NOT_FOUND");
});
test("rescheduling selects the requested valid slot and rejects taken or invalid slots", async () => {
  repository.availability.mockResolvedValue([{ ...slot, id: "other" }, slot]);
  await expect(service.reschedule(actor, booking.id, "slot", 3)).resolves.toBe(
    booking,
  );
  expect(repository.availability).toHaveBeenCalledWith(
    "mentor",
    now.toISOString(),
    "2026-12-04T10:00:00.000Z",
  );
  expect(repository.reschedule).toHaveBeenCalledWith(
    actor,
    booking.id,
    "slot",
    3,
    now.toISOString(),
  );
  await expect(
    service.reschedule(actor, booking.id, "missing", 3),
  ).rejects.toThrow("SLOT_TAKEN");
  repository.availability.mockResolvedValue([{ ...slot, startsAt: "bad" }]);
  await expect(
    service.reschedule(actor, booking.id, "slot", 3),
  ).rejects.toThrow("INVALID_SLOT");
});
test("only the mentor can complete an ended session", async () => {
  await expect(service.complete(actor, booking.id)).rejects.toThrow(
    "FORBIDDEN",
  );
  await expect(service.complete(mentorActor, booking.id)).rejects.toThrow(
    "SESSION_NOT_ENDED",
  );
  repository.booking.mockResolvedValue({
    ...booking,
    endsAt: now.toISOString(),
  });
  await expect(service.complete(mentorActor, booking.id)).resolves.toBe(
    booking,
  );
  expect(repository.complete).toHaveBeenCalledWith(
    mentorActor,
    booking.id,
    now.toISOString(),
  );
});
test("only a completed session's mentee can leave a valid review", async () => {
  await expect(
    service.addReview(mentorActor, booking.id, 5, "Great mentoring"),
  ).rejects.toThrow("NOT_FOUND");
  await expect(
    service.addReview(actor, booking.id, 5, "Great mentoring"),
  ).rejects.toThrow("NOT_COMPLETED");
  repository.booking.mockResolvedValue({ ...booking, state: "completed" });
  await expect(
    service.addReview(actor, booking.id, 6, "Great mentoring"),
  ).rejects.toThrow("INVALID_REVIEW");
  repository.addReview.mockResolvedValue({ id: "review" });
  await expect(
    service.addReview(actor, booking.id, 5, "Great mentoring"),
  ).resolves.toEqual({ id: "review" });
  expect(repository.addReview).toHaveBeenCalledWith(
    actor,
    booking.id,
    5,
    "Great mentoring",
    now.toISOString(),
  );
});
test("message policy runs before persistence and unrelated repository methods stay available", async () => {
  expect(() => service.sendMessage(actor, "thread", " ", "client-id")).toThrow(
    "INVALID_MESSAGE",
  );
  repository.sendMessage.mockResolvedValue({ id: "message" });
  await expect(
    service.sendMessage(actor, "thread", "Hello", "client-id"),
  ).resolves.toEqual({ id: "message" });
  expect(repository.sendMessage).toHaveBeenCalledWith(
    actor,
    "thread",
    "Hello",
    "client-id",
    now.toISOString(),
  );
  expect(service.goals).toBe(repository.goals);
});
