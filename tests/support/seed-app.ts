import { database, seedDemoPlatform, withEntityManager } from "@devmentor/db";

try {
  const orm = await database.get();
  await withEntityManager(orm, (em) =>
    seedDemoPlatform(em, {
      menteeId: "test-mentee",
      mentorId: "test-mentor",
      adminId: "test-admin",
    }),
  );
} finally {
  await database.close();
}
