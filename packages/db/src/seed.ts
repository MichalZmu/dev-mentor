import type { EntityManager } from "@mikro-orm/postgresql";
import { localTimeCandidates } from "@devmentor/core";
import { createPlatformRepository } from "./platform-repository";

export interface DemoIdentities {
  menteeId: string;
  mentorId: string;
  adminId: string;
}
/** Explicit local demo bootstrap, after auth identities and schema migrations exist. */
export async function seedDemoPlatform(
  em: EntityManager,
  identities: DemoIdentities,
): Promise<{ mentorId: string; bookingId: string }> {
  const repo = createPlatformRepository(em);
  await repo.ensureUser({
    id: identities.menteeId,
    name: "Aleksandra Nowak",
    email: "demo@example.test",
    roles: ["mentee"],
  });
  await repo.ensureUser({
    id: identities.mentorId,
    name: "Anna Kowalska",
    email: "mentor@example.test",
    roles: ["mentee", "mentor"],
  });
  await repo.ensureUser({
    id: identities.adminId,
    name: "Administrator Demo",
    email: "admin@example.test",
    roles: ["mentee", "admin", "moderator", "support"],
  });
  const connection = em.getConnection();
  const mentorId = "demo-mentor";
  const bookingId = "demo-completed-session";
  await connection.execute(
    "insert into mentor_profiles(id,user_id,headline,bio,specialty,languages,price_minor,years,status) values(?,?,?,?,'frontend','[\"pl\",\"en\"]',18000,8,'published') on conflict(id) do nothing",
    [
      mentorId,
      identities.mentorId,
      "Frontend z dobrym planem rozwoju",
      "Pomagam przejść od nauki React i TypeScript do świadomego tworzenia dostępnych aplikacji. Pracujemy na konkretnych celach i przykładach z Twojego projektu.",
    ],
  );
  const now = new Date();
  for (let day = 2; day <= 30; day++)
    for (const hour of ["10:00", "14:00"]) {
      const date = new Date(now.getTime() + day * 86400000)
        .toISOString()
        .slice(0, 10);
      const startsAt = localTimeCandidates(
        date + "T" + hour,
        "Europe/Warsaw",
      )[0];
      if (!startsAt) continue;
      await connection.execute(
        "insert into availability_slots(id,mentor_id,starts_at,ends_at,timezone) values(?,?,?,?,?) on conflict(mentor_id,starts_at) do nothing",
        [
          "demo-slot-" + date + "-" + hour,
          mentorId,
          startsAt,
          new Date(Date.parse(startsAt) + 50 * 60000).toISOString(),
          "Europe/Warsaw",
        ],
      );
    }
  const startsAt = new Date(now.getTime() - 10 * 86400000).toISOString();
  const endsAt = new Date(Date.parse(startsAt) + 50 * 60000).toISOString();
  await connection.execute(
    "insert into bookings(id,mentor_id,mentee_id,starts_at,ends_at,timezone,state,expires_at,amount_minor,fee_minor,currency,policy_version,created_at) values(?,?,?,?,?,'Europe/Warsaw','completed',?,18000,2700,'PLN','2026-11-03',?) on conflict(id) do nothing",
    [
      bookingId,
      mentorId,
      identities.menteeId,
      startsAt,
      endsAt,
      startsAt,
      startsAt,
    ],
  );
  await connection.execute(
    "insert into payments(id,booking_id,amount_minor,currency,state,provider_payment_id,created_at) values(?,?,18000,'PLN','paid',?,?) on conflict(id) do nothing",
    [bookingId, bookingId, "demo_seed_payment", startsAt],
  );
  await repo.saveGoals(
    { id: identities.menteeId, roles: ["mentee"], mfaVerified: false },
    {
      goal: "career",
      level: "intermediate",
      description: "Przygotować portfolio frontend i plan rozmów technicznych.",
    },
  );
  await repo.conversation(
    { id: identities.menteeId, roles: ["mentee"], mfaVerified: false },
    mentorId,
  );
  return { mentorId, bookingId };
}
