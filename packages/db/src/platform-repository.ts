import { randomUUID, createHash } from "node:crypto";
import type { EntityManager } from "@mikro-orm/postgresql";
import type {
  Actor,
  Role,
  UserProfile,
  Mentor,
  Booking,
  AvailabilitySlot,
  PlatformRepository,
  Case,
  Message,
  Conversation,
  Review,
  Package,
  PaymentOrder,
  Job,
  Payout,
  AuditEntry,
  AvailabilityRule,
  CalendarException,
  RefundOrder,
  DeadJob,
} from "@devmentor/core";
import {
  DomainError,
  requireRole,
  requireAdministrativeAccess,
  requireParticipant,
  requireVersion,
  money,
  commission,
  assertSlot,
  assertChangeable,
  assertMessage,
  assertReview,
  assertPaymentMode,
  expandAvailability,
  currentBookingPolicyVersion,
} from "@devmentor/core";

const timestampFields = new Set([
  "startsAt",
  "endsAt",
  "expiresAt",
  "createdAt",
  "receivedAt",
]);
function normalizeDto(value: unknown, key = ""): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => normalizeDto(item));
  if (typeof value === "object" && value !== null)
    return Object.fromEntries(
      Object.entries(value).map(([name, item]) => [
        name,
        normalizeDto(item, name),
      ]),
    );
  if (
    typeof value === "string" &&
    timestampFields.has(key) &&
    Number.isFinite(Date.parse(value))
  )
    return new Date(value).toISOString();
  return value;
}

type Sql = {
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
  exec(sql: string, params?: unknown[]): Promise<void>;
};
function sqlFor(em: EntityManager): Sql {
  return {
    async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
      const result: unknown = await em
        .getConnection()
        .execute(sql, params, "all", em.getTransactionContext());
      // PostgreSQL dates become ISO DTOs; bigint remains a decimal string.
      return normalizeDto(result) as T[];
    },
    async exec(sql: string, params: unknown[] = []): Promise<void> {
      await em
        .getConnection()
        .execute(sql, params, "run", em.getTransactionContext());
    },
  };
}
function databaseError(error: unknown): never {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? error.code
      : undefined;
  if (code === "23P01") throw new DomainError("SLOT_TAKEN", 409);
  if (code === "23505") throw new DomainError("ALREADY_EXISTS", 409);
  if (code === "40001" || code === "40P01")
    throw new DomainError("RETRY_CONFLICT", 409);
  throw error;
}
const mentorSelect = `select m.id,m.user_id as "userId",u.name,m.headline,m.bio,m.specialty,m.languages,m.price_minor::text as "priceMinor",m.currency,m.years,coalesce((select avg(rating)::float from reviews r where r.mentor_id=m.id),0) as rating,m.status,m.version from mentor_profiles m join domain_users u on u.id=m.user_id`;
const bookingSelect = `select b.id,b.mentor_id as "mentorId",b.mentee_id as "menteeId",m.user_id as "mentorUserId",b.starts_at as "startsAt",b.ends_at as "endsAt",b.timezone,b.state,b.expires_at as "expiresAt",b.amount_minor::text as "amountMinor",b.fee_minor::text as "feeMinor",b.currency,b.version,b.policy_version as "policyVersion",b.payment_mode as "paymentMode",p.state as "paymentState",coalesce(r.state,'none') as "refundState",p.checkout_url as "checkoutUrl",p.checkout_id as "checkoutId" from bookings b join mentor_profiles m on m.id=b.mentor_id join payments p on p.booking_id=b.id left join refunds r on r.payment_id=p.id`;
const caseSelect = `select id,kind,user_id as "userId",status,payload,decision_reason as "decisionReason",version,created_at as "createdAt" from cases`;
const packageSelect = `select s.id,s.user_id as "userId",s.mentor_id as "mentorId",s.state,s.credits,s.expires_at as "expiresAt",s.auto_renew as "autoRenew",s.version,p.amount_minor::text as "amountMinor",p.currency,p.state as "paymentState",p.checkout_url as "checkoutUrl",p.checkout_id as "checkoutId" from packages s join payments p on p.package_id=s.id`;
const payoutSelect = `select id,user_id as "userId",amount_minor::text as "amountMinor",currency,account_id as "accountId",state,provider_id as "providerId" from payouts`;
async function one<T>(sql: Sql, query: string, params: unknown[]): Promise<T> {
  const [value] = await sql.query<T>(query, params);
  if (!value) throw new DomainError("NOT_FOUND", 404);
  return value;
}
async function booking(sql: Sql, id: string, actor?: Actor): Promise<Booking> {
  const value = await one<Booking>(sql, bookingSelect + " where b.id=?", [id]);
  if (actor) requireParticipant(actor, value);
  return value;
}
async function ownMentor(sql: Sql, actor: Actor): Promise<Mentor> {
  requireRole(actor, ["mentor"]);
  return one<Mentor>(sql, mentorSelect + " where m.user_id=?", [actor.id]);
}
async function job(
  sql: Sql,
  kind: string,
  payload: Record<string, unknown>,
  now: string,
): Promise<void> {
  await sql.exec(
    "insert into outbox_jobs(id,kind,payload,available_at,created_at) values(?,?,?::jsonb,?,?)",
    [randomUUID(), kind, JSON.stringify(payload), now, now],
  );
}
async function audit(
  sql: Sql,
  actor: Actor,
  caseId: string | null,
  action: string,
  reason: string,
  now: string,
  previousStatus: string | null = null,
  newStatus: string | null = null,
): Promise<void> {
  await sql.exec(
    "insert into audit_log(id,actor_id,case_id,action,reason,created_at,request_id,previous_status,new_status) values(?,?,?,?,?,?,?,?,?)",
    [
      randomUUID(),
      actor.id,
      caseId,
      action,
      reason,
      now,
      actor.requestId ?? randomUUID(),
      previousStatus,
      newStatus,
    ],
  );
}
async function idem<T>(
  sql: Sql,
  actor: Actor,
  operation: string,
  key: string,
  input: unknown,
  now: string,
  callback: () => Promise<T>,
): Promise<T> {
  if (!key || key.length > 200)
    throw new DomainError("IDEMPOTENCY_KEY_REQUIRED", 400);
  const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  await sql.query("select pg_advisory_xact_lock(hashtextextended(?,0))", [
    actor.id + ":" + operation + ":" + key,
  ]);
  const [existing] = await sql.query<{ payload_hash: string; result: T }>(
    "select payload_hash,result from idempotency where actor_id=? and operation=? and key=?",
    [actor.id, operation, key],
  );
  if (existing) {
    if (existing.payload_hash !== hash)
      throw new DomainError("IDEMPOTENCY_CONFLICT", 409);
    return existing.result;
  }
  const result = await callback();
  await sql.exec(
    "insert into idempotency(actor_id,operation,key,payload_hash,result,created_at) values(?,?,?,?,?::jsonb,?)",
    [actor.id, operation, key, hash, JSON.stringify(result), now],
  );
  return result;
}
async function expire(
  sql: Sql,
  now: string,
  mentorId?: string,
): Promise<number> {
  const values = await sql.query<{
    id: string;
    checkoutId: string | null;
    userId: string;
  }>(
    `with expired as(update bookings set state='expired',version=version+1 where state='held' and expires_at<=? ${mentorId ? "and mentor_id=?" : ""} returning id,mentee_id) select e.id,e.mentee_id as "userId",p.checkout_id as "checkoutId" from expired e join payments p on p.booking_id=e.id`,
    mentorId ? [now, mentorId] : [now],
  );
  for (const value of values) {
    if (value.checkoutId)
      await job(
        sql,
        "checkout.expire",
        { orderId: value.id, checkoutId: value.checkoutId },
        now,
      );
    await job(
      sql,
      "notification.send",
      { userId: value.userId, template: "hold_expired", bookingId: value.id },
      now,
    );
  }
  return values.length;
}
async function requestRefund(
  sql: Sql,
  paymentId: string,
  providerId: string,
  amountMinor: string,
  currency: string,
  now: string,
  kind: "booking" | "extra_charge" = "booking",
): Promise<boolean> {
  const rows = await sql.query<{ id: string }>(
    "insert into refunds(id,payment_id,amount_minor,state,created_at,provider_payment_id,currency,kind) values(?,?,?,'requested',?,?,?,?) on conflict(payment_id) do nothing returning id",
    [randomUUID(), paymentId, amountMinor, now, providerId, currency, kind],
  );
  if (rows.length)
    await job(
      sql,
      "payment.refund",
      { orderId: paymentId, paymentId: providerId, amountMinor, currency },
      now,
    );
  return rows.length > 0;
}

