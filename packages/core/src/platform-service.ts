import type {
  PlatformDependencies,
  PlatformRepository,
  Actor,
  HoldInput,
  CheckoutInput,
  Booking,
  Review,
  Message,
} from "./platform";
import {
  requireRole,
  requireParticipant,
  requireVersion,
  assertSlot,
  assertChangeable,
  assertMessage,
  assertReview,
  DomainError,
} from "./policies";

export type PlatformService = Omit<
  PlatformRepository,
  | "createHold"
  | "checkout"
  | "cancel"
  | "reschedule"
  | "complete"
  | "addReview"
  | "sendMessage"
> & {
  createHold(actor: Actor, input: HoldInput): Promise<Booking>;
  checkout(actor: Actor, input: CheckoutInput, key: string): Promise<Booking>;
  cancel(
    actor: Actor,
    id: string,
    reason: string,
    version: number,
    key: string,
  ): Promise<Booking>;
  reschedule(
    actor: Actor,
    id: string,
    slotId: string,
    version: number,
  ): Promise<Booking>;
  complete(actor: Actor, id: string): Promise<Booking>;
  addReview(
    actor: Actor,
    id: string,
    rating: number,
    comment: string,
  ): Promise<Review>;
  sendMessage(
    actor: Actor,
    id: string,
    text: string,
    clientMessageId: string,
  ): Promise<Message>;
};
/** Repository factories expose own methods; use cases own clocks and access policies. */
export function createPlatformService({
  repository,
  now,
  id,
}: PlatformDependencies): PlatformService {
  return {
    ...repository,
    async createHold(actor, input) {
      requireRole(actor, ["mentee"]);
      if (input.durationMinutes !== undefined && input.durationMinutes !== 50)
        throw new DomainError("INVALID_DURATION");
      const mentor = await repository.mentor(input.mentorId);
      if (mentor.userId === actor.id)
        throw new DomainError("OWN_MENTOR_BOOKING");
      return repository.createHold(actor, input, now().toISOString(), id());
    },
    async checkout(actor, input, key) {
      requireRole(actor, ["mentee"]);
      const current = await repository.booking(actor, input.holdId);
      if (current.menteeId !== actor.id)
        throw new DomainError("NOT_FOUND", 404);
      if (input.acceptedPolicyVersion !== current.policyVersion)
        throw new DomainError("POLICY_REQUIRED");
      return repository.checkout(actor, input, key, now().toISOString());
    },
    async cancel(actor, bookingId, reason, version, key) {
      const current = await repository.booking(actor, bookingId);
      requireParticipant(actor, current);
      // Idempotent replays are resolved atomically by the repository before state validation.
      if (current.state !== "cancelled") {
        requireVersion(current.version, version);
        assertChangeable(current, now());
      }
      if (reason.trim().length < 10 || reason.length > 500)
        throw new DomainError("INVALID_REASON");
      return repository.cancel(
        actor,
        bookingId,
        reason,
        version,
        key,
        now().toISOString(),
      );
    },
    async reschedule(actor, bookingId, slotId, version) {
      const current = await repository.booking(actor, bookingId);
      requireParticipant(actor, current);
      requireVersion(current.version, version);
      assertChangeable(current, now());
      const instant = now();
      const slots = await repository.availability(
        current.mentorId,
        instant.toISOString(),
        new Date(instant.getTime() + 31 * 86400000).toISOString(),
      );
      const slot = slots.find((value) => value.id === slotId);
      if (!slot) throw new DomainError("SLOT_TAKEN", 409);
      assertSlot(slot.startsAt, slot.endsAt, slot.timezone, now());
      return repository.reschedule(
        actor,
        bookingId,
        slotId,
        version,
        now().toISOString(),
      );
    },
    async complete(actor, bookingId) {
      const current = await repository.booking(actor, bookingId);
      if (current.mentorUserId !== actor.id)
        throw new DomainError("FORBIDDEN", 403);
      if (Date.parse(current.endsAt) > now().getTime())
        throw new DomainError("SESSION_NOT_ENDED");
      return repository.complete(actor, bookingId, now().toISOString());
    },
    async addReview(actor, bookingId, rating, comment) {
      const current = await repository.booking(actor, bookingId);
      if (current.menteeId !== actor.id)
        throw new DomainError("NOT_FOUND", 404);
      if (current.state !== "completed") throw new DomainError("NOT_COMPLETED");
      assertReview(rating, comment);
      return repository.addReview(
        actor,
        bookingId,
        rating,
        comment,
        now().toISOString(),
      );
    },
    sendMessage(actor, conversationId, text, clientMessageId) {
      assertMessage(text);
      return repository.sendMessage(
        actor,
        conversationId,
        text,
        clientMessageId,
        now().toISOString(),
      );
    },
  };
}
