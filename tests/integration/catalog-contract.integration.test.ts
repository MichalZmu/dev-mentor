import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { beforeAll, afterAll, expect, test } from "vitest";
import { z } from "zod";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { database } from "@devmentor/db";
import { handleApi } from "../../packages/app/server/api";
import {
  closeAuthRuntime,
  getAuthRuntime,
} from "../../packages/app/server/auth";

const run = promisify(execFile);
const origin = "http://localhost:3199";
const previous = { ...process.env };
const mentorIds = Array.from(
  { length: 22 },
  (_, index) =>
    `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
);
const pageSchema = z.object({
  data: z.array(z.object({ id: z.string() })),
  nextCursor: z.string().nullable(),
});
const bookingSchema = z.object({
  id: z.string(),
  menteeId: z.string(),
  checkoutUrl: z.string().nullable(),
  checkoutId: z.string().nullable(),
});
const errorSchema = z.object({ error: z.object({ code: z.string() }) });
let container: StartedPostgreSqlContainer | undefined;
let mentorCookie = "";
let adminCookie = "";
let menteeCookie = "";
let menteeId = "";
let mentorUserId = "";
const incomingId = "catalog-contract-incoming";
const ownId = "catalog-contract-own";

function request(
  path: string,
  cookie = "",
  method = "GET",
  body?: unknown,
  extra: Record<string, string> = {},
): Request {
  return new Request(origin + "/api/v1/" + path, {
    method,
    headers: { origin, "content-type": "application/json", cookie, ...extra },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
async function login(email: string): Promise<string> {
  const result = await handleApi(
    request("auth/login", "", "POST", {
      email,
      password: "DemoOnly_2026!",
    }),
  );
  expect(result.status).toBe(200);
  return result.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
}
async function insertBooking(
  bookingId: string,
  ownerId: string,
  mentorId: string,
  daysFromNow: number,
): Promise<void> {
  const startsAt = new Date(Date.now() + daysFromNow * 86400000);
  startsAt.setUTCHours(7, 0, 0, 0);
  const endsAt = new Date(startsAt.getTime() + 50 * 60000);
  const pool = getAuthRuntime().pool;
  await pool.query(
    `insert into public.bookings(id,mentor_id,mentee_id,starts_at,ends_at,timezone,state,expires_at,amount_minor,fee_minor,currency,policy_version,created_at)
     values($1,$2,$3,$4,$5,'Europe/Warsaw','confirmed',now(),18000,2700,'PLN','2026-11-03',now())`,
    [
      bookingId,
      mentorId,
      ownerId,
      startsAt.toISOString(),
      endsAt.toISOString(),
    ],
  );
  await pool.query(
    `insert into public.payments(id,booking_id,amount_minor,currency,state,provider_payment_id,checkout_id,checkout_url,created_at)
     values($1,$1,18000,'PLN','paid',$2,$3,$4,now())`,
    [
      bookingId,
      "pi_" + bookingId,
      "cs_" + bookingId,
      "https://checkout.stripe.test/private-" + bookingId,
    ],
  );
}

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:18.6")
    .withDatabase("catalog_contract")
    .start();
  Object.assign(process.env, {
    APP_MODE: "demo",
    APP_URL: origin,
    DATABASE_URL: container.getConnectionUri(),
    AUTH_DATABASE_URL: container.getConnectionUri(),
    MIGRATION_DATABASE_URL: container.getConnectionUri(),
    AUTH_MIGRATION_DATABASE_URL: container.getConnectionUri(),
  });
  await run("npm", ["run", "migrate"], { env: process.env, timeout: 90_000 });
  await run("npm", ["run", "seed:demo"], { env: process.env, timeout: 90_000 });
  const pool = getAuthRuntime().pool;
  for (const [index, mentorId] of mentorIds.entries()) {
    const userId = "catalog-contract-user-" + index;
    await pool.query(
      "insert into public.domain_users(id,name,email) values($1,$2,$3)",
      [
        userId,
        "Catalog Mentor " + index,
        `catalog-mentor-${index}@example.test`,
      ],
    );
    await pool.query(
      `insert into public.mentor_profiles(id,user_id,headline,bio,specialty,languages,price_minor,years,status)
       values($1,$2,'Catalog contract mentor','Experienced mentor with a complete public profile for cursor regression.','frontend','["pl"]',18000,5,'published')`,
      [mentorId, userId],
    );
  }
  const identities = await pool.query<{ id: string; email: string }>(
    'select id,email from auth."user" where email in ($1,$2)',
    ["demo@example.test", "mentor@example.test"],
  );
  menteeId =
    identities.rows.find((user) => user.email === "demo@example.test")?.id ??
    "";
  mentorUserId =
    identities.rows.find((user) => user.email === "mentor@example.test")?.id ??
    "";
  if (!menteeId || !mentorUserId || !mentorIds[0])
    throw new Error("Demo identities missing");
  await insertBooking(incomingId, menteeId, "demo-mentor", 4);
  await insertBooking(ownId, mentorUserId, mentorIds[0], 5);
  for (let index = 0; index < 21; index++) {
    await insertBooking(
      "catalog-extra-session-" + index,
      menteeId,
      "demo-mentor",
      40 + index,
    );
  }
  menteeCookie = await login("demo@example.test");
  mentorCookie = await login("mentor@example.test");
  adminCookie = await login("admin@example.test");
});
afterAll(async () => {
  try {
    await Promise.allSettled([closeAuthRuntime(), database.close()]);
  } finally {
    try {
      await container?.stop();
    } finally {
      for (const key of Object.keys(process.env))
        if (!(key in previous)) delete process.env[key];
      Object.assign(process.env, previous);
    }
  }
});

test("the opaque cursor returned for UUID mentors is accepted unchanged on the next catalog page", async () => {
  const first = await handleApi(request("mentors?limit=20"));
  expect(first.status).toBe(200);
  const firstPage = pageSchema.parse(await first.json());
  expect(firstPage.data).toHaveLength(20);
  const cursor = firstPage.nextCursor;
  if (!cursor) throw new Error("Expected another catalog page");
  expect(cursor.length).toBeGreaterThan(100);
  const second = await handleApi(
    request("mentors?limit=20&cursor=" + encodeURIComponent(cursor)),
  );
  expect(second.status).toBe(200);
  const secondPage = pageSchema.parse(await second.json());
  expect(secondPage.data).toHaveLength(3);
  expect(secondPage.nextCursor).toBeNull();
  const actual = [...firstPage.data, ...secondPage.data].map(
    (mentor) => mentor.id,
  );
  expect(new Set(actual).size).toBe(23);
  expect([...actual].sort()).toEqual([...mentorIds, "demo-mentor"].sort());
});

test("catalog cursors stay bounded and malformed tokens fail without leaking infrastructure errors", async () => {
  const oversized = await handleApi(
    request("mentors?cursor=" + "x".repeat(2049)),
  );
  expect(oversized.status).toBe(422);
  expect(errorSchema.parse(await oversized.json()).error.code).toBe(
    "VALIDATION_ERROR",
  );
  const malformed = await handleApi(request("mentors?cursor=not-a-cursor"));
  expect(malformed.status).toBe(422);
  expect(errorSchema.parse(await malformed.json()).error.code).toBe(
    "INVALID_CURSOR",
  );
});

test("billing contains only owned orders while mentoring sessions redact checkout bearer fields", async () => {
  const billing = await handleApi(request("me/billing", mentorCookie));
  expect(billing.status).toBe(200);
  const mentorOrders = z
    .object({ data: z.object({ orders: z.array(bookingSchema) }) })
    .parse(await billing.json()).data.orders;
  expect(mentorOrders.map((order) => order.id)).toEqual([ownId]);
  expect(mentorOrders[0]?.checkoutUrl).toBe(
    "https://checkout.stripe.test/private-" + ownId,
  );
  expect(
    (await handleApi(request("orders/" + incomingId, mentorCookie))).status,
  ).toBe(404);
  expect(
    (await handleApi(request("orders/" + ownId, mentorCookie))).status,
  ).toBe(200);

  const sessions = await handleApi(
    request("me/sessions?limit=50", mentorCookie),
  );
  expect(sessions.status).toBe(200);
  const mentorSessions = z
    .object({ data: z.array(bookingSchema) })
    .parse(await sessions.json()).data;
  expect(
    mentorSessions.find((booking) => booking.id === incomingId),
  ).toMatchObject({ checkoutUrl: null, checkoutId: null });
  expect(mentorSessions.find((booking) => booking.id === ownId)).toMatchObject({
    checkoutUrl: "https://checkout.stripe.test/private-" + ownId,
    checkoutId: "cs_" + ownId,
  });
  const dashboard = await handleApi(request("me/dashboard", mentorCookie));
  expect(dashboard.status).toBe(200);
  const dashboardBody = z
    .object({
      data: z.object({
        nextSession: bookingSchema,
        upcomingCount: z.number(),
        completedCount: z.number(),
      }),
    })
    .parse(await dashboard.json());
  expect(dashboardBody.data.upcomingCount).toBe(23);
  expect(dashboardBody.data.completedCount).toBe(1);
  expect(dashboardBody.data.nextSession).toMatchObject({
    id: incomingId,
    checkoutUrl: null,
    checkoutId: null,
  });
  const mentorDashboard = await handleApi(
    request("mentor/dashboard", mentorCookie),
  );
  expect(mentorDashboard.status).toBe(200);
  const dashboardSessions = z
    .object({ data: z.object({ sessions: z.array(bookingSchema) }) })
    .parse(await mentorDashboard.json()).data.sessions;
  expect(
    dashboardSessions.find((booking) => booking.id === incomingId),
  ).toMatchObject({ checkoutUrl: null, checkoutId: null });
  expect(
    dashboardSessions.find((booking) => booking.id === ownId)?.checkoutUrl,
  ).not.toBeNull();

  const ownedBilling = await handleApi(request("me/billing", menteeCookie));
  const owned = z
    .object({ data: z.object({ orders: z.array(bookingSchema) }) })
    .parse(await ownedBilling.json()).data.orders;
  expect(owned.find((booking) => booking.id === incomingId)).toMatchObject({
    checkoutUrl: "https://checkout.stripe.test/private-" + incomingId,
    checkoutId: "cs_" + incomingId,
  });
});

test("participant mutation responses preserve checkout privacy", async () => {
  const cancelId = "catalog-cancel-" + randomUUID();
  await insertBooking(cancelId, menteeId, "demo-mentor", 8);
  const cancelled = await handleApi(
    request(
      "sessions/" + cancelId + "/cancel",
      mentorCookie,
      "POST",
      { reason: "Mentor needs to cancel this session", version: 1 },
      { "idempotency-key": "cancel_" + cancelId },
    ),
  );
  expect(cancelled.status).toBe(202);
  expect(
    z.object({ data: bookingSchema }).parse(await cancelled.json()).data,
  ).toMatchObject({ checkoutUrl: null, checkoutId: null });

  const rescheduleId = "catalog-reschedule-" + randomUUID();
  await insertBooking(rescheduleId, menteeId, "demo-mentor", 9);
  const availability = await handleApi(
    request("mentors/demo-mentor/availability"),
  );
  const slots = z
    .object({
      data: z.array(z.object({ id: z.string(), available: z.boolean() })),
    })
    .parse(await availability.json()).data;
  const target = slots.find((slot) => slot.available);
  if (!target) throw new Error("Expected an available demo slot");
  const rescheduled = await handleApi(
    request("sessions/" + rescheduleId + "/reschedule", mentorCookie, "POST", {
      slotId: target.id,
      version: 1,
    }),
  );
  expect(rescheduled.status).toBe(200);
  expect(
    z.object({ data: bookingSchema }).parse(await rescheduled.json()).data,
  ).toMatchObject({ checkoutUrl: null, checkoutId: null });

  const completedId = "catalog-complete-" + randomUUID();
  await insertBooking(completedId, menteeId, "demo-mentor", -7);
  const completed = await handleApi(
    request("sessions/" + completedId + "/complete", mentorCookie, "POST", {}),
  );
  expect(completed.status).toBe(200);
  expect(
    z.object({ data: bookingSchema }).parse(await completed.json()).data,
  ).toMatchObject({ checkoutUrl: null, checkoutId: null });
});

test("administration counts pending support cases and only discloses the authorized queues", async () => {
  const ids: string[] = [];
  for (let index = 0; index < 2; index++) {
    const created = await handleApi(
      request("support-tickets", menteeCookie, "POST", {
        category: "session",
        description:
          "Please help with this session and scheduling question " + index,
      }),
    );
    expect(created.status).toBe(201);
    ids.push(
      z
        .object({
          data: z.object({ id: z.string(), status: z.literal("pending") }),
        })
        .parse(await created.json()).data.id,
    );
  }
  const application = await handleApi(
    request("mentor-applications", menteeCookie, "POST", {
      headline: "An experienced mentor available for collaboration",
      bio: "I help developers build reliable applications and improve their software engineering skills in a practical way.",
      specialty: "frontend",
      languages: ["pl"],
      priceMinor: "18000",
      years: 5,
    }),
  );
  expect(application.status).toBe(201);
  const overviewSchema = z.object({ data: z.record(z.string(), z.number()) });
  const pool = getAuthRuntime().pool;
  const adminUser = await pool.query<{ id: string }>(
    'select id from auth."user" where email=$1',
    ["admin@example.test"],
  );
  const adminId = adminUser.rows[0]?.id;
  if (!adminId) throw new Error("Missing administrator identity");
  try {
    await pool.query(
      "update public.domain_users set roles=$1::jsonb where id=$2",
      ['["support"]', adminId],
    );
    const support = await handleApi(request("admin/overview", adminCookie));
    expect(support.status).toBe(200);
    expect(overviewSchema.parse(await support.json()).data).toEqual({
      openTickets: 2,
      supportOpen: 2,
      cases: 2,
    });

    await pool.query(
      "update public.domain_users set roles=$1::jsonb where id=$2",
      ['["moderator"]', adminId],
    );
    const moderator = await handleApi(request("admin/overview", adminCookie));
    expect(moderator.status).toBe(200);
    expect(overviewSchema.parse(await moderator.json()).data).toEqual({
      pendingApplications: 1,
    });

    await pool.query(
      "update public.domain_users set roles=$1::jsonb where id=$2",
      ['["admin"]', adminId],
    );
    const before = await handleApi(request("admin/overview", adminCookie));
    expect(before.status).toBe(200);
    expect(overviewSchema.parse(await before.json()).data).toEqual({
      openTickets: 2,
      supportOpen: 2,
      cases: 2,
      pendingApplications: 1,
    });
    const first = ids[0];
    if (!first) throw new Error("Expected a pending support case");
    const resolved = await handleApi(
      request("admin/cases/" + first + "/decision", adminCookie, "POST", {
        action: "resolve",
        reason: "The support scheduling question has been resolved",
        version: 1,
      }),
    );
    expect(resolved.status).toBe(200);
    const after = await handleApi(request("admin/overview", adminCookie));
    expect(after.status).toBe(200);
    expect(overviewSchema.parse(await after.json()).data).toEqual({
      openTickets: 1,
      supportOpen: 1,
      cases: 2,
      pendingApplications: 1,
    });
  } finally {
    await pool.query(
      "update public.domain_users set roles=$1::jsonb where id=$2",
      ['["mentee","admin","moderator","support"]', adminId],
    );
  }
});

test("session detail and join authorize both participants without exposing mentor checkout data", async () => {
  for (const [cookie, checkoutUrl, checkoutId] of [
    [
      menteeCookie,
      "https://checkout.stripe.test/private-" + incomingId,
      "cs_" + incomingId,
    ],
    [mentorCookie, null, null],
  ] as const) {
    const result = await handleApi(request("sessions/" + incomingId, cookie));
    expect(result.status).toBe(200);
    expect(
      z.object({ data: bookingSchema }).parse(await result.json()).data,
    ).toMatchObject({ id: incomingId, checkoutUrl, checkoutId });
  }
  expect(
    (await handleApi(request("sessions/" + incomingId, adminCookie))).status,
  ).toBe(404);
  expect((await handleApi(request("sessions/" + incomingId))).status).toBe(401);
  expect(
    (await handleApi(request("orders/" + incomingId, mentorCookie))).status,
  ).toBe(404);
  const joinable = "room-join-" + randomUUID();
  await insertBooking(joinable, menteeId, "demo-mentor", 16);
  const pool = getAuthRuntime().pool;
  try {
    const startsAt = new Date(Date.now() + 5 * 60000);
    await pool.query(
      "update public.bookings set starts_at=$1, ends_at=$2 where id=$3",
      [
        startsAt.toISOString(),
        new Date(startsAt.getTime() + 50 * 60000).toISOString(),
        joinable,
      ],
    );
    for (const cookie of [menteeCookie, mentorCookie]) {
      const joined = await handleApi(
        request("sessions/" + joinable + "/join", cookie, "POST", {}),
      );
      expect(joined.status).toBe(200);
      expect(
        z
          .object({
            data: z.object({ roomUrl: z.string(), demo: z.boolean() }),
          })
          .parse(await joined.json()).data,
      ).toEqual({ roomUrl: "/room/" + joinable, demo: true });
    }
    expect(
      (
        await handleApi(
          request("sessions/" + joinable + "/join", adminCookie, "POST", {}),
        )
      ).status,
    ).toBe(404);
  } finally {
    await pool.query("delete from public.payments where booking_id=$1", [
      joinable,
    ]);
    await pool.query("delete from public.bookings where id=$1", [joinable]);
  }
});