/** One request/job EntityManager; all transaction helpers use the same fork and pool. */
export function createPlatformRepository(
  em: EntityManager,
): PlatformRepository {
  const read = sqlFor(em);
  async function tx<T>(callback: (sql: Sql) => Promise<T>): Promise<T> {
    try {
      return await em.transactional((manager) => callback(sqlFor(manager)));
    } catch (error) {
      return databaseError(error);
    }
  }
  const repo: PlatformRepository = {
    async ensureUser(input) {
      await read.exec(
        "insert into domain_users(id,name,email,roles,preferences) values(?,?,?,?::jsonb,'{\"notifications\":true}') on conflict(id) do update set email=excluded.email",
        [
          input.id,
          input.name,
          input.email,
          JSON.stringify(input.roles ?? ["mentee"]),
        ],
      );
      // Only a trusted bootstrap caller may assign additional roles.
      if (input.roles)
        await read.exec("update domain_users set roles=?::jsonb where id=?", [
          JSON.stringify(input.roles),
          input.id,
        ]);
      return repo.profile({
        id: input.id,
        roles: input.roles ?? ["mentee"],
        mfaVerified: false,
      });
    },
    async getActor(id, mfaVerified = false) {
      const user = await one<{ roles: Role[] }>(
        read,
        "select roles from domain_users where id=?",
        [id],
      );
      return { id, roles: user.roles, mfaVerified };
    },
    async profile(actor) {
      return one<UserProfile>(
        read,
        `select id,name,email,timezone,roles,preferences,version from domain_users where id=?`,
        [actor.id],
      );
    },
    async updateProfile(actor, input) {
      try {
        new Intl.DateTimeFormat("en", { timeZone: input.timezone });
      } catch {
        throw new DomainError("INVALID_TIMEZONE");
      }
      const rows = await read.query<UserProfile>(
        `update domain_users set name=?,timezone=?,preferences=?::jsonb,version=version+1 where id=? and version=? returning id,name,email,timezone,roles,preferences,version`,
        [
          input.name,
          input.timezone,
          JSON.stringify(input.preferences ?? {}),
          actor.id,
          input.version,
        ],
      );
      if (!rows[0]) throw new DomainError("STALE_VERSION", 409);
      return rows[0];
    },
    async mentors(filter = {}) {
      const conditions = ["m.status='published'"];
      const params: unknown[] = [];
      if (filter.q) {
        conditions.push(
          "(u.name ilike ? or m.headline ilike ? or m.bio ilike ?)",
        );
        params.push(...Array(3).fill("%" + filter.q + "%"));
      }
      if (filter.specialty) {
        conditions.push("lower(m.specialty)=lower(?)");
        params.push(filter.specialty);
      }
      if (filter.language) {
        conditions.push("m.languages @> ?::jsonb");
        params.push(JSON.stringify([filter.language]));
      }
      if (filter.maxPriceMinor) {
        conditions.push("m.price_minor<=?");
        params.push(money(filter.maxPriceMinor).amountMinor);
      }
      const sort = filter.sort ?? "recommended";
      if (!["recommended", "price", "experience"].includes(sort))
        throw new DomainError("INVALID_SORT");
      const sortExpression =
        sort === "price"
          ? '"priceMinor"::bigint'
          : sort === "experience"
            ? "years"
            : "rating";
      const direction = sort === "price" ? "asc" : "desc";
      const predicate: string[] = [];
      if (filter.cursor) {
        let cursor: Record<string, unknown>;
        try {
          const parsed: unknown = JSON.parse(
            Buffer.from(filter.cursor, "base64url").toString("utf8"),
          );
          if (
            typeof parsed !== "object" ||
            parsed === null ||
            Array.isArray(parsed)
          )
            throw new Error();
          cursor = parsed as Record<string, unknown>;
        } catch {
          throw new DomainError("INVALID_CURSOR");
        }
        if (
          cursor.sort !== sort ||
          typeof cursor.id !== "string" ||
          typeof cursor.value !== "string" ||
          !/^\d+(?:\.\d+)?$/.test(cursor.value)
        )
          throw new DomainError("INVALID_CURSOR");
        predicate.push(
          `(${sortExpression} ${direction === "asc" ? ">" : "<"} ? or (${sortExpression} = ? and id>?))`,
        );
        params.push(cursor.value, cursor.value, cursor.id);
      }
      const limit = Math.min(50, Math.max(1, filter.limit ?? 20));
      const data = await read.query<Mentor>(
        "select * from (" +
          mentorSelect +
          " where " +
          conditions.join(" and ") +
          ") listing" +
          (predicate.length ? " where " + predicate.join(" and ") : "") +
          ` order by ${sortExpression} ${direction},id asc limit ?`,
        [...params, limit + 1],
      );
      const last = data[limit - 1];
      const nextCursor =
        data.length > limit && last
          ? Buffer.from(
              JSON.stringify({
                id: last.id,
                sort,
                value: String(
                  sort === "price"
                    ? last.priceMinor
                    : sort === "experience"
                      ? last.years
                      : last.rating,
                ),
              }),
            ).toString("base64url")
          : null;
      return { data: data.slice(0, limit), nextCursor };
    },
    async mentor(id) {
      return one<Mentor>(
        read,
        mentorSelect + " where m.id=? and m.status='published'",
        [id],
      );
    },
    async availability(mentorId, from, to) {
      if (
        !Number.isFinite(Date.parse(from)) ||
        !Number.isFinite(Date.parse(to)) ||
        Date.parse(to) <= Date.parse(from) ||
        Date.parse(to) - Date.parse(from) > 31 * 86400000
      )
        throw new DomainError("INVALID_DATE_RANGE");
      return tx(async (sql) => {
        await one<Mentor>(
          sql,
          mentorSelect +
            " where m.id=? and m.status='published' for share of m",
          [mentorId],
        );
        const rules = await sql.query<AvailabilityRule>(
          `select weekday,to_char(local_time,'HH24:MI') as "localTime",timezone,disambiguation from availability_rules where mentor_id=?`,
          [mentorId],
        );
        const exceptions = await sql.query<CalendarException>(
          `select to_char(local_date,'YYYY-MM-DD') as "localDate",available from availability_exceptions where mentor_id=?`,
          [mentorId],
        );
        for (const slot of expandAvailability(rules, exceptions, from, to))
          await sql.exec(
            "insert into availability_slots(id,mentor_id,starts_at,ends_at,timezone,source,manual_offered,rule_offered) values(?,?,?,?,?,'rule',false,true) on conflict(mentor_id,starts_at) do update set rule_offered=true",
            [randomUUID(), mentorId, slot.startsAt, slot.endsAt, slot.timezone],
          );
        return sql.query<AvailabilitySlot>(
          `select s.id,s.mentor_id as "mentorId",s.starts_at as "startsAt",s.ends_at as "endsAt",s.timezone,not exists(select 1 from bookings b where b.mentor_id=s.mentor_id and b.state in('held','confirmed') and tstzrange(b.starts_at,b.ends_at,'[)') && tstzrange(s.starts_at,s.ends_at,'[)')) as available from availability_slots s where s.mentor_id=? and s.active and s.starts_at>=? and s.ends_at<=? order by s.starts_at,s.id`,
          [mentorId, from, to],
        );
      });
    },
    async reviews(mentorId, cursor) {
      const data = await read.query<Review>(
        `select r.id,r.booking_id as "bookingId",u.name as "authorName",r.rating,r.comment,r.created_at as "createdAt" from reviews r join domain_users u on u.id=r.user_id where r.mentor_id=? and r.id>? order by r.id limit 21`,
        [mentorId, cursor ?? ""],
      );
      return {
        data: data.slice(0, 20),
        nextCursor: data.length > 20 ? (data[19]?.id ?? null) : null,
      };
    },
    async favorites(actor) {
      return read.query<Mentor>(
        mentorSelect +
          " join favorites f on f.mentor_id=m.id where f.user_id=? and m.status='published' order by m.id",
        [actor.id],
      );
    },
    async setFavorite(actor, mentorId, active) {
      requireRole(actor, ["mentee"]);
      await repo.mentor(mentorId);
      if (active)
        await read.exec(
          "insert into favorites(user_id,mentor_id) values(?,?) on conflict do nothing",
          [actor.id, mentorId],
        );
      else
        await read.exec(
          "delete from favorites where user_id=? and mentor_id=?",
          [actor.id, mentorId],
        );
    },
    async goals(actor) {
      const user = await one<{ goals: Record<string, unknown> }>(
        read,
        "select goals from domain_users where id=?",
        [actor.id],
      );
      return {
        goal: "career",
        level: "beginner",
        description: "",
        ...user.goals,
      };
    },
    async saveGoals(actor, input) {
      requireRole(actor, ["mentee"]);
      await tx(async (sql) => {
        await sql.exec("update domain_users set goals=?::jsonb where id=?", [
          JSON.stringify(input),
          actor.id,
        ]);
        await sql.exec(
          "insert into learning_plans(id,user_id,goal,milestones) values(?,?,?,?::jsonb) on conflict(user_id) do update set goal=excluded.goal,version=learning_plans.version+1",
          [
            randomUUID(),
            actor.id,
            String(input.goal ?? "career"),
            JSON.stringify([
              { id: "goal", title: "Określ cel rozwoju", completed: true },
              {
                id: "session",
                title: "Odbądź sesję mentoringową",
                completed: false,
              },
              {
                id: "practice",
                title: "Zastosuj plan w praktyce",
                completed: false,
              },
            ]),
          ],
        );
      });
      return repo.goals(actor);
    },
    async createHold(actor, input, now, id) {
      requireRole(actor, ["mentee"]);
      return tx(async (sql) => {
        await sql.query(
          "select id from mentor_profiles where id=? for update",
          [input.mentorId],
        );
        await expire(sql, now, input.mentorId);
        const mentor = await one<Mentor>(
          sql,
          mentorSelect + " where m.id=? and m.status='published'",
          [input.mentorId],
        );
        if (mentor.userId === actor.id)
          throw new DomainError("OWN_MENTOR_BOOKING");
        const slot = await one<AvailabilitySlot>(
          sql,
          `select id,mentor_id as "mentorId",starts_at as "startsAt",ends_at as "endsAt",timezone,true as available from availability_slots where id=? and mentor_id=? and active`,
          [input.slotId, mentor.id],
        );
        assertSlot(slot.startsAt, slot.endsAt, slot.timezone, new Date(now));
        const expiresAt = new Date(Date.parse(now) + 15 * 60000).toISOString();
        await sql.exec(
          "insert into bookings(id,mentor_id,mentee_id,starts_at,ends_at,timezone,state,expires_at,amount_minor,fee_minor,currency,policy_version,created_at) values(?,?,?,?,?,?,'held',?,?,?,?,?,?)",
          [
            id,
            mentor.id,
            actor.id,
            slot.startsAt,
            slot.endsAt,
            slot.timezone,
            expiresAt,
            mentor.priceMinor,
            commission(mentor.priceMinor),
            mentor.currency,
            currentBookingPolicyVersion,
            now,
          ],
        );
        await sql.exec(
          "insert into payments(id,booking_id,amount_minor,currency,created_at) values(?,?,?,?,?)",
          [id, id, mentor.priceMinor, mentor.currency, now],
        );
        return booking(sql, id, actor);
      });
    },
    async checkout(actor, input, key, now) {
      return tx((sql) =>
        idem(sql, actor, "checkout", key, input, now, async () => {
          // Read only after the row lock: an expiry or another checkout may have committed while waiting.
          await sql.query("select id from bookings where id=? for update", [
            input.holdId,
          ]);
          const current = await booking(sql, input.holdId, actor);
          const funding = await one<{ mode: string | null }>(
            sql,
            `select checkout_mode as mode from payments where id=? for update`,
            [current.id],
          );
          assertPaymentMode(funding.mode, input.paymentMode);
          if (current.menteeId !== actor.id)
            throw new DomainError("NOT_FOUND", 404);
          if (
            current.state !== "held" ||
            Date.parse(current.expiresAt) <= Date.parse(now)
          )
            throw new DomainError("HOLD_EXPIRED", 409);
          if (input.acceptedPolicyVersion !== current.policyVersion)
            throw new DomainError("POLICY_REQUIRED");
          await sql.exec("update payments set checkout_mode=? where id=?", [
            input.paymentMode,
            current.id,
          ]);
          if (input.paymentMode === "credit") {
            const [pack] = await sql.query<{ id: string; amountMinor: string }>(
              `select s.id,p.amount_minor::text as "amountMinor" from packages s join payments p on p.package_id=s.id where s.user_id=? and s.mentor_id=? and s.credits>0 and s.state in('active','paused','cancelled') and s.expires_at>? and p.state='paid' order by s.expires_at,s.id for update of s skip locked limit 1`,
              [actor.id, current.mentorId, now],
            );
            if (!pack) throw new DomainError("NO_CREDITS");
            await sql.exec(
              "update packages set credits=credits-1,version=version+1 where id=?",
              [pack.id],
            );
            await sql.exec(
              "insert into credit_ledger(id,package_id,booking_id,reference,kind,delta,created_at) values(?,?,?,?,'use',-1,?)",
              [randomUUID(), pack.id, current.id, current.id, now],
            );
            const creditAmount = (BigInt(pack.amountMinor) / 4n).toString();
            await sql.exec(
              "update bookings set state='confirmed',payment_mode='credit',amount_minor=?,fee_minor=?,version=version+1 where id=?",
              [creditAmount, commission(creditAmount), current.id],
            );
            await sql.exec("update payments set amount_minor=? where id=?", [
              creditAmount,
              current.id,
            ]);
            await sql.exec("update payments set state='paid' where id=?", [
              current.id,
            ]);
            await job(
              sql,
              "notification.send",
              {
                userId: actor.id,
                template: "booking_confirmed",
                bookingId: current.id,
              },
              now,
            );
          } else {
            await job(sql, "checkout.start", { orderId: current.id }, now);
          }
          return booking(sql, current.id, actor);
        }),
      );
    },
    async booking(actor, id) {
      return booking(read, id, actor);
    },
    async bookings(actor) {
      return read.query<Booking>(
        bookingSelect +
          " where b.mentee_id=? or m.user_id=? order by b.starts_at desc,b.id",
        [actor.id, actor.id],
      );
    },
    async cancel(actor, id, reason, version, key, now) {
      return tx((sql) =>
        idem(
          sql,
          actor,
          "cancel",
          key,
          { id, reason, version },
          now,
          async () => {
            await sql.query("select id from bookings where id=? for update", [
              id,
            ]);
            const current = await booking(sql, id, actor);
            requireVersion(current.version, version);
            assertChangeable(current, new Date(now));
            await sql.exec(
              "update bookings set state='cancelled',version=version+1 where id=?",
              [id],
            );
            if (current.paymentMode === "credit") {
              const credit = await one<{ package_id: string }>(
                sql,
                "select package_id from credit_ledger where booking_id=? and kind='use'",
                [id],
              );
              const inserted = await sql.query(
                "insert into credit_ledger(id,package_id,booking_id,reference,kind,delta,created_at) values(?,?,?,?,'return',1,?) on conflict(reference,kind) do nothing returning id",
                [randomUUID(), credit.package_id, id, id, now],
              );
              if (inserted.length)
                await sql.exec(
                  "update packages set credits=credits+1,version=version+1 where id=?",
                  [credit.package_id],
                );
            } else {
              const payment = await one<{ provider_payment_id: string }>(
                sql,
                "select provider_payment_id from payments where id=?",
                [id],
              );
              await requestRefund(
                sql,
                id,
                payment.provider_payment_id,
                current.amountMinor,
                current.currency,
                now,
              );
            }
            await audit(
              sql,
              actor,
              null,
              "booking.cancel",
              reason,
              now,
              current.state,
              "cancelled",
            );
            await job(
              sql,
              "notification.send",
              {
                userId: current.menteeId,
                template: "booking_cancelled",
                bookingId: id,
              },
              now,
            );
            return booking(sql, id, actor);
          },
        ),
      );
    },
    async reschedule(actor, id, slotId, version, now) {
      const previous = await booking(read, id, actor);
      return tx(async (sql) => {
        await sql.query(
          "select id from mentor_profiles where id=? for update",
          [previous.mentorId],
        );
        await sql.query("select id from bookings where id=? for update", [id]);
        const current = await booking(sql, id, actor);
        requireVersion(current.version, version);
        assertChangeable(current, new Date(now));
        const slot = await one<AvailabilitySlot>(
          sql,
          `select id,mentor_id as "mentorId",starts_at as "startsAt",ends_at as "endsAt",timezone,true as available from availability_slots where id=? and mentor_id=? and active`,
          [slotId, current.mentorId],
        );
        assertSlot(slot.startsAt, slot.endsAt, slot.timezone, new Date(now));
        await expire(sql, now, current.mentorId);
        await sql.exec(
          "update bookings set starts_at=?,ends_at=?,timezone=?,version=version+1 where id=?",
          [slot.startsAt, slot.endsAt, slot.timezone, id],
        );
        await job(
          sql,
          "notification.send",
          {
            userId: current.menteeId,
            template: "booking_rescheduled",
            bookingId: id,
          },
          now,
        );
        return booking(sql, id, actor);
      });
    },
    async complete(actor, id, now) {
      return tx(async (sql) => {
        await sql.query("select id from bookings where id=? for update", [id]);
        const current = await booking(sql, id, actor);
        if (current.mentorUserId !== actor.id)
          throw new DomainError("FORBIDDEN", 403);
        if (Date.parse(current.endsAt) > Date.parse(now))
          throw new DomainError("SESSION_NOT_ENDED");
        if (current.state !== "confirmed")
          throw new DomainError("INVALID_BOOKING_STATE", 409);
        await sql.exec(
          "update bookings set state='completed',version=version+1 where id=?",
          [id],
        );
        return booking(sql, id, actor);
      });
    },
    async saveNote(actor, id, note) {
      await booking(read, id, actor);
      if (note.length > 2000) throw new DomainError("INVALID_NOTE");
      await read.exec(
        "insert into private_notes(booking_id,user_id,note) values(?,?,?) on conflict(booking_id,user_id) do update set note=excluded.note",
        [id, actor.id, note],
      );
    },
    async note(actor, id) {
      await booking(read, id, actor);
      const [value] = await read.query<{ note: string }>(
        "select note from private_notes where booking_id=? and user_id=?",
        [id, actor.id],
      );
      return value?.note ?? "";
    },
    async addReview(actor, id, rating, comment, now) {
      return tx(async (sql) => {
        const current = await booking(sql, id, actor);
        if (current.menteeId !== actor.id)
          throw new DomainError("NOT_FOUND", 404);
        if (current.state !== "completed")
          throw new DomainError("NOT_COMPLETED");
        assertReview(rating, comment);
        const reviewId = randomUUID();
        await sql.exec(
          "insert into reviews(id,booking_id,mentor_id,user_id,rating,comment,created_at) values(?,?,?,?,?,?,?)",
          [reviewId, id, current.mentorId, actor.id, rating, comment, now],
        );
        return one<Review>(
          sql,
          `select r.id,r.booking_id as "bookingId",u.name as "authorName",r.rating,r.comment,r.created_at as "createdAt" from reviews r join domain_users u on u.id=r.user_id where r.id=?`,
          [reviewId],
        );
      });
    },

    async conversations(actor) {
      return read.query<Conversation>(
        `select c.id,c.mentor_id as "mentorId",c.mentee_id as "menteeId",m.user_id as "mentorUserId",u.name as "mentorName" from conversations c join mentor_profiles m on m.id=c.mentor_id join domain_users u on u.id=m.user_id where c.mentee_id=? or m.user_id=? order by c.created_at desc,c.id`,
        [actor.id, actor.id],
      );
    },
    async conversation(actor, mentorId) {
      requireRole(actor, ["mentee"]);
      const mentor = await repo.mentor(mentorId);
      if (mentor.userId === actor.id) throw new DomainError("OWN_CONVERSATION");
      await read.exec(
        "insert into conversations(id,mentor_id,mentee_id,created_at) values(?,?,?,?) on conflict(mentor_id,mentee_id) do nothing",
        [randomUUID(), mentorId, actor.id, new Date().toISOString()],
      );
      return one<Conversation>(
        read,
        `select c.id,c.mentor_id as "mentorId",c.mentee_id as "menteeId",m.user_id as "mentorUserId",u.name as "mentorName" from conversations c join mentor_profiles m on m.id=c.mentor_id join domain_users u on u.id=m.user_id where c.mentor_id=? and c.mentee_id=?`,
        [mentorId, actor.id],
      );
    },
    async messages(actor, id, cursor) {
      const thread = await one<{ menteeId: string; mentorUserId: string }>(
        read,
        `select c.mentee_id as "menteeId",m.user_id as "mentorUserId" from conversations c join mentor_profiles m on m.id=c.mentor_id where c.id=?`,
        [id],
      );
      requireParticipant(actor, thread);
      let boundary = "";
      const params: unknown[] = [id];
      if (cursor) {
        const previous = await one<{ createdAt: string; id: string }>(
          read,
          `select id,created_at as "createdAt" from messages where id=? and conversation_id=?`,
          [cursor, id],
        );
        boundary = " and (created_at,id) < (?::timestamptz,?)";
        params.push(previous.createdAt, previous.id);
      }
      const values = await read.query<Message>(
        `select id,conversation_id as "conversationId",sender_id as "senderId",text,created_at as "createdAt" from messages where conversation_id=?` +
          boundary +
          " order by created_at desc,id desc limit 21",
        params,
      );
      return {
        data: values.slice(0, 20).reverse(),
        nextCursor: values.length > 20 ? (values[19]?.id ?? null) : null,
      };
    },
    async sendMessage(actor, id, text, clientMessageId, now) {
      assertMessage(text);
      const thread = await one<{ menteeId: string; mentorUserId: string }>(
        read,
        `select c.mentee_id as "menteeId",m.user_id as "mentorUserId" from conversations c join mentor_profiles m on m.id=c.mentor_id where c.id=?`,
        [id],
      );
      requireParticipant(actor, thread);
      if (!clientMessageId || clientMessageId.length > 200)
        throw new DomainError("INVALID_MESSAGE_ID");
      return tx(async (sql) => {
        await sql.query("select pg_advisory_xact_lock(hashtextextended(?,0))", [
          id + ":" + actor.id + ":" + clientMessageId,
        ]);
        const [previous] = await sql.query<Message>(
          `select id,conversation_id as "conversationId",sender_id as "senderId",text,created_at as "createdAt" from messages where conversation_id=? and sender_id=? and client_message_id=?`,
          [id, actor.id, clientMessageId],
        );
        if (previous) {
          if (previous.text !== text)
            throw new DomainError("IDEMPOTENCY_CONFLICT", 409);
          return previous;
        }
        const messageId = randomUUID();
        await sql.exec(
          "insert into messages(id,conversation_id,sender_id,text,client_message_id,created_at) values(?,?,?,?,?,?)",
          [messageId, id, actor.id, text, clientMessageId, now],
        );
        return {
          id: messageId,
          conversationId: id,
          senderId: actor.id,
          text,
          createdAt: now,
        };
      });
    },
    async learningPlan(actor) {
      const [plan] = await read.query<Record<string, unknown>>(
        `select id,goal,milestones,version from learning_plans where user_id=?`,
        [actor.id],
      );
      return plan ?? { id: "", goal: "", milestones: [], version: 1 };
    },
    async saveMilestone(actor, milestoneId, completed, version) {
      return tx(async (sql) => {
        const plan = await one<{
          id: string;
          goal: string;
          milestones: { id: string; title: string; completed: boolean }[];
          version: number;
        }>(
          sql,
          "select id,goal,milestones,version from learning_plans where user_id=? for update",
          [actor.id],
        );
        requireVersion(plan.version, version);
        if (!plan.milestones.some((item) => item.id === milestoneId))
          throw new DomainError("NOT_FOUND", 404);
        const milestones = plan.milestones.map((item) =>
          item.id === milestoneId ? { ...item, completed } : item,
        );
        await sql.exec(
          "update learning_plans set milestones=?::jsonb,version=version+1 where id=?",
          [JSON.stringify(milestones), plan.id],
        );
        return { ...plan, milestones, version: version + 1 };
      });
    },
    async packages(actor) {
      return read.query<Package>(
        packageSelect + " where s.user_id=? order by s.created_at desc,s.id",
        [actor.id],
      );
    },
    async buyPackage(actor, mentorId, key, now) {
      requireRole(actor, ["mentee"]);
      return tx((sql) =>
        idem(sql, actor, "package", key, { mentorId }, now, async () => {
          const mentor = await one<Mentor>(
            sql,
            mentorSelect + " where m.id=? and m.status='published'",
            [mentorId],
          );
          const previous = await sql.query(
            "select id from bookings where mentee_id=? and mentor_id=? and state='completed' limit 1",
            [actor.id, mentorId],
          );
          if (!previous.length) throw new DomainError("FIRST_SESSION_REQUIRED");
          const id = randomUUID();
          const amountMinor = (BigInt(mentor.priceMinor) * 4n).toString();
          const expiresAt = new Date(
            Date.parse(now) + 90 * 86400000,
          ).toISOString();
          await sql.exec(
            "insert into packages(id,user_id,mentor_id,state,credits,expires_at,created_at) values(?,?,?,'pending',0,?,?)",
            [id, actor.id, mentorId, expiresAt, now],
          );
          await sql.exec(
            "insert into payments(id,package_id,amount_minor,currency,created_at) values(?,?,?,?,?)",
            [id, id, amountMinor, mentor.currency, now],
          );
          await job(sql, "checkout.start", { orderId: id }, now);
          return one<Package>(sql, packageSelect + " where s.id=?", [id]);
        }),
      );
    },
    async updatePackage(actor, id, action, version) {
      return tx(async (sql) => {
        const pack = await one<Package>(
          sql,
          packageSelect + " where s.id=? and s.user_id=? for update of s",
          [id, actor.id],
        );
        requireVersion(pack.version, version);
        if (pack.paymentState !== "paid")
          throw new DomainError("PACKAGE_NOT_PAID");
        const states: Record<string, string> = {
          pause: "paused",
          resume: "active",
          cancel: "cancelled",
        };
        const state = states[action];
        if (!state) throw new DomainError("INVALID_PACKAGE_ACTION");
        if (pack.state === "cancelled" || pack.state === "expired")
          throw new DomainError("INVALID_PACKAGE_STATE", 409);
        await sql.exec(
          "update packages set state=?,auto_renew=false,version=version+1 where id=?",
          [state, id],
        );
        return one<Package>(sql, packageSelect + " where s.id=?", [id]);
      });
    },
    async applyMentor(actor, input) {
      return tx(async (sql) => {
        const existing = await sql.query(
          "select id from mentor_profiles where user_id=?",
          [actor.id],
        );
        if (existing.length)
          throw new DomainError("MENTOR_ALREADY_EXISTS", 409);
        money(input.priceMinor);
        if (
          BigInt(input.priceMinor) < 5000n ||
          BigInt(input.priceMinor) > 50000n ||
          input.years < 1 ||
          input.years > 40 ||
          input.bio.length < 50 ||
          input.bio.length > 1000 ||
          input.headline.length < 10 ||
          input.headline.length > 100
        )
          throw new DomainError("INVALID_MENTOR_PROFILE");
        const id = randomUUID();
        await sql.exec(
          "insert into cases(id,kind,user_id,status,payload,created_at) values(?,'mentor_application',?,'pending',?::jsonb,?)",
          [id, actor.id, JSON.stringify(input), new Date().toISOString()],
        );
        return one<Case>(sql, caseSelect + " where id=?", [id]);
      });
    },
    async ownApplication(actor) {
      const [value] = await read.query<Case>(
        caseSelect +
          " where kind='mentor_application' and user_id=? order by created_at desc,id desc limit 1",
        [actor.id],
      );
      return value ?? null;
    },
    async ownMentor(actor) {
      return ownMentor(read, actor);
    },
    async saveMentor(actor, input) {
      return tx(async (sql) => {
        const mentor = await ownMentor(sql, actor);
        requireVersion(mentor.version, input.version ?? 0);
        money(input.priceMinor);
        if (
          BigInt(input.priceMinor) < 5000n ||
          BigInt(input.priceMinor) > 50000n ||
          input.bio.length < 50 ||
          input.headline.length < 10
        )
          throw new DomainError("INVALID_MENTOR_PROFILE");
        // PostgreSQL rechecks the version predicate after a concurrent updater releases the row lock.
        const updated = await sql.query<{ id: string }>(
          "update mentor_profiles set headline=?,bio=?,specialty=?,languages=?::jsonb,price_minor=?,years=?,version=version+1 where id=? and version=? returning id",
          [
            input.headline,
            input.bio,
            input.specialty,
            JSON.stringify(input.languages),
            input.priceMinor,
            input.years,
            mentor.id,
            mentor.version,
          ],
        );
        if (!updated.length) throw new DomainError("STALE_VERSION", 409);
        return one<Mentor>(sql, mentorSelect + " where m.id=?", [mentor.id]);
      });
    },
    async availabilityRules(actor) {
      const mentor = await ownMentor(read, actor);
      const rules = await read.query<AvailabilityRule>(
        `select weekday,to_char(local_time,'HH24:MI') as "localTime",timezone,disambiguation from availability_rules where mentor_id=? order by weekday,local_time`,
        [mentor.id],
      );
      const exceptions = await read.query<CalendarException>(
        `select to_char(local_date,'YYYY-MM-DD') as "localDate",available from availability_exceptions where mentor_id=? order by local_date`,
        [mentor.id],
      );
      return { rules, exceptions };
    },
    async saveAvailabilityRules(actor, rules, exceptions) {
      return tx(async (sql) => {
        const mentor = await ownMentor(sql, actor);
        await sql.query(
          "select id from mentor_profiles where id=? for update",
          [mentor.id],
        );
        if (rules.length > 35 || exceptions.length > 366)
          throw new DomainError("TOO_MANY_RULES");
        const now = new Date();
        expandAvailability(
          rules,
          exceptions,
          now.toISOString(),
          new Date(now.getTime() + 31 * 86400000).toISOString(),
        );
        for (const exception of exceptions)
          if (
            !/^\d{4}-\d{2}-\d{2}$/.test(exception.localDate) ||
            !Number.isFinite(Date.parse(exception.localDate))
          )
            throw new DomainError("INVALID_CALENDAR_EXCEPTION");
        await sql.exec("delete from availability_rules where mentor_id=?", [
          mentor.id,
        ]);
        await sql.exec(
          "delete from availability_exceptions where mentor_id=?",
          [mentor.id],
        );
        for (const rule of rules)
          await sql.exec(
            "insert into availability_rules(id,mentor_id,weekday,local_time,timezone,disambiguation) values(?,?,?,?,?,?)",
            [
              randomUUID(),
              mentor.id,
              rule.weekday,
              rule.localTime,
              rule.timezone,
              rule.disambiguation ?? "reject",
            ],
          );
        for (const exception of exceptions)
          await sql.exec(
            "insert into availability_exceptions(id,mentor_id,local_date,available) values(?,?,?,?)",
            [randomUUID(), mentor.id, exception.localDate, exception.available],
          );
        // Retire rule offers without deleting immutable booking/slot history or independent manual offers.
        await sql.exec(
          "update availability_slots set rule_offered=false where mentor_id=?",
          [mentor.id],
        );
        return { rules, exceptions };
      });
    },
    async saveAvailability(actor, slots) {
      return tx(async (sql) => {
        const mentor = await ownMentor(sql, actor);
        await sql.query(
          "select id from mentor_profiles where id=? for update",
          [mentor.id],
        );
        if (slots.length > 100) throw new DomainError("TOO_MANY_SLOTS");
        const sorted = [...slots].sort(
          (a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt),
        );
        for (let index = 0; index < sorted.length; index++) {
          const slot = sorted[index];
          if (!slot) continue;
          assertSlot(slot.startsAt, slot.endsAt, slot.timezone, new Date());
          const previous = sorted[index - 1];
          if (
            previous &&
            Date.parse(previous.endsAt) > Date.parse(slot.startsAt)
          )
            throw new DomainError("OVERLAPPING_AVAILABILITY");
        }
        const active = await sql.query<{ startsAt: string; endsAt: string }>(
          `select b.starts_at as "startsAt",b.ends_at as "endsAt" from bookings b join availability_slots s on s.mentor_id=b.mentor_id and s.starts_at=b.starts_at and s.ends_at=b.ends_at where b.mentor_id=? and s.manual_offered and b.state in('held','confirmed') and b.ends_at>now()`,
          [mentor.id],
        );
        for (const occupied of active)
          if (
            !slots.some(
              (slot) =>
                Date.parse(slot.startsAt) === Date.parse(occupied.startsAt) &&
                Date.parse(slot.endsAt) === Date.parse(occupied.endsAt),
            )
          )
            throw new DomainError("BOOKED_SLOT", 409);
        await sql.exec(
          "update availability_slots set manual_offered=false where mentor_id=?",
          [mentor.id],
        );
        for (const slot of slots)
          await sql.exec(
            "insert into availability_slots(id,mentor_id,starts_at,ends_at,timezone) values(?,?,?,?,?) on conflict(mentor_id,starts_at) do update set manual_offered=true",
            [
              randomUUID(),
              mentor.id,
              slot.startsAt,
              slot.endsAt,
              slot.timezone,
            ],
          );
        return sql.query<AvailabilitySlot>(
          `select s.id,s.mentor_id as "mentorId",s.starts_at as "startsAt",s.ends_at as "endsAt",s.timezone,not exists(select 1 from bookings b where b.mentor_id=s.mentor_id and b.state in('held','confirmed') and tstzrange(b.starts_at,b.ends_at,'[)') && tstzrange(s.starts_at,s.ends_at,'[)')) as available from availability_slots s where s.mentor_id=? and s.active order by s.starts_at`,
          [mentor.id],
        );
      });
    },
    async earnings(actor) {
      const mentor = await ownMentor(read, actor);
      const totals = await one<{
        grossMinor: string;
        feeMinor: string;
        netMinor: string;
        settledMinor: string;
      }>(
        read,
        `select coalesce(sum(b.amount_minor),0)::text as "grossMinor",coalesce(sum(b.fee_minor),0)::text as "feeMinor",coalesce(sum(b.amount_minor-b.fee_minor),0)::text as "netMinor",coalesce(sum(case when b.ends_at<=now()-interval '7 days' and not exists(select 1 from refunds r where r.payment_id=p.id and r.kind='booking') and not exists(select 1 from cases c where c.kind='support' and c.status='pending' and c.payload->>'sessionId'=b.id) then b.amount_minor-b.fee_minor else 0 end),0)::text as "settledMinor" from bookings b join payments p on p.booking_id=b.id where b.mentor_id=? and b.state='completed' and p.state='paid'`,
        [mentor.id],
      );
      const payouts = await read.query<Payout>(
        payoutSelect + " where user_id=? order by created_at desc",
        [actor.id],
      );
      const reserved = payouts
        .filter((item) => item.state !== "failed")
        .reduce((sum, item) => sum + BigInt(item.amountMinor), 0n);
      const available = BigInt(totals.settledMinor) - reserved;
      return {
        ...totals,
        availableMinor: (available > 0n ? available : 0n).toString(),
        payouts,
        connectAccount: await repo.connectAccount(actor),
      };
    },
    async payout(actor, amountMinor, key, now) {
      requireRole(actor, ["mentor"]);
      money(amountMinor);
      if (BigInt(amountMinor) <= 0n) throw new DomainError("INVALID_MONEY");
      return tx((sql) =>
        idem(sql, actor, "payout", key, { amountMinor }, now, async () => {
          await sql.query("select id from domain_users where id=? for update", [
            actor.id,
          ]);
          const account = await one<{
            accountId: string | null;
            ready: boolean;
          }>(
            sql,
            `select connect_account_id as "accountId",connect_ready as ready from domain_users where id=?`,
            [actor.id],
          );
          if (!account.ready || !account.accountId)
            throw new DomainError("KYC_REQUIRED");
          const mentor = await ownMentor(sql, actor);
          const balance = await one<{ available: string }>(
            sql,
            `select (coalesce((select sum(b.amount_minor-b.fee_minor) from bookings b join payments p on p.booking_id=b.id where b.mentor_id=? and b.state='completed' and p.state='paid' and b.ends_at<=?::timestamptz-interval '7 days' and not exists(select 1 from refunds r where r.payment_id=p.id and r.kind='booking') and not exists(select 1 from cases c where c.kind='support' and c.status='pending' and c.payload->>'sessionId'=b.id)),0)-coalesce((select sum(amount_minor) from payouts where user_id=? and state in('pending','succeeded')),0))::text as available`,
            [mentor.id, now, actor.id],
          );
          if (BigInt(balance.available) < BigInt(amountMinor))
            throw new DomainError("INSUFFICIENT_BALANCE");
          const id = randomUUID();
          await sql.exec(
            "insert into payouts(id,user_id,amount_minor,currency,account_id,created_at) values(?,?,?,'PLN',?,?)",
            [id, actor.id, amountMinor, account.accountId, now],
          );
          await job(
            sql,
            "payout.send",
            {
              payoutId: id,
              accountId: account.accountId,
              amountMinor,
              currency: "PLN",
            },
            now,
          );
          return one<Payout>(sql, payoutSelect + " where id=?", [id]);
        }),
      );
    },
    async completePayout(payoutId, providerId, success) {
      await read.exec(
        "update payouts set state=?,provider_id=? where id=? and state='pending'",
        [success ? "succeeded" : "failed", providerId, payoutId],
      );
    },
    async markRefundResult(orderId, providerId, success) {
      await read.exec(
        "update refunds set state=?,provider_id=? where payment_id=? and state<>'succeeded'",
        [success ? "succeeded" : "failed", providerId, orderId],
      );
    },
    async support(actor, category, description, sessionId) {
      if (description.trim().length < 20 || description.length > 2000)
        throw new DomainError("INVALID_DESCRIPTION");
      if (sessionId) await booking(read, sessionId, actor);
      const id = randomUUID();
      await read.exec(
        "insert into cases(id,kind,user_id,payload,created_at) values(?,'support',?,?::jsonb,?)",
        [
          id,
          actor.id,
          JSON.stringify({
            category,
            description,
            ...(sessionId ? { sessionId } : {}),
          }),
          new Date().toISOString(),
        ],
      );
      return one<Case>(read, caseSelect + " where id=?", [id]);
    },
    async ownCases(actor) {
      return read.query<Case>(
        caseSelect + " where user_id=? order by created_at desc,id",
        [actor.id],
      );
    },
    async adminCases(actor, kind) {
      requireAdministrativeAccess(actor, ["admin", "moderator", "support"]);
      let condition = "";
      const params: unknown[] = [];
      if (kind) {
        if (kind !== "mentor_application" && kind !== "support")
          throw new DomainError("INVALID_CASE_KIND");
        requireRole(
          actor,
          kind === "mentor_application"
            ? ["admin", "moderator"]
            : ["admin", "support"],
        );
        condition = " where kind=?";
        params.push(kind);
      } else if (!actor.roles.includes("admin")) {
        const permitted = actor.roles.includes("moderator")
          ? "mentor_application"
          : "support";
        condition = " where kind=?";
        params.push(permitted);
      }
      return read.query<Case>(
        caseSelect + condition + " order by created_at desc,id",
        params,
      );
    },
    async caseDetail(actor, id) {
      const item = await one<Case>(read, caseSelect + " where id=?", [id]);
      if (item.userId !== actor.id)
        requireAdministrativeAccess(
          actor,
          item.kind === "mentor_application"
            ? ["admin", "moderator"]
            : ["admin", "support"],
        );
      const auditEntries = await read.query<AuditEntry>(
        `select id,actor_id as "actorId",case_id as "caseId",action,reason,created_at as "createdAt",request_id as "requestId",previous_status as "previousStatus",new_status as "newStatus" from audit_log where case_id=? order by created_at,id`,
        [id],
      );
      return { item, audit: auditEntries };
    },
    async decideCase(actor, id, action, reason, version, now) {
      return tx(async (sql) => {
        const item = await one<Case>(
          sql,
          caseSelect + " where id=? for update",
          [id],
        );
        requireAdministrativeAccess(
          actor,
          item.kind === "mentor_application"
            ? ["admin", "moderator"]
            : ["admin", "support"],
        );
        requireVersion(item.version, version);
        if (item.status !== "pending") throw new DomainError("STALE_CASE", 409);
        if (reason.trim().length < 10 || reason.length > 1000)
          throw new DomainError("INVALID_REASON");
        let status: string;
        if (item.kind === "mentor_application") {
          if (action !== "approve" && action !== "reject")
            throw new DomainError("INVALID_DECISION");
          status = action === "approve" ? "approved" : "rejected";
          if (action === "approve") {
            const data = item.payload;
            await sql.exec(
              "insert into mentor_profiles(id,user_id,headline,bio,specialty,languages,price_minor,years,status) values(?,?,?,?,?,?::jsonb,?,?,'published')",
              [
                randomUUID(),
                item.userId,
                String(data.headline),
                String(data.bio),
                String(data.specialty),
                JSON.stringify(data.languages),
                String(data.priceMinor),
                Number(data.years),
              ],
            );
            await sql.exec(
              "update domain_users set roles=case when roles @> '[\"mentor\"]'::jsonb then roles else roles || '[\"mentor\"]'::jsonb end where id=?",
              [item.userId],
            );
          }
        } else {
          if (action !== "resolve") throw new DomainError("INVALID_DECISION");
          status = "resolved";
        }
        await sql.exec(
          "update cases set status=?,decision_reason=?,version=version+1 where id=?",
          [status, reason, id],
        );
        await audit(
          sql,
          actor,
          id,
          "case." + action,
          reason,
          now,
          item.status,
          status,
        );
        await job(
          sql,
          "notification.send",
          { userId: item.userId, template: "case_decided", caseId: id },
          now,
        );
        return one<Case>(sql, caseSelect + " where id=?", [id]);
      });
    },

    async acceptPaymentEvent(event, now) {
      return tx(async (sql) => {
        const inserted = await sql.query(
          "insert into inbox(id,provider,event_id,payload,received_at) values(?,?,?,?::jsonb,?) on conflict(provider,event_id) do nothing returning id",
          [
            randomUUID(),
            event.provider,
            event.eventId,
            JSON.stringify(event),
            now,
          ],
        );
        if (!inserted.length) return false;
        await job(sql, "payment.process", { event }, now);
        return true;
      });
    },
    async processPaymentEvent(event, now) {
      return tx(async (sql) => {
        await sql.query("select id from bookings where id=? for update", [
          event.bookingId,
        ]);
        const payment = await one<{
          id: string;
          bookingId: string | null;
          packageId: string | null;
          amountMinor: string;
          currency: string;
          state: string;
          settlementMode: string | null;
          providerPaymentId: string | null;
        }>(
          sql,
          `select id,booking_id as "bookingId",package_id as "packageId",amount_minor::text as "amountMinor",currency,state,(select payment_mode from bookings where id=payments.booking_id) as "settlementMode",provider_payment_id as "providerPaymentId" from payments where id=? for update`,
          [event.bookingId],
        );
        const amount = money(event.amountMinor, event.currency);
        if (
          event.status === "refund_succeeded" ||
          event.status === "refund_failed"
        ) {
          const refund = await one<{
            amountMinor: string;
            currency: string;
            paymentId: string | null;
          }>(
            sql,
            `select amount_minor::text as "amountMinor",currency,provider_payment_id as "paymentId" from refunds where payment_id=? for update`,
            [payment.id],
          );
          if (
            refund.amountMinor !== amount.amountMinor ||
            refund.currency !== amount.currency ||
            (refund.paymentId !== null && refund.paymentId !== event.paymentId)
          )
            throw new DomainError("PAYMENT_MISMATCH", 409);
          await sql.exec(
            "update refunds set state=?,provider_id=? where payment_id=? and state<>'succeeded'",
            [
              event.status === "refund_succeeded" ? "succeeded" : "failed",
              event.refundId ?? event.paymentId,
              payment.id,
            ],
          );
          return;
        }
        // Repair a charge from an already-open legacy PSP checkout after a credit settlement.
        // The verified provider charge has its own refund snapshot; it never consumes another credit.
        if (
          payment.state === "paid" &&
          payment.bookingId &&
          payment.settlementMode === "credit" &&
          payment.providerPaymentId === null
        ) {
          if (event.status === "paid") {
            const requested = await requestRefund(
              sql,
              payment.id,
              event.paymentId,
              amount.amountMinor,
              amount.currency,
              now,
              "extra_charge",
            );
            if (requested) {
              const current = await booking(sql, payment.id);
              await job(
                sql,
                "notification.send",
                {
                  userId: current.menteeId,
                  template: "extra_charge_refund",
                  bookingId: payment.id,
                },
                now,
              );
            }
          }
          return;
        }
        if (
          payment.amountMinor !== amount.amountMinor ||
          payment.currency !== amount.currency
        )
          throw new DomainError("PAYMENT_MISMATCH", 409);
        if (payment.state === "paid") return;
        if (event.status === "failed") {
          await sql.exec(
            "update payments set state='failed' where id=? and state<>'paid'",
            [payment.id],
          );
          return;
        }
        await sql.exec(
          "update payments set state='paid',provider_payment_id=?,checkout_mode=coalesce(checkout_mode,'psp') where id=?",
          [event.paymentId, payment.id],
        );
        if (payment.packageId) {
          const pack = await one<{ userId: string; mentorId: string }>(
            sql,
            `select user_id as "userId",mentor_id as "mentorId" from packages where id=? for update`,
            [payment.packageId],
          );
          const ledger = await sql.query(
            "insert into credit_ledger(id,package_id,reference,kind,delta,created_at) values(?,?,?,'purchase',4,?) on conflict(reference,kind) do nothing returning id",
            [randomUUID(), payment.packageId, payment.id, now],
          );
          if (ledger.length)
            await sql.exec(
              "update packages set state='active',credits=credits+4,version=version+1,expires_at=? where id=?",
              [
                new Date(Date.parse(now) + 90 * 86400000).toISOString(),
                payment.packageId,
              ],
            );
          await job(
            sql,
            "notification.send",
            {
              userId: pack.userId,
              template: "package_paid",
              packageId: payment.packageId,
            },
            now,
          );
          return;
        }
        const current = await booking(sql, payment.id);
        await expire(sql, now);
        if (
          current.state === "cancelled" ||
          Date.parse(current.startsAt) <= Date.parse(now)
        ) {
          await requestRefund(
            sql,
            payment.id,
            event.paymentId,
            payment.amountMinor,
            payment.currency,
            now,
          );
          return;
        }
        await sql.exec("savepoint reacquire_booking");
        try {
          await sql.exec(
            "update bookings set state='confirmed',version=version+1 where id=? and state in('held','expired')",
            [payment.id],
          );
          await sql.exec("release savepoint reacquire_booking");
        } catch (error) {
          await sql.exec("rollback to savepoint reacquire_booking");
          await sql.exec("release savepoint reacquire_booking");
          const code =
            typeof error === "object" && error !== null && "code" in error
              ? error.code
              : undefined;
          if (code !== "23P01") throw error;
          await requestRefund(
            sql,
            payment.id,
            event.paymentId,
            payment.amountMinor,
            payment.currency,
            now,
          );
          await job(
            sql,
            "notification.send",
            {
              userId: current.menteeId,
              template: "late_payment_refund",
              bookingId: payment.id,
            },
            now,
          );
          return;
        }
        await job(
          sql,
          "notification.send",
          {
            userId: current.menteeId,
            template: "booking_confirmed",
            bookingId: payment.id,
          },
          now,
        );
      });
    },
    async attachCheckout(id, checkoutId, url) {
      await tx(async (sql) => {
        const attached = await sql.query<{ id: string }>(
          "update payments set checkout_id=?,checkout_url=? where id=? and checkout_id is null returning id",
          [checkoutId, url, id],
        );
        if (attached.length) {
          const [expired] = await sql.query<{ id: string }>(
            "select id from bookings where id=? and (state in('expired','cancelled') or (state='held' and expires_at<=now()))",
            [id],
          );
          if (expired)
            await job(
              sql,
              "checkout.expire",
              { orderId: id, checkoutId },
              new Date().toISOString(),
            );
        }
      });
    },
    async expireHolds(now) {
      return tx((sql) => expire(sql, now));
    },
    async claimJobs(now, leaseSeconds = 60) {
      return tx(async (sql) => {
        await sql.exec(
          "update outbox_jobs set state='failed',last_error_code='LEASE_ATTEMPTS_EXHAUSTED',lease_token=null,lease_until=null where state='running' and lease_until<=? and attempts>=8",
          [now],
        );
        const token = randomUUID();
        return sql.query<Job>(
          `with selected as(select id from outbox_jobs where ((state='pending' and available_at<=?) or (state='running' and lease_until<=?)) and attempts<8 order by available_at,id for update skip locked limit 20) update outbox_jobs j set state='running',attempts=j.attempts+1,lease_until=?::timestamptz+(? * interval '1 second'),lease_token=? from selected s where j.id=s.id returning j.id,j.kind,j.payload,j.attempts,j.lease_token as "leaseToken"`,
          [now, now, now, Math.min(900, Math.max(30, leaseSeconds)), token],
        );
      });
    },
    async finishJob(id, leaseToken) {
      await read.exec(
        "update outbox_jobs set state='done',lease_token=null,lease_until=null where id=? and lease_token=? and state='running'",
        [id, leaseToken],
      );
    },
    async failJob(id, leaseToken, now) {
      await tx(async (sql) => {
        const rows = await sql.query<{
          kind: string;
          payload: Record<string, unknown>;
          state: string;
        }>(
          "update outbox_jobs set state=case when attempts>=8 then 'failed' else 'pending' end,available_at=?::timestamptz+(least(3600,power(2,attempts)) * interval '1 second'),lease_token=null,lease_until=null,last_error_code='DELIVERY_FAILED' where id=? and lease_token=? and state='running' returning kind,payload,state",
          [now, id, leaseToken],
        );
        for (const item of rows)
          if (item.state === "failed" && item.kind === "payment.refund")
            await sql.exec(
              "update refunds set state='failed' where payment_id=? and state in('requested','pending')",
              [String(item.payload.orderId)],
            );
      });
    },
    async pendingRefunds() {
      return read.query<RefundOrder>(
        `select p.id as "orderId",coalesce(r.provider_payment_id,p.provider_payment_id) as "paymentId",r.amount_minor::text as "amountMinor",r.currency,r.provider_id as "providerId",r.state from refunds r join payments p on p.id=r.payment_id where r.state='pending' and r.provider_id is not null order by r.created_at,r.id`,
      );
    },
    async attachRefund(orderId, providerId) {
      await read.exec(
        "update refunds set state='pending',provider_id=? where payment_id=? and state<>'succeeded'",
        [providerId, orderId],
      );
    },
    async failedJobs(actor) {
      requireAdministrativeAccess(actor, ["admin"]);
      return read.query<DeadJob>(
        `select id,kind,attempts,last_error_code as "lastErrorCode" from outbox_jobs where state='failed' order by created_at,id`,
      );
    },
    async retryFailedJob(actor, id) {
      requireAdministrativeAccess(actor, ["admin"]);
      return tx(async (sql) => {
        const item = await one<{
          kind: string;
          payload: Record<string, unknown>;
        }>(
          sql,
          "select kind,payload from outbox_jobs where id=? and state='failed' for update",
          [id],
        );
        await sql.exec(
          "update outbox_jobs set state='pending',attempts=0,available_at=now(),lease_token=null,lease_until=null,last_error_code=null where id=?",
          [id],
        );
        if (item.kind === "payment.refund")
          await sql.exec(
            "update refunds set state='requested' where payment_id=? and state='failed'",
            [String(item.payload.orderId)],
          );
        await audit(
          sql,
          actor,
          null,
          "job.retry",
          "Manual retry of failed job " + id,
          new Date().toISOString(),
        );
      });
    },
    async paymentOrder(id) {
      const order = await one<PaymentOrder & { expired: boolean }>(
        read,
        `select p.id,case when p.booking_id is not null then 'booking' else 'package' end as kind,p.amount_minor::text as "amountMinor",p.currency,p.state as "paymentState",p.checkout_id as "checkoutId",p.checkout_url as "checkoutUrl",(b.id is not null and (b.state in('expired','cancelled') or b.expires_at<=now())) as expired from payments p left join bookings b on b.id=p.booking_id where p.id=?`,
        [id],
      );
      if (order.paymentState === "pending" && order.expired)
        throw new DomainError("HOLD_EXPIRED", 409);
      return {
        id: order.id,
        kind: order.kind,
        amountMinor: order.amountMinor,
        currency: order.currency,
        paymentState: order.paymentState,
        checkoutId: order.checkoutId,
        checkoutUrl: order.checkoutUrl,
      };
    },
    async pendingPayments(cursor) {
      // Unattached holds have no provider state to reconcile. A stable cursor visits every attached order.
      return read.query<PaymentOrder>(
        `select id,case when booking_id is not null then 'booking' else 'package' end as kind,amount_minor::text as "amountMinor",currency,state as "paymentState",checkout_id as "checkoutId",checkout_url as "checkoutUrl" from payments where state='pending' and checkout_id is not null and id>? order by id limit 100`,
        [cursor ?? ""],
      );
    },
    async connectAccount(actor) {
      requireRole(actor, ["mentor"]);
      return one<{ accountId: string | null; ready: boolean }>(
        read,
        `select connect_account_id as "accountId",connect_ready as ready from domain_users where id=?`,
        [actor.id],
      );
    },
    async updateConnectAccount(userId, accountId, ready) {
      await read.exec(
        "update domain_users set connect_account_id=?,connect_ready=? where id=? and roles @> '[\"mentor\"]'::jsonb",
        [accountId, ready, userId],
      );
    },
    async metrics(now) {
      const value = await one<{
        pending: number;
        failed: number;
        oldestAgeSeconds: number;
        held: number;
        conflicts: number;
      }>(
        read,
        `select (select count(*)::int from outbox_jobs where state in('pending','running')) as pending,(select count(*)::int from outbox_jobs where state='failed') as failed,coalesce((select extract(epoch from (?::timestamptz-min(created_at)))::int from outbox_jobs where state in('pending','running')),0) as "oldestAgeSeconds",(select count(*)::int from bookings where state='held') as held,(select count(*)::int from refunds where state in('requested','pending','failed')) as conflicts`,
        [now],
      );
      return value;
    },
  };
  return repo;
}
