import type {
  Actor,
  Booking,
  Money,
  Role,
  AvailabilityRule,
  CalendarException,
  SlotInput,
} from "./platform";

export class DomainError extends Error {
  constructor(
    public readonly code: string,
    public readonly status = 422,
  ) {
    super(code);
    this.name = "DomainError";
  }
}
export function requireRole(actor: Actor, roles: readonly Role[]): void {
  if (!roles.some((role) => actor.roles.includes(role)))
    throw new DomainError("FORBIDDEN", 403);
}
export function requireAdministrativeAccess(
  actor: Actor,
  roles: readonly Role[],
): void {
  requireRole(actor, roles);
  if (!actor.mfaVerified) throw new DomainError("MFA_REQUIRED", 403);
}
export function requireParticipant(
  actor: Actor,
  booking: Pick<Booking, "menteeId" | "mentorUserId">,
): void {
  if (actor.id !== booking.menteeId && actor.id !== booking.mentorUserId)
    throw new DomainError("NOT_FOUND", 404);
}
export function requireVersion(actual: number, expected: number): void {
  if (actual !== expected) throw new DomainError("STALE_VERSION", 409);
}
export function money(amountMinor: string, currency = "PLN"): Money {
  if (
    !/^\d+$/.test(amountMinor) ||
    BigInt(amountMinor) > 9223372036854775807n ||
    !/^[A-Z]{3}$/.test(currency)
  )
    throw new DomainError("INVALID_MONEY");
  return { amountMinor: BigInt(amountMinor).toString(), currency };
}
export function addMoney(left: Money, right: Money): Money {
  if (left.currency !== right.currency)
    throw new DomainError("CURRENCY_MISMATCH");
  return money(
    (BigInt(left.amountMinor) + BigInt(right.amountMinor)).toString(),
    left.currency,
  );
}
export function providerAmount(value: Money): number {
  const number = Number(value.amountMinor);
  if (!Number.isSafeInteger(number))
    throw new DomainError("AMOUNT_OUT_OF_RANGE");
  return number;
}
export function commission(amountMinor: string): string {
  return (
    (BigInt(money(amountMinor).amountMinor) * 15n + 50n) /
    100n
  ).toString();
}
export function assertSlot(
  startsAt: string,
  endsAt: string,
  timezone: string,
  now: Date,
): void {
  const start = Date.parse(startsAt);
  const end = Date.parse(endsAt);
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    end - start !== 50 * 60_000 ||
    start < now.getTime() + 24 * 60 * 60_000
  )
    throw new DomainError("INVALID_SLOT");
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone }).format(now);
  } catch {
    throw new DomainError("INVALID_TIMEZONE");
  }
}
export interface BookingPolicy {
  readonly cancellationCutoffHours: number;
}
export const bookingPolicies: Readonly<Record<string, BookingPolicy>> =
  Object.freeze({
    "2026-11-03": Object.freeze({ cancellationCutoffHours: 24 }),
  });
export const currentBookingPolicyVersion = "2026-11-03";
export function assertChangeable(
  booking: Booking,
  now: Date,
  policies: Readonly<Record<string, BookingPolicy>> = bookingPolicies,
): void {
  if (booking.state !== "confirmed")
    throw new DomainError("INVALID_BOOKING_STATE", 409);
  const policy = policies[booking.policyVersion];
  if (!policy) throw new DomainError("UNKNOWN_BOOKING_POLICY", 409);
  if (
    Date.parse(booking.startsAt) - now.getTime() <
    policy.cancellationCutoffHours * 60 * 60_000
  )
    throw new DomainError("CANCELLATION_CUTOFF");
}
/** A different idempotency key cannot change an accepted checkout funding source. */
export function assertPaymentMode(
  current: string | null,
  requested: string,
): void {
  if (requested !== "psp" && requested !== "credit")
    throw new DomainError("INVALID_PAYMENT_MODE");
  if (current !== null && current !== requested)
    throw new DomainError("PAYMENT_MODE_LOCKED", 409);
}
export function assertMessage(text: string): void {
  if (!text.trim() || text.length > 2000)
    throw new DomainError("INVALID_MESSAGE");
}
export function assertReview(rating: number, comment: string): void {
  if (
    !Number.isInteger(rating) ||
    rating < 1 ||
    rating > 5 ||
    comment.trim().length < 10 ||
    comment.length > 1000
  )
    throw new DomainError("INVALID_REVIEW");
}
/** Return every UTC candidate; zero means a DST gap and two a repeated local time. */
export function localTimeCandidates(local: string, timezone: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local))
    throw new DomainError("INVALID_LOCAL_TIME");
  const wanted = Date.parse(local + ":00Z");
  if (!Number.isFinite(wanted)) throw new DomainError("INVALID_LOCAL_TIME");
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat("sv-SE", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
  } catch {
    throw new DomainError("INVALID_TIMEZONE");
  }
  const result: string[] = [];
  // A bounded offset scan also supports zones with half/quarter-hour offsets.
  for (let offset = -14 * 60; offset <= 14 * 60; offset += 15) {
    const date = new Date(wanted + offset * 60_000);
    if (formatter.format(date).replace(" ", "T") === local)
      result.push(date.toISOString());
  }
  return result;
}

/** Expand local weekly rules without silently shifting gaps or choosing a repeated hour. */
export function expandAvailability(
  rules: readonly AvailabilityRule[],
  exceptions: readonly CalendarException[],
  from: string,
  to: string,
): SlotInput[] {
  const start = Date.parse(from);
  const end = Date.parse(to);
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    end <= start ||
    end - start > 31 * 86400000
  )
    throw new DomainError("INVALID_DATE_RANGE");
  const slots: SlotInput[] = [];
  for (
    let day = Math.floor(start / 86400000) - 1;
    day <= Math.floor(end / 86400000) + 1;
    day++
  ) {
    const date = new Date(day * 86400000);
    const localDate = date.toISOString().slice(0, 10);
    if (
      exceptions.some((item) => item.localDate === localDate && !item.available)
    )
      continue;
    for (const rule of rules) {
      if (
        !Number.isInteger(rule.weekday) ||
        rule.weekday < 0 ||
        rule.weekday > 6 ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(rule.localTime)
      )
        throw new DomainError("INVALID_AVAILABILITY_RULE");
      if (date.getUTCDay() !== rule.weekday) continue;
      const candidates = localTimeCandidates(
        localDate + "T" + rule.localTime,
        rule.timezone,
      );
      if (candidates.length === 0)
        throw new DomainError("NONEXISTENT_LOCAL_TIME");
      if (
        candidates.length > 1 &&
        (!rule.disambiguation || rule.disambiguation === "reject")
      )
        throw new DomainError("AMBIGUOUS_LOCAL_TIME");
      // The non-empty candidate invariant is established immediately above.
      const instant = (
        rule.disambiguation === "later"
          ? candidates[candidates.length - 1]
          : candidates[0]
      ) as string;
      const starts = Date.parse(instant);
      const ends = starts + 50 * 60000;
      if (starts >= start && ends <= end)
        slots.push({
          startsAt: instant,
          endsAt: new Date(ends).toISOString(),
          timezone: rule.timezone,
        });
    }
  }
  const sorted = slots.sort(
    (a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt),
  );
  for (let index = 1; index < sorted.length; index++)
    if (
      Date.parse((sorted[index - 1] as SlotInput).endsAt) >
      Date.parse((sorted[index] as SlotInput).startsAt)
    )
      throw new DomainError("OVERLAPPING_AVAILABILITY");
  return sorted;
}
