import { beforeAll, afterAll, expect, test } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { access, readdir } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { MikroORM } from "@mikro-orm/postgresql";
import { Migrator } from "@mikro-orm/migrations";
import { Migration202611030001 } from "../migrations/Migration202611030001";
import type { Actor, PaymentEvent, Booking } from "@devmentor/core";
import { createPlatformService, DomainError } from "@devmentor/core";
import { createDatabaseConfig } from "../src/config";
import { runDomainMigrations } from "../src/migrate";
import { createPlatformRepository } from "../src/platform-repository";
import { seedDemoPlatform } from "../src/seed";
import { domainTableNames } from "../src/entities";
let container: StartedPostgreSqlContainer | undefined;
let orm: MikroORM;
let previousVersionHadRequestId = true;
const student: Actor = { id: "student", roles: ["mentee"], mfaVerified: false };
const other: Actor = { id: "other", roles: ["mentee"], mfaVerified: false };
const mentor: Actor = {
  id: "mentor",
  roles: ["mentee", "mentor"],
  mfaVerified: false,
};
const admin: Actor = {
  id: "admin",
  roles: ["admin", "support", "moderator"],
  mfaVerified: true,
};
const now = () => new Date();
function repo() {
  return createPlatformRepository(orm.em.fork());
}
async function slot(index: number) {
  const instant = now();
  const values = await repo().availability(
    "demo-mentor",
    instant.toISOString(),
    new Date(instant.getTime() + 31 * 86400000).toISOString(),
  );
  const result = values[index];
  if (!result) throw new Error("missing seed slot");
  return result;
}
async function hold(index: number, actor = student, at = now().toISOString()) {
  return repo().createHold(
    actor,
    { mentorId: "demo-mentor", slotId: (await slot(index)).id },
    at,
    crypto.randomUUID(),
  );
}
function paid(booking: Booking, eventId = crypto.randomUUID()): PaymentEvent {
  return {
    provider: "demo",
    eventId,
    bookingId: booking.id,
    paymentId: "pi_" + booking.id,
    amountMinor: booking.amountMinor,
    currency: booking.currency,
    status: "paid",
  };
}
beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:18.6")
    .withDatabase("domain_integration")
    .start();
  const env = { DATABASE_URL: container.getConnectionUri() };
  const previous = await MikroORM.init({
    ...createDatabaseConfig(env),
    extensions: [Migrator],
    migrations: { snapshot: false, migrationsList: [Migration202611030001] },
  });
  try {
    await previous.migrator.up();
    previousVersionHadRequestId =
      (
        await previous.em
          .getConnection()
          .execute(
            "select column_name from information_schema.columns where table_name='audit_log' and column_name='request_id'",
          )
      ).length > 0;
  } finally {
    await previous.close(true);
  }
  await runDomainMigrations(env);
  await runDomainMigrations(env);
  orm = new MikroORM(createDatabaseConfig(env));
  await seedDemoPlatform(orm.em.fork(), {
    menteeId: student.id,
    mentorId: mentor.id,
    adminId: admin.id,
  });
  await repo().ensureUser({
    id: other.id,
    name: "Other",
    email: "other@example.test",
  });
});
afterAll(async () => {
  try {
    await orm?.close(true);
  } finally {
    await container?.stop();
  }
});
test("migration creates actual full metadata columns and constraints, reruns cleanly", async () => {
  expect(previousVersionHadRequestId).toBe(false);
  const connection = orm.em.getConnection();
  const rows = await connection.execute<
    { table_name: string; column_name: string }[]
  >(
    "select table_name,column_name from information_schema.columns where table_schema='public'",
  );
  for (const table of domainTableNames) {
    const metadata = [...orm.getMetadata().getAll().values()].find(
      (item) => item.tableName === table,
    );
    expect(metadata).toBeDefined();
    for (const property of Object.values(metadata?.properties ?? {}))
      for (const field of property.fieldNames)
        expect(
          rows.some(
            (row) => row.table_name === table && row.column_name === field,
          ),
        ).toBe(true);
  }
  expect(
    await connection.execute(
      "select conname from pg_constraint where conname='no_overlapping_mentor_bookings'",
    ),
  ).toHaveLength(1);
  const sql = await orm.schema.getUpdateSchemaSQL();
  expect(sql.toLowerCase()).not.toContain("drop table");
});
test("parallel booking holds have one winner and one domain slot conflict", async () => {
  const target = await slot(0);
  const request = (actor: Actor) =>
    createPlatformService({
      repository: repo(),
      now,
      id: () => crypto.randomUUID(),
    }).createHold(actor, { mentorId: "demo-mentor", slotId: target.id });
  const results = await Promise.allSettled([request(student), request(other)]);
  expect(results.filter((item) => item.status === "fulfilled")).toHaveLength(1);
  const failure = results.find((item) => item.status === "rejected");
  expect(failure?.status === "rejected" && failure.reason).toMatchObject({
    code: "SLOT_TAKEN",
    status: 409,
  });
});
test("checkout idempotency compares actor/operation/key and payload", async () => {
  const booking = await hold(1);
  const input = {
    holdId: booking.id,
    paymentMode: "psp" as const,
    acceptedPolicyVersion: booking.policyVersion,
  };
  const first = await repo().checkout(
    student,
    input,
    "same-key",
    now().toISOString(),
  );
  const second = await repo().checkout(
    student,
    input,
    "same-key",
    now().toISOString(),
  );
  expect(second).toEqual(first);
  await expect(
    repo().checkout(
      student,
      { ...input, paymentMode: "credit" },
      "same-key",
      now().toISOString(),
    ),
  ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
  expect(
    await orm.em
      .getConnection()
      .execute(
        "select id from outbox_jobs where kind='checkout.start' and payload->>'orderId'=?",
        [booking.id],
      ),
  ).toHaveLength(1);
});
test("webhook inbox is durable/deduplicated, and processing is monotonic", async () => {
  const booking = await hold(2);
  const event = paid(booking);
  expect(await repo().acceptPaymentEvent(event, now().toISOString())).toBe(
    true,
  );
  expect(await repo().acceptPaymentEvent(event, now().toISOString())).toBe(
    false,
  );
  expect((await repo().booking(student, booking.id)).paymentState).toBe(
    "pending",
  );
  await repo().processPaymentEvent(event, now().toISOString());
  await repo().processPaymentEvent(
    { ...event, status: "failed" },
    now().toISOString(),
  );
  await repo().processPaymentEvent(event, now().toISOString());
  expect(await repo().booking(student, booking.id)).toMatchObject({
    state: "confirmed",
    paymentState: "paid",
  });
  await expect(repo().booking(other, booking.id)).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
});
test("late payment reacquires only free slot and refunds occupied one despite exclusion rollback", async () => {
  const at = now();
  const expired = await hold(3, student, at.toISOString());
  const later = new Date(at.getTime() + 16 * 60000).toISOString();
  await repo().expireHolds(later);
  const replacement = await hold(3, other, later);
  await repo().processPaymentEvent(paid(expired), later);
  expect(await repo().booking(student, expired.id)).toMatchObject({
    state: "expired",
    paymentState: "paid",
    refundState: "requested",
  });
  expect((await repo().booking(other, replacement.id)).state).toBe("held");
  const jobs = await orm.em
    .getConnection()
    .execute(
      "select id from outbox_jobs where kind='payment.refund' and payload->>'orderId'=?",
      [expired.id],
    );
  expect(jobs).toHaveLength(1);
  await repo().processPaymentEvent(paid(expired), later);
  expect(
    await orm.em
      .getConnection()
      .execute("select id from refunds where payment_id=?", [expired.id]),
  ).toHaveLength(1);
  const free = await hold(4, student, at.toISOString());
  await repo().expireHolds(later);
  await repo().processPaymentEvent(paid(free), later);
  expect((await repo().booking(student, free.id)).state).toBe("confirmed");
});
test("payment amount/currency mismatch cannot confirm a booking", async () => {
  const booking = await hold(5);
  await expect(
    repo().processPaymentEvent(
      { ...paid(booking), amountMinor: "1" },
      now().toISOString(),
    ),
  ).rejects.toMatchObject({ code: "PAYMENT_MISMATCH" });
  await expect(
    repo().processPaymentEvent(
      { ...paid(booking), currency: "EUR" },
      now().toISOString(),
    ),
  ).rejects.toMatchObject({ code: "PAYMENT_MISMATCH" });
  expect((await repo().booking(student, booking.id)).paymentState).toBe(
    "pending",
  );
});
test("paid package grants exactly4 credits only once and credit cancellation restores1", async () => {
  const pack = await repo().buyPackage(
    student,
    "demo-mentor",
    "buy-package",
    now().toISOString(),
  );
  expect(pack).toMatchObject({
    state: "pending",
    credits: 0,
    paymentState: "pending",
    amountMinor: "72000",
  });
  const event: PaymentEvent = {
    provider: "demo",
    eventId: "package-paid",
    bookingId: pack.id,
    paymentId: "pi_" + pack.id,
    amountMinor: pack.amountMinor,
    currency: "PLN",
    status: "paid",
  };
  await repo().processPaymentEvent(event, now().toISOString());
  await repo().processPaymentEvent(event, now().toISOString());
  expect(
    (await repo().packages(student)).find((item) => item.id === pack.id)
      ?.credits,
  ).toBe(4);
  await orm.em
    .getConnection()
    .execute(
      "update mentor_profiles set price_minor=24000 where id='demo-mentor'",
    );
  const booking = await hold(6);
  const confirmed = await repo().checkout(
    student,
    {
      holdId: booking.id,
      paymentMode: "credit",
      acceptedPolicyVersion: booking.policyVersion,
    },
    "use-credit",
    now().toISOString(),
  );
  expect(confirmed.state).toBe("confirmed");
  expect(confirmed.amountMinor).toBe("18000");
  await orm.em
    .getConnection()
    .execute(
      "update mentor_profiles set price_minor=18000 where id='demo-mentor'",
    );
  expect(
    (await repo().packages(student)).find((item) => item.id === pack.id)
      ?.credits,
  ).toBe(3);
  const cancelled = await repo().cancel(
    student,
    confirmed.id,
    "A changed work schedule",
    confirmed.version,
    "cancel-credit",
    now().toISOString(),
  );
  expect(cancelled.state).toBe("cancelled");
  await repo().cancel(
    student,
    confirmed.id,
    "A changed work schedule",
    confirmed.version,
    "cancel-credit",
    now().toISOString(),
  );
  expect(
    (await repo().packages(student)).find((item) => item.id === pack.id)
      ?.credits,
  ).toBe(4);
  await expect(
    repo().buyPackage(
      other,
      "demo-mentor",
      "not-eligible",
      now().toISOString(),
    ),
  ).rejects.toMatchObject({ code: "FIRST_SESSION_REQUIRED" });
});
test("reschedule conflict preserves old slot and ownership stays private", async () => {
  const first = await hold(7);
  await repo().processPaymentEvent(paid(first), now().toISOString());
  const confirmed = await repo().booking(student, first.id);
  const occupied = await hold(8, other);
  const target = await slot(8);
  await expect(
    repo().reschedule(
      student,
      first.id,
      target.id,
      confirmed.version,
      now().toISOString(),
    ),
  ).rejects.toMatchObject({ code: "SLOT_TAKEN" });
  expect((await repo().booking(student, first.id)).startsAt).toBe(
    first.startsAt,
  );
  expect((await repo().booking(other, occupied.id)).state).toBe("held");
  await repo().saveNote(student, first.id, "Private learning notes");
  expect(await repo().note(mentor, first.id)).toBe("");
  await expect(repo().note(other, first.id)).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
});
test("conversation participant policy, cursor pagination and clientmessage dedupe", async () => {
  const thread = await repo().conversation(student, "demo-mentor");
  for (let index = 0; index < 22; index++)
    await repo().sendMessage(
      student,
      thread.id,
      "Message " + index,
      "msg-" + index,
      new Date(Date.now() + index).toISOString(),
    );
  const page = await repo().messages(mentor, thread.id);
  expect(page.data).toHaveLength(20);
  expect(page.nextCursor).not.toBeNull();
  const older = await repo().messages(
    student,
    thread.id,
    page.nextCursor as string,
  );
  expect(older.data).toHaveLength(2);
  const duplicate = await repo().sendMessage(
    student,
    thread.id,
    "Message 0",
    "msg-0",
    now().toISOString(),
  );
  expect(duplicate.text).toBe("Message 0");
  await expect(
    repo().sendMessage(
      student,
      thread.id,
      "Changed",
      "msg-0",
      now().toISOString(),
    ),
  ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
  await expect(repo().messages(other, thread.id)).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  await expect(
    repo().sendMessage(
      other,
      thread.id,
      "intrusion",
      "bad",
      now().toISOString(),
    ),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
});
test("moderation role/versions and append-only audit are enforced", async () => {
  const input = {
    headline: "Backend mentoring",
    bio: "I help engineers build reliable services and develop a clear professional growth plan.",
    specialty: "backend",
    languages: ["en"],
    priceMinor: "15000",
    years: 5,
  };
  const application = await repo().applyMentor(other, input);
  await expect(
    repo().decideCase(
      { id: student.id, roles: ["support"], mfaVerified: true },
      application.id,
      "approve",
      "Experience verified",
      1,
      now().toISOString(),
    ),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  const approved = await repo().decideCase(
    admin,
    application.id,
    "approve",
    "Experience verified",
    1,
    now().toISOString(),
  );
  expect(approved.status).toBe("approved");
  expect((await repo().getActor(other.id)).roles).toContain("mentor");
  expect((await repo().caseDetail(admin, application.id)).audit).toHaveLength(
    1,
  );
  await expect(
    orm.em
      .getConnection()
      .execute("update audit_log set reason='tampered' where case_id=?", [
        application.id,
      ]),
  ).rejects.toThrow();
  await expect(
    repo().decideCase(
      admin,
      application.id,
      "reject",
      "Wrong duplicate action",
      1,
      now().toISOString(),
    ),
  ).rejects.toBeInstanceOf(DomainError);
});
test("worker leases allow crash recovery and reject stale completion", async () => {
  const at = now().toISOString();
  const first = await repo().claimJobs(at, 30);
  expect(first.length).toBeGreaterThan(0);
  const job = first[0];
  if (!job) throw new Error("missing job");
  await repo().finishJob(job.id, "stale-token");
  const reclaimed = await repo().claimJobs(
    new Date(Date.parse(at) + 31000).toISOString(),
    30,
  );
  const same = reclaimed.find((item) => item.id === job.id);
  expect(same?.leaseToken).not.toBe(job.leaseToken);
  if (!same) throw new Error("missing recovered lease");
  await repo().finishJob(same.id, same.leaseToken);
  expect(
    await orm.em
      .getConnection()
      .execute("select id from outbox_jobs where id=? and state='done'", [
        same.id,
      ]),
  ).toHaveLength(1);
});
test("payout requires verified KYC and never marks provider success locally", async () => {
  await expect(
    repo().payout(mentor, "100", "no-kyc", now().toISOString()),
  ).rejects.toMatchObject({ code: "KYC_REQUIRED" });
  await repo().updateConnectAccount(mentor.id, "acct_demo_verified", true);
  const payout = await repo().payout(
    mentor,
    "100",
    "verified-kyc",
    now().toISOString(),
  );
  expect(payout.state).toBe("pending");
  expect(payout.providerId).toBeNull();
  expect(
    (await repo().payout(mentor, "100", "verified-kyc", now().toISOString()))
      .id,
  ).toBe(payout.id);
  await repo().completePayout(payout.id, "tr_demo", true);
  expect((await repo().earnings(mentor)).payouts).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: payout.id, state: "succeeded" }),
    ]),
  );
});

