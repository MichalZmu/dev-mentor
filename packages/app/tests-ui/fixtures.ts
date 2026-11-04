import { vi } from "vitest";
import type {
  Booking,
  Mentor,
  UserProfile,
  AvailabilitySlot,
  Package,
  Case,
} from "@devmentor/core";
export const user: UserProfile = {
  id: "user-1",
  name: "Anna Testowa",
  email: "anna@example.test",
  timezone: "Europe/Warsaw",
  roles: ["mentee"],
  preferences: {},
  version: 1,
};
export const mentor: Mentor = {
  id: "mentor-1",
  userId: "mentor-user",
  name: "Jan Mentor",
  headline: "Praktyka TypeScript",
  bio: "Pomagam rozwijać kompetencje.",
  specialty: "Frontend",
  languages: ["pl", "en"],
  priceMinor: "25000",
  currency: "PLN",
  years: 8,
  rating: 4.8,
  status: "published",
  version: 1,
};
export const booking: Booking = {
  id: "booking-1",
  mentorId: mentor.id,
  menteeId: user.id,
  mentorUserId: mentor.userId,
  startsAt: "2026-12-10T10:00:00Z",
  endsAt: "2026-12-10T10:50:00Z",
  timezone: "Europe/Warsaw",
  state: "confirmed",
  expiresAt: "2026-12-01T10:15:00Z",
  amountMinor: "25000",
  currency: "PLN",
  feeMinor: "3750",
  paymentState: "paid",
  refundState: "none",
  checkoutUrl: null,
  checkoutId: null,
  version: 2,
  policyVersion: "2026-11-03",
  paymentMode: "psp",
};
export const slot: AvailabilitySlot = {
  id: "slot-1",
  mentorId: mentor.id,
  startsAt: booking.startsAt,
  endsAt: booking.endsAt,
  timezone: booking.timezone,
  available: true,
};
export const pack: Package = {
  id: "package-1",
  userId: user.id,
  mentorId: mentor.id,
  state: "active",
  credits: 3,
  expiresAt: "2027-02-01T00:00:00Z",
  autoRenew: false,
  version: 1,
  amountMinor: "100000",
  currency: "PLN",
  paymentState: "paid",
  checkoutUrl: null,
  checkoutId: null,
};
export const supportCase: Case = {
  id: "case-1",
  kind: "support",
  userId: user.id,
  status: "open",
  payload: {
    category: "payment",
    description: "Potrzebuję wyjaśnienia płatności.",
  },
  decisionReason: null,
  version: 1,
  createdAt: "2026-11-03T12:00:00Z",
};
export function mockApi(
  data: Record<string, unknown> = {},
): ReturnType<typeof vi.fn<typeof fetch>> {
  const fixtures: Record<string, unknown> = {
    "/config": { mode: "production", oauth: { google: false } },
    ...data,
  };
  const mocked = vi.fn<typeof fetch>(async (input, options) => {
    const path = String(input).replace(/^\/api\/v1/, "");
    const key =
      Object.keys(fixtures).find((key) => key === path) ??
      Object.keys(fixtures).find((key) => path.startsWith(key + "?"));
    const value = key === undefined ? null : fixtures[key];
    if (value instanceof Error) throw value;
    if (value instanceof Response) return value.clone();
    if (options?.method && options.method !== "GET")
      return Response.json({ data: value });
    return Response.json({ data: value });
  });
  vi.stubGlobal("fetch", mocked);
  return mocked;
}
export function jsonCalls(
  fetcher: ReturnType<typeof mockApi>,
): { path: string; method: string; body: unknown }[] {
  return fetcher.mock.calls
    .filter(([, options]) => options?.method && options.method !== "GET")
    .map(([path, options]) => ({
      path: String(path),
      method: options?.method ?? "GET",
      body: JSON.parse(String(options?.body)) as unknown,
    }));
}