test("runtime role performs DML while schemaDDL and audit mutations are denied", async () => {
  await orm.em
    .getConnection()
    .execute(
      "create role domain_runtime nologin; grant usage on schema public to domain_runtime; grant select,insert,update,delete on all tables in schema public to domain_runtime; revoke update,delete on audit_log from domain_runtime;",
    );
  await orm.em.fork().transactional(async (manager) => {
    const connection = manager.getConnection();
    const context = manager.getTransactionContext();
    await connection.execute(
      "set local role domain_runtime",
      [],
      "run",
      context,
    );
    expect(
      await connection.execute(
        "select id from domain_users where id=?",
        [student.id],
        "all",
        context,
      ),
    ).toHaveLength(1);
    await connection.execute(
      "update domain_users set name=name where id=?",
      [student.id],
      "run",
      context,
    );
  });
  await expect(
    orm.em.fork().transactional(async (manager) => {
      const connection = manager.getConnection();
      const context = manager.getTransactionContext();
      await connection.execute(
        "set local role domain_runtime",
        [],
        "run",
        context,
      );
      await connection.execute(
        "create table forbidden_ddl(id integer)",
        [],
        "run",
        context,
      );
    }),
  ).rejects.toThrow(/permission denied/);
  await expect(
    orm.em.fork().transactional(async (manager) => {
      const connection = manager.getConnection();
      const context = manager.getTransactionContext();
      await connection.execute(
        "set local role domain_runtime",
        [],
        "run",
        context,
      );
      await connection.execute("delete from audit_log", [], "run", context);
    }),
  ).rejects.toThrow(/permission denied/);
});
test("recurring local availability persists exceptions and expands into immutable UTC slots", async () => {
  const rules = [
    {
      weekday: 2,
      localTime: "12:00",
      timezone: "Europe/Warsaw",
      disambiguation: "earlier" as const,
    },
  ];
  const exceptions = [{ localDate: "2026-12-22", available: false }];
  await repo().saveAvailabilityRules(mentor, rules, exceptions);
  expect(await repo().availabilityRules(mentor)).toEqual({ rules, exceptions });
  const instant = now();
  const slots = await repo().availability(
    "demo-mentor",
    instant.toISOString(),
    new Date(instant.getTime() + 31 * 86400000).toISOString(),
  );
  expect(slots.some((item) => item.startsAt.endsWith("11:00:00.000Z"))).toBe(
    true,
  );
});

test("catalog sorting has stable composite cursors and rejects malformed or changed sort", async () => {
  const first = await repo().mentors({ sort: "price", limit: 1 });
  expect(first.data[0]?.priceMinor).toBe("15000");
  expect(first.nextCursor).not.toBeNull();
  const next = await repo().mentors({
    sort: "price",
    limit: 1,
    cursor: first.nextCursor as string,
  });
  expect(next.data[0]?.priceMinor).toBe("18000");
  expect(next.data[0]?.id).not.toBe(first.data[0]?.id);
  await expect(
    repo().mentors({ sort: "experience", cursor: first.nextCursor as string }),
  ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
  await expect(repo().mentors({ cursor: "not-json" })).rejects.toMatchObject({
    code: "INVALID_CURSOR",
  });
  const experience = await repo().mentors({ sort: "experience" });
  expect(experience.data[0]?.years).toBe(8);
});
test("auth identity synchronization preserves edited profile and never resets authoritative roles", async () => {
  const before = await repo().profile(student);
  await repo().updateProfile(student, {
    name: "Updated display name",
    timezone: "Asia/Tokyo",
    version: before.version,
  });
  await repo().ensureUser({
    id: student.id,
    name: "Old auth name",
    email: before.email,
  });
  expect(await repo().profile(student)).toMatchObject({
    name: "Updated display name",
    timezone: "Asia/Tokyo",
  });
  const supportActor: Actor = {
    id: student.id,
    roles: ["support"],
    mfaVerified: true,
  };
  await expect(
    repo().adminCases(supportActor, "mentor_application"),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
});
test("concurrent message retries return one persisted message", async () => {
  const conversation = await repo().conversation(student, "demo-mentor");
  const values = await Promise.all([
    repo().sendMessage(
      student,
      conversation.id,
      "A concurrent retry",
      "concurrent-id",
      now().toISOString(),
    ),
    repo().sendMessage(
      student,
      conversation.id,
      "A concurrent retry",
      "concurrent-id",
      now().toISOString(),
    ),
  ]);
  expect(values[0]?.id).toBe(values[1]?.id);
  expect(
    await orm.em
      .getConnection()
      .execute(
        "select id from messages where client_message_id='concurrent-id'",
      ),
  ).toHaveLength(1);
});
test("financial retry limit creates deadletter and audited manual retry preserves idempotency", async () => {
  const connection = orm.em.getConnection();
  const [refund] = await connection.execute<
    { id: string; payment_id: string }[]
  >("select id,payment_id from refunds where state='requested' limit 1");
  if (!refund) throw new Error("missing refund probe");
  await connection.execute(
    "update outbox_jobs set state='done',lease_token=null,lease_until=null",
  );
  const jobId = crypto.randomUUID();
  await connection.execute(
    "insert into outbox_jobs(id,kind,payload,available_at,created_at) values(?,'payment.refund',?::jsonb,?,?)",
    [
      jobId,
      JSON.stringify({ orderId: refund.payment_id }),
      now().toISOString(),
      now().toISOString(),
    ],
  );
  for (let attempt = 1; attempt <= 8; attempt++) {
    const at = new Date(Date.now() + attempt * 4000000).toISOString();
    const leased = (await repo().claimJobs(at)).find(
      (item) => item.id === jobId,
    );
    expect(leased?.attempts).toBe(attempt);
    if (!leased) throw new Error("missing retry lease");
    await repo().failJob(leased.id, leased.leaseToken, at);
  }
  expect(
    await connection.execute(
      "select id from outbox_jobs where id=? and state='failed' and attempts=8",
      [jobId],
    ),
  ).toHaveLength(1);
  expect(
    await connection.execute(
      "select id from refunds where id=? and state='failed'",
      [refund.id],
    ),
  ).toHaveLength(1);
  await expect(repo().retryFailedJob(student, jobId)).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  expect(
    (await repo().failedJobs(admin)).some((item) => item.id === jobId),
  ).toBe(true);
  await repo().retryFailedJob(admin, jobId);
  expect(
    await connection.execute(
      "select id from outbox_jobs where id=? and state='pending' and attempts=0",
      [jobId],
    ),
  ).toHaveLength(1);
  expect(
    await connection.execute(
      "select id from audit_log where action='job.retry'",
    ),
  ).toHaveLength(1);
});

test("checkout created after a hold expired is still explicitly expired once", async () => {
  const booking = await hold(25);
  await repo().expireHolds(new Date(Date.now() + 16 * 60000).toISOString());
  await repo().attachCheckout(
    booking.id,
    "cs_after_expiry",
    "https://checkout.example.test/cs",
  );
  await repo().attachCheckout(
    booking.id,
    "cs_after_expiry",
    "https://checkout.example.test/cs",
  );
  expect(
    await orm.em
      .getConnection()
      .execute(
        "select id from outbox_jobs where kind='checkout.expire' and payload->>'orderId'=?",
        [booking.id],
      ),
  ).toHaveLength(1);
});

test("all privileged administrative paths require domain-level MFA", async () => {
  const unverified = { ...admin, mfaVerified: false };
  await expect(repo().adminCases(unverified)).rejects.toMatchObject({
    code: "MFA_REQUIRED",
  });
  await expect(repo().failedJobs(unverified)).rejects.toMatchObject({
    code: "MFA_REQUIRED",
  });
  const item = (await repo().ownCases(other))[0];
  if (!item) throw new Error("missing administrative case");
  await expect(repo().caseDetail(unverified, item.id)).rejects.toMatchObject({
    code: "MFA_REQUIRED",
  });
  await expect(
    repo().decideCase(
      unverified,
      item.id,
      "approve",
      "Verified experience",
      item.version,
      now().toISOString(),
    ),
  ).rejects.toMatchObject({ code: "MFA_REQUIRED" });
});

async function waitForDatabaseLock(
  fragment: string,
  count: number,
): Promise<void> {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const [row] = await orm.em
      .getConnection()
      .execute<{ count: number }[]>(
        "select count(*)::int as count from pg_stat_activity where wait_event_type='Lock' and query ilike ?",
        ["%" + fragment + "%"],
      );
    if ((row?.count ?? 0) >= count) return;
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
  throw new Error(
    "Expected concurrent operation did not reach database lock: " + fragment,
  );
}

test("checkout reads the expired state only after obtaining the booking lock", async () => {
  const at = now();
  const booking = await hold(30, student, at.toISOString());
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let ready: (() => void) | undefined;
  const locked = new Promise<void>((resolve) => {
    ready = resolve;
  });
  const expiring = orm.em.fork().transactional(async (manager) => {
    await createPlatformRepository(manager).expireHolds(
      new Date(at.getTime() + 16 * 60000).toISOString(),
    );
    ready?.();
    await gate;
  });
  await locked;
  const checkout = repo()
    .checkout(
      student,
      {
        holdId: booking.id,
        paymentMode: "psp",
        acceptedPolicyVersion: booking.policyVersion,
      },
      "expiry-lock-regression",
      at.toISOString(),
    )
    .then(
      (value) => ({ ok: true as const, value }),
      (error) => ({ ok: false as const, error: error as unknown }),
    );
  try {
    await waitForDatabaseLock("bookings", 1);
    release?.();
    await expiring;
    const result = await checkout;
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.error).toMatchObject({ code: "HOLD_EXPIRED", status: 409 });
    expect((await repo().booking(student, booking.id)).state).toBe("expired");
    expect(
      await orm.em
        .getConnection()
        .execute(
          "select id from outbox_jobs where kind='checkout.start' and payload->>'orderId'=?",
          [booking.id],
        ),
    ).toHaveLength(0);
  } finally {
    release?.();
    await expiring;
    await checkout;
  }
});

test("concurrent edits of the same mentor version allow exactly one update", async () => {
  const before = await repo().ownMentor(mentor);
  const input = {
    headline: before.headline,
    bio: before.bio,
    specialty: before.specialty,
    languages: before.languages,
    priceMinor: before.priceMinor,
    years: before.years,
    version: before.version,
  };
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let ready: (() => void) | undefined;
  const locked = new Promise<void>((resolve) => {
    ready = resolve;
  });
  const blocking = orm.em.fork().transactional(async (manager) => {
    await manager
      .getConnection()
      .execute(
        "select id from mentor_profiles where id=? for update",
        [before.id],
        "all",
        manager.getTransactionContext(),
      );
    ready?.();
    await gate;
  });
  await locked;
  const edits = Promise.allSettled([
    repo().saveMentor(mentor, {
      ...input,
      headline: "First concurrent profile edit",
    }),
    repo().saveMentor(mentor, {
      ...input,
      headline: "Second concurrent profile edit",
    }),
  ]);
  try {
    await waitForDatabaseLock("update mentor_profiles", 2);
    release?.();
    await blocking;
    const results = await edits;
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const failure = results.find((result) => result.status === "rejected");
    expect(failure?.status === "rejected" && failure.reason).toMatchObject({
      code: "STALE_VERSION",
      status: 409,
    });
    const after = await repo().ownMentor(mentor);
    expect(after.version).toBe(before.version + 1);
    expect([
      "First concurrent profile edit",
      "Second concurrent profile edit",
    ]).toContain(after.headline);
  } finally {
    release?.();
    await blocking;
    await edits;
  }
});

test("exact checkout lookup bypasses abandoned holds and reconciliation scans beyond100", async () => {
  const connection = orm.em.getConnection();
  const oldTime = new Date(Date.now() - 20 * 86400000).toISOString();
  const oldEnd = new Date(Date.parse(oldTime) + 50 * 60000).toISOString();
  await connection.execute(
    "insert into bookings(id,mentor_id,mentee_id,starts_at,ends_at,timezone,state,expires_at,amount_minor,fee_minor,currency,policy_version,created_at) select '000-abandoned-'||lpad(n::text,3,'0'),'demo-mentor',?,?,?,'Europe/Warsaw','expired',?,18000,2700,'PLN','2026-11-03',? from generate_series(1,101) n",
    [student.id, oldTime, oldEnd, oldTime, oldTime],
  );
  await connection.execute(
    "insert into payments(id,booking_id,amount_minor,currency,created_at) select id,id,18000,'PLN',? from bookings where id like '000-abandoned-%'",
    [oldTime],
  );
  const booking = await hold(40);
  await repo().checkout(
    student,
    {
      holdId: booking.id,
      paymentMode: "psp",
      acceptedPolicyVersion: booking.policyVersion,
    },
    "over100-new-checkout",
    now().toISOString(),
  );
  const target = await repo().paymentOrder(booking.id);
  expect(target).toMatchObject({
    id: booking.id,
    paymentState: "pending",
    checkoutId: null,
  });
  expect(
    await connection.execute(
      "select id from outbox_jobs where kind='checkout.start' and payload->>'orderId'=?",
      [booking.id],
    ),
  ).toHaveLength(1);
  expect(
    (await repo().pendingPayments()).some((order) =>
      order.id.startsWith("000-abandoned-"),
    ),
  ).toBe(false);
  await expect(repo().paymentOrder("000-abandoned-001")).rejects.toMatchObject({
    code: "HOLD_EXPIRED",
  });
  await expect(
    repo().paymentOrder("missing-payment-order"),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  await connection.execute(
    "update payments set checkout_id='cs_'||id where id like '000-abandoned-%'",
  );
  await repo().attachCheckout(
    booking.id,
    "cs_new_after101",
    "https://checkout.example.test/new",
  );
  const seen: string[] = [];
  let cursor: string | undefined;
  let batches = 0;
  while (true) {
    const batch = await repo().pendingPayments(cursor);
    if (!batch.length) break;
    batches++;
    seen.push(...batch.map((order) => order.id));
    cursor = batch[batch.length - 1]?.id;
    if (batch.length < 100) break;
  }
  expect(batches).toBeGreaterThan(1);
  expect(seen).toContain(booking.id);
  expect(seen.filter((id) => id.startsWith("000-abandoned-"))).toHaveLength(
    101,
  );
  expect(new Set(seen).size).toBe(seen.length);
});

test("programmatic and CLI migrations succeed from read-only cwd without snapshot writes", async () => {
  if (!container) throw new Error("PostgreSQL setup did not complete");
  const root = resolve(import.meta.dirname, "../../..");
  const readOnlyCwd = "/sys";
  await expect(access(readOnlyCwd, constants.W_OK)).rejects.toThrow();
  const trackedDirectories = [
    root,
    resolve(root, "packages/db/migrations"),
    readOnlyCwd,
  ];
  const snapshotNames = async () =>
    Promise.all(
      trackedDirectories.map(async (directory) => ({
        directory,
        names: (await readdir(directory))
          .filter((name) => name.startsWith(".snapshot-"))
          .sort(),
      })),
    );
  const before = await snapshotNames();
  const run = promisify(execFile);
  const loader = pathToFileURL(
    resolve(root, "node_modules/tsx/dist/loader.mjs"),
  ).href;
  for (const kind of ["programmatic", "cli"]) {
    const databaseName = "readonly_" + kind;
    await orm.em.getConnection().execute("create database " + databaseName);
    const url = new URL(container.getConnectionUri());
    url.pathname = "/" + databaseName;
    // Official CLI options allow the installed binary/config to be invoked outside its workspace.
    const env = {
      ...process.env,
      DATABASE_URL: url.href,
      MIKRO_ORM_ALLOW_GLOBAL_CLI: "1",
      MIKRO_ORM_CLI_TS_LOADER: "tsx",
    };
    const args =
      kind === "programmatic"
        ? [
            "--import",
            loader,
            "--input-type=module",
            "--eval",
            `const {runDomainMigrations}=await import(${JSON.stringify(pathToFileURL(resolve(root, "packages/db/src/migrate.ts")).href)});await runDomainMigrations();`,
          ]
        : [
            resolve(root, "node_modules/@mikro-orm/cli/cli.js"),
            "migration:up",
            "--config",
            resolve(root, "packages/db/mikro-orm.config.ts"),
          ];
    await run(process.execPath, args, {
      cwd: readOnlyCwd,
      env,
      timeout: 60000,
    });
    await run(process.execPath, args, {
      cwd: readOnlyCwd,
      env,
      timeout: 60000,
    });
    const verify = new MikroORM(
      createDatabaseConfig({ DATABASE_URL: url.href }),
    );
    try {
      expect(
        await verify.em
          .getConnection()
          .execute("select name from mikro_orm_migrations order by name"),
      ).toHaveLength(4);
    } finally {
      await verify.close(true);
    }
  }
  expect(await snapshotNames()).toEqual(before);
});

test("PSP checkout locks the funding mode before attachment and cannot also spend a credit", async () => {
  const booking = await hold(46);
  const before = (await repo().packages(student)).reduce(
    (sum, item) => sum + item.credits,
    0,
  );
  const input = {
    holdId: booking.id,
    paymentMode: "psp" as const,
    acceptedPolicyVersion: booking.policyVersion,
  };
  await repo().checkout(student, input, "mode-psp-queued", now().toISOString());
  await expect(
    repo().checkout(
      student,
      { ...input, paymentMode: "credit" },
      "mode-credit-after-queue",
      now().toISOString(),
    ),
  ).rejects.toMatchObject({ code: "PAYMENT_MODE_LOCKED", status: 409 });
  await repo().attachCheckout(
    booking.id,
    "cs_mode_locked",
    "https://checkout.example.test/mode",
  );
  await expect(
    repo().checkout(
      student,
      { ...input, paymentMode: "credit" },
      "mode-credit-after-attach",
      now().toISOString(),
    ),
  ).rejects.toMatchObject({ code: "PAYMENT_MODE_LOCKED", status: 409 });
  const event = paid(booking);
  await repo().processPaymentEvent(event, now().toISOString());
  await repo().processPaymentEvent(event, now().toISOString());
  expect(await repo().booking(student, booking.id)).toMatchObject({
    state: "confirmed",
    paymentMode: "psp",
    paymentState: "paid",
  });
  expect(
    (await repo().packages(student)).reduce(
      (sum, item) => sum + item.credits,
      0,
    ),
  ).toBe(before);
  expect(
    await orm.em
      .getConnection()
      .execute("select id from credit_ledger where booking_id=?", [booking.id]),
  ).toHaveLength(0);
  expect(
    await orm.em
      .getConnection()
      .execute("select provider_payment_id from payments where id=?", [
        booking.id,
      ]),
  ).toEqual([{ provider_payment_id: event.paymentId }]);
});
test("concurrent PSP and credit checkout requests choose only one funding source", async () => {
  const pack = await repo().buyPackage(
    student,
    "demo-mentor",
    "mode-concurrency-package",
    now().toISOString(),
  );
  await repo().processPaymentEvent(
    {
      provider: "demo",
      eventId: "mode-package-paid",
      bookingId: pack.id,
      paymentId: "pi_" + pack.id,
      amountMinor: pack.amountMinor,
      currency: pack.currency,
      status: "paid",
    },
    now().toISOString(),
  );
  const booking = await hold(47);
  const before = (await repo().packages(student)).reduce(
    (sum, item) => sum + item.credits,
    0,
  );
  const base = {
    holdId: booking.id,
    acceptedPolicyVersion: booking.policyVersion,
  };
  const values = await Promise.allSettled([
    repo().checkout(
      student,
      { ...base, paymentMode: "psp" },
      "race-psp",
      now().toISOString(),
    ),
    repo().checkout(
      student,
      { ...base, paymentMode: "credit" },
      "race-credit",
      now().toISOString(),
    ),
  ]);
  expect(values.filter((item) => item.status === "fulfilled")).toHaveLength(1);
  const error = values.find((item) => item.status === "rejected");
  expect(error?.status === "rejected" && error.reason).toMatchObject({
    code: "PAYMENT_MODE_LOCKED",
  });
  const current = await repo().booking(student, booking.id);
  const credit = current.paymentMode === "credit";
  expect(
    (await repo().packages(student)).reduce(
      (sum, item) => sum + item.credits,
      0,
    ),
  ).toBe(before - (credit ? 1 : 0));
  expect(
    await orm.em
      .getConnection()
      .execute(
        "select id from outbox_jobs where kind='checkout.start' and payload->>'orderId'=?",
        [booking.id],
      ),
  ).toHaveLength(credit ? 0 : 1);
});
test("verified legacy PSP charge after credit settlement is refunded exactly once using its own snapshot", async () => {
  const booking = await hold(48);
  const settled = await repo().checkout(
    student,
    {
      holdId: booking.id,
      paymentMode: "credit",
      acceptedPolicyVersion: booking.policyVersion,
    },
    "legacy-credit",
    now().toISOString(),
  );
  const before = (await repo().packages(student)).reduce(
    (sum, item) => sum + item.credits,
    0,
  );
  // This is the exact pre-fix persisted state: an open provider checkout survives a credit settlement.
  await orm.em
    .getConnection()
    .execute("update payments set checkout_id=? where id=?", [
      "cs_legacy_" + booking.id,
      booking.id,
    ]);
  const event: PaymentEvent = {
    provider: "stripe",
    eventId: "legacy-extra-charge",
    bookingId: booking.id,
    paymentId: "pi_legacy_" + booking.id,
    amountMinor: "24000",
    currency: "PLN",
    status: "paid",
  };
  await repo().processPaymentEvent(event, now().toISOString());
  await repo().processPaymentEvent(
    { ...event, eventId: "legacy-extra-repeated" },
    now().toISOString(),
  );
  expect(await repo().booking(student, booking.id)).toMatchObject({
    state: "confirmed",
    paymentMode: "credit",
    amountMinor: settled.amountMinor,
    refundState: "requested",
  });
  expect(
    (await repo().packages(student)).reduce(
      (sum, item) => sum + item.credits,
      0,
    ),
  ).toBe(before);
  expect(
    await orm.em
      .getConnection()
      .execute(
        "select amount_minor::text as amount,currency,provider_payment_id,kind from refunds where payment_id=?",
        [booking.id],
      ),
  ).toEqual([
    {
      amount: "24000",
      currency: "PLN",
      provider_payment_id: event.paymentId,
      kind: "extra_charge",
    },
  ]);
  expect(
    await orm.em
      .getConnection()
      .execute(
        "select id from outbox_jobs where kind='payment.refund' and payload->>'orderId'=?",
        [booking.id],
      ),
  ).toHaveLength(1);
  await repo().attachRefund(booking.id, "re_legacy_extra");
  expect(
    (await repo().pendingRefunds()).find((item) => item.orderId === booking.id),
  ).toMatchObject({
    amountMinor: "24000",
    currency: "PLN",
    paymentId: event.paymentId,
    providerId: "re_legacy_extra",
  });
  await repo().processPaymentEvent(
    {
      ...event,
      eventId: "legacy-refunded",
      status: "refund_succeeded",
      refundId: "re_legacy_extra",
    },
    now().toISOString(),
  );
  expect((await repo().booking(student, booking.id)).refundState).toBe(
    "succeeded",
  );
});
test("removed recurring offers stay retired after hold expiry and confirmed bookings remain intact", async () => {
  const instant = now();
  const end = new Date(instant.getTime() + 31 * 86400000).toISOString();
  await repo().saveAvailabilityRules(
    mentor,
    [
      {
        weekday: 3,
        localTime: "16:00",
        timezone: "Europe/Warsaw",
        disambiguation: "earlier",
      },
    ],
    [],
  );
  await repo().availability("demo-mentor", instant.toISOString(), end);
  const generated = await orm.em
    .getConnection()
    .execute<{ id: string }[]>(
      "select id from availability_slots where mentor_id='demo-mentor' and rule_offered and not manual_offered and starts_at>now()+interval '24 hours' order by starts_at limit 2",
    );
  const first = generated[0],
    second = generated[1];
  if (!first || !second) throw new Error("missing generated offers");
  const held = await repo().createHold(
    student,
    { mentorId: "demo-mentor", slotId: first.id },
    instant.toISOString(),
    crypto.randomUUID(),
  );
  const confirmed = await repo().createHold(
    other,
    { mentorId: "demo-mentor", slotId: second.id },
    instant.toISOString(),
    crypto.randomUUID(),
  );
  await repo().processPaymentEvent(paid(confirmed), instant.toISOString());
  await repo().saveAvailabilityRules(mentor, [], []);
  await repo().expireHolds(
    new Date(instant.getTime() + 16 * 60000).toISOString(),
  );
  const available = await repo().availability(
    "demo-mentor",
    instant.toISOString(),
    end,
  );
  expect(
    available.some((item) => item.id === first.id || item.id === second.id),
  ).toBe(false);
  await expect(
    repo().createHold(
      student,
      { mentorId: "demo-mentor", slotId: first.id },
      instant.toISOString(),
      crypto.randomUUID(),
    ),
  ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
  expect((await repo().booking(student, held.id)).state).toBe("expired");
  expect(await repo().booking(other, confirmed.id)).toMatchObject({
    state: "confirmed",
    startsAt: confirmed.startsAt,
    endsAt: confirmed.endsAt,
  });
  expect(
    await orm.em
      .getConnection()
      .execute(
        "select id from availability_slots where id in(?,?) and not active",
        [first.id, second.id],
      ),
  ).toHaveLength(2);
});
test("retiring a weekly rule preserves independently offered manual availability", async () => {
  const instant = now();
  const end = new Date(instant.getTime() + 31 * 86400000).toISOString();
  const manual = (
    await repo().availability("demo-mentor", instant.toISOString(), end)
  ).find((item) => item.available);
  if (!manual) throw new Error("missing manual offer");
  const date = new Date(manual.startsAt);
  const localTime = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Warsaw",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
  await repo().saveAvailabilityRules(
    mentor,
    [
      {
        weekday: date.getUTCDay(),
        localTime,
        timezone: "Europe/Warsaw",
        disambiguation: "earlier",
      },
    ],
    [],
  );
  await repo().availability("demo-mentor", instant.toISOString(), end);
  expect(
    await orm.em
      .getConnection()
      .execute(
        "select id from availability_slots where id=? and manual_offered and rule_offered",
        [manual.id],
      ),
  ).toHaveLength(1);
  await repo().saveAvailabilityRules(mentor, [], []);
  expect(
    (await repo().availability("demo-mentor", instant.toISOString(), end)).some(
      (item) => item.id === manual.id,
    ),
  ).toBe(true);
  await expect(repo().saveAvailability(mentor, [])).rejects.toMatchObject({
    code: "BOOKED_SLOT",
    status: 409,
  });
});
test("specialty filtering matches canonical and user-entered case consistently", async () => {
  const lower = await repo().mentors({ specialty: "frontend" });
  const mixed = await repo().mentors({ specialty: "Frontend" });
  expect(lower.data.map((item) => item.id)).toEqual(
    mixed.data.map((item) => item.id),
  );
  expect(lower.data.map((item) => item.id)).toContain("demo-mentor");
});
