import { trace, SpanStatusCode } from "@opentelemetry/api";
import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  DomainError,
  requireRole,
  type Actor,
  type Booking,
  type MentorFilter,
  type MentorInput,
  type PaymentEvent,
  type PaymentOrder,
  type SlotInput,
  type AvailabilityRule,
  type CalendarException,
} from "@devmentor/core";
import { getAuthRuntime } from "./auth";
import { demoMailbox, handleAuthWrapper } from "./auth-http";
import { authenticate, withPlatform } from "./platform";
import {
  assertOrigin,
  empty,
  errorResponse,
  idempotencyKey,
  jsonBody,
  response,
} from "./http";
import {
  connectOnboarding,
  createPaymentGateway,
  verifyStripeEvent,
  verifyStripeAccountUpdate,
} from "./payments";

const id = z.string().min(1).max(100);
// Opaque pagination tokens contain encoded sort metadata as well as the ID.
const catalogCursor = z.string().min(1).max(2048);
const version = z.number().int().nonnegative();
const minor = z.string().regex(/^\d+$/).max(16);
const mentorInput = z.object({
  headline: z.string().trim().min(10).max(100),
  bio: z.string().trim().min(50).max(1000),
  specialty: z.string().min(1).max(80),
  languages: z.array(z.string().min(2).max(20)).min(1).max(10),
  priceMinor: minor,
  years: z.number().int().min(1).max(40),
  version: version.optional(),
  name: z.string().max(100).optional(),
  termsVersion: z.string().max(50).optional(),
});
const slotInput = z.object({
  startsAt: z.iso.datetime({ offset: true }),
  endsAt: z.iso.datetime({ offset: true }),
  timezone: z.string().max(100),
});
function pageResponse(page: unknown): Response {
  return Response.json(page, { headers: { "Cache-Control": "no-store" } });
}
function sessionForActor(booking: Booking, actor: Actor): Booking {
  if (booking.menteeId === actor.id) return booking;
  return { ...booking, checkoutUrl: null, checkoutId: null };
}
function bounded<T extends { id: string }>(
  items: T[],
  search: URLSearchParams,
): Response {
  const query = z
    .object({
      cursor: id.optional(),
      limit: z.coerce.number().int().min(1).max(50).default(20),
    })
    .parse(Object.fromEntries(search));
  const sorted = [...items].sort((a, b) => a.id.localeCompare(b.id));
  const index = query.cursor
    ? sorted.findIndex((item) => item.id === query.cursor)
    : -1;
  if (query.cursor && index < 0) throw new DomainError("INVALID_CURSOR", 422);
  const data = sorted.slice(index + 1, index + 1 + query.limit);
  const lastId = data.at(-1)?.id ?? null;
  return pageResponse({
    data,
    nextCursor: sorted.length > index + 1 + query.limit ? lastId : null,
  });
}
async function rateLimit(actor: Actor): Promise<void> {
  const { pool } = getAuthRuntime();
  const result = await pool.query<{ count: number }>(
    `insert into auth.api_rate_limit(key,window_start,count) values($1,date_trunc('minute',now()),1)
    on conflict(key) do update set count=case when auth.api_rate_limit.window_start < date_trunc('minute',now()) then 1 else auth.api_rate_limit.count+1 end,window_start=date_trunc('minute',now()) returning count`,
    ["actor:" + actor.id],
  );
  if ((result.rows[0]?.count ?? 1000) > 120)
    throw new DomainError("RATE_LIMITED", 429);
}
function timeRange(search: URLSearchParams): { from: string; to: string } {
  const from = search.get("from") ?? new Date().toISOString();
  z.iso.datetime({ offset: true }).parse(from);
  const to =
    search.get("to") ??
    new Date(Date.parse(from) + 31 * 86400000).toISOString();
  z.iso.datetime({ offset: true }).parse(to);
  if (
    Date.parse(to) <= Date.parse(from) ||
    Date.parse(to) - Date.parse(from) > 31 * 86400000
  )
    throw new DomainError("INVALID_DATE_RANGE");
  return { from, to };
}
async function checkoutNow(order: PaymentOrder): Promise<void> {
  if (order.paymentState !== "pending" || order.checkoutId) return;
  const gateway = createPaymentGateway(getAuthRuntime().env);
  const checkout = await gateway.createCheckout(order);
  await withPlatform(async (_service, repository) =>
    repository.attachCheckout(order.id, checkout.id, checkout.url),
  );
}
function calendarTime(value: string): string {
  return new Date(value).toISOString().slice(0, 19).replace(/[-:]/g, "") + "Z";
}

async function dispatchApi(request: Request): Promise<Response> {
  const requestId = randomUUID();
  try {
    const url = new URL(request.url);
    const parts = url.pathname
      .replace(/^\/api\/v1\/?/, "")
      .split("/")
      .filter(Boolean);
    const [resource, itemId, action, subitem] = parts;
    const method = request.method;
    if (resource === "config" && method === "GET")
      return response({
        mode: process.env.APP_MODE === "demo" ? "demo" : "production",
        oauth: {
          google: Boolean(
            process.env.OAUTH_GOOGLE_CLIENT_ID &&
            process.env.OAUTH_GOOGLE_CLIENT_SECRET,
          ),
        },
      });
    if (resource === "health" && method === "GET")
      return response({ status: "ok", service: "devmentor" });
    const runtime = getAuthRuntime();
    if (resource === "webhooks" && itemId === "payments" && method === "POST") {
      if (Number(request.headers.get("content-length")) > 1_048_576)
        throw new DomainError("BODY_TOO_LARGE", 413);
      const raw = await request.text();
      if (Buffer.byteLength(raw) > 1_048_576)
        throw new DomainError("BODY_TOO_LARGE", 413);
      const signature = request.headers.get("stripe-signature");
      if (!signature) throw new DomainError("INVALID_WEBHOOK_SIGNATURE", 400);
      const event = await verifyStripeEvent(raw, signature, runtime.env);
      const accountUpdate = await verifyStripeAccountUpdate(
        raw,
        signature,
        runtime.env,
      );
      if (accountUpdate)
        await withPlatform(async (_service, repository) =>
          repository.updateConnectAccount(
            accountUpdate.userId,
            accountUpdate.accountId,
            accountUpdate.ready,
          ),
        );
      if (event)
        await withPlatform(async (_service, repository) =>
          repository.acceptPaymentEvent(event, new Date().toISOString()),
        );
      return response({ accepted: true });
    }
    if (resource === "auth" && method === "POST")
      return await handleAuthWrapper(request, parts.slice(1).join("/"));
    if (resource === "demo" && itemId === "mailbox" && method === "GET")
      return await demoMailbox(request);
    if (!["GET", "HEAD"].includes(method))
      assertOrigin(request, runtime.env.APP_URL);
    return await withPlatform(async (service, repository) => {
      if (resource === "mentors" && method === "GET") {
        if (!itemId) {
          const filter = z
            .object({
              q: z.string().max(100).optional(),
              specialty: z.string().max(80).optional(),
              language: z.string().max(20).optional(),
              maxPriceMinor: minor.optional(),
              sort: z.enum(["recommended", "price", "experience"]).optional(),
              cursor: catalogCursor.optional(),
              limit: z.coerce.number().int().min(1).max(50).optional(),
            })
            .parse(Object.fromEntries(url.searchParams)) as MentorFilter;
          return pageResponse(await service.mentors(filter));
        }
        if (action === "reviews")
          return pageResponse(
            await service.reviews(
              itemId,
              url.searchParams.get("cursor") ?? undefined,
            ),
          );
        if (action === "availability") {
          const range = timeRange(url.searchParams);
          return response(
            await service.availability(itemId, range.from, range.to),
          );
        }
        if (!action) return response(await service.mentor(itemId));
      }
      const actor = await authenticate(request, repository);
      if (resource === "admin" && !actor.mfaVerified)
        throw new DomainError("MFA_REQUIRED", 403);
      if (method !== "GET") await rateLimit(actor);
      if (resource === "me") {
        if (!itemId && method === "GET")
          return response(await service.profile(actor));
        if (!itemId && method === "PATCH") {
          const input = z
            .object({
              name: z.string().trim().min(2).max(100),
              timezone: z.string().max(100),
              version,
              preferences: z.record(z.string(), z.unknown()).optional(),
              notifications: z.record(z.string(), z.boolean()).optional(),
            })
            .strict()
            .parse(await jsonBody(request));
          return response(
            await service.updateProfile(actor, {
              name: input.name,
              timezone: input.timezone,
              version: input.version,
              ...(input.preferences
                ? { preferences: input.preferences }
                : input.notifications
                  ? { preferences: input.notifications }
                  : {}),
            }),
          );
        }
        if (itemId === "goals" && method === "GET")
          return response(await service.goals(actor));
        if (itemId === "goals" && method === "PUT")
          return response(
            await service.saveGoals(
              actor,
              z
                .object({
                  goal: z.string().min(1).max(100),
                  level: z.string().min(1).max(100),
                  description: z.string().min(20).max(500),
                })
                .strict()
                .parse(await jsonBody(request)),
            ),
          );
        if (itemId === "sessions" && method === "GET")
          return bounded(
            (await service.bookings(actor)).map((booking) =>
              sessionForActor(booking, actor),
            ),
            url.searchParams,
          );
        if (itemId === "favorites" && method === "GET")
          return response(await service.favorites(actor));
        if (itemId === "dashboard" && method === "GET") {
          const sessions = (await service.bookings(actor)).map((booking) =>
            sessionForActor(booking, actor),
          );
          const packages = await service.packages(actor);
          const now = Date.now();
          const upcoming = sessions.filter(
            (booking) =>
              booking.state === "confirmed" && Date.parse(booking.endsAt) > now,
          );
          return response({
            nextSession:
              upcoming.sort((a, b) =>
                a.startsAt.localeCompare(b.startsAt),
              )[0] ?? null,
            upcomingCount: upcoming.length,
            completedCount: sessions.filter(
              (booking) => booking.state === "completed",
            ).length,
            goalProgress: await service.learningPlan(actor),
            creditBalance: packages.reduce(
              (sum, item) => sum + item.credits,
              0,
            ),
          });
        }
        if (itemId === "learning-plan" && method === "GET")
          return response(await service.learningPlan(actor));
        if (itemId === "billing" && method === "GET")
          return response({
            orders: (await service.bookings(actor)).filter(
              (booking) => booking.menteeId === actor.id,
            ),
            packages: await service.packages(actor),
          });
        if (itemId === "mentor-application" && method === "GET")
          return response(await service.ownApplication(actor));
        if (itemId === "support-tickets" && method === "GET")
          return bounded(await service.ownCases(actor), url.searchParams);
      }
      if (
        resource === "favorites" &&
        itemId &&
        ["PUT", "DELETE"].includes(method)
      ) {
        await service.setFavorite(actor, itemId, method === "PUT");
        return empty();
      }
      if (resource === "booking-holds" && method === "POST") {
        const input = z
          .object({
            mentorId: id,
            slotId: id,
            durationMinutes: z.literal(50).optional(),
          })
          .strict()
          .parse(await jsonBody(request));
        return response(
          await service.createHold(actor, {
            mentorId: input.mentorId,
            slotId: input.slotId,
            ...(input.durationMinutes === undefined
              ? {}
              : { durationMinutes: input.durationMinutes }),
          }),
          201,
        );
      }
      if (resource === "checkout-sessions" && method === "POST") {
        const input = z
          .object({
            holdId: id,
            paymentMode: z.enum(["psp", "credit"]),
            acceptedPolicyVersion: z.string().min(1).max(100),
          })
          .strict()
          .parse(await jsonBody(request));
        const booking = await service.checkout(
          actor,
          input,
          idempotencyKey(request),
        );
        if (booking.paymentState === "pending")
          await checkoutNow({
            id: booking.id,
            kind: "booking",
            amountMinor: booking.amountMinor,
            currency: booking.currency,
            paymentState: booking.paymentState,
            checkoutId: booking.checkoutId,
            checkoutUrl: booking.checkoutUrl,
          });
        return response(await service.booking(actor, booking.id), 201);
      }
      if (resource === "orders" && itemId && method === "GET") {
        let order:
          | Awaited<ReturnType<typeof service.booking>>
          | Awaited<ReturnType<typeof service.packages>>[number];
        try {
          order = await service.booking(actor, itemId);
          if (order.menteeId !== actor.id)
            throw new DomainError("NOT_FOUND", 404);
        } catch (error) {
          if (!(error instanceof DomainError) || error.status !== 404)
            throw error;
          const item = (await service.packages(actor)).find(
            (value) => value.id === itemId,
          );
          if (!item) throw error;
          order = item;
        }
        if (action === "receipt") {
          if (order.paymentState !== "paid")
            throw new DomainError("PAYMENT_REQUIRED");
          return new Response(
            `DevMentor — potwierdzenie płatności (nie faktura VAT)\nNumer: ${order.id}\nKwota w najmniejszych jednostkach: ${order.amountMinor} ${order.currency}\n`,
            {
              headers: {
                "Content-Type": "text/plain; charset=utf-8",
                "Content-Disposition":
                  'attachment; filename="devmentor-payment.txt"',
                "Cache-Control": "no-store",
              },
            },
          );
        }
        return response(order);
      }
      if (
        resource === "demo" &&
        itemId === "payments" &&
        action &&
        method === "POST"
      ) {
        if (runtime.env.APP_MODE !== "demo")
          throw new DomainError("NOT_FOUND", 404);
        let order: PaymentOrder;
        try {
          const item = await service.booking(actor, action);
          if (item.menteeId !== actor.id)
            throw new DomainError("NOT_FOUND", 404);
          order = {
            id: item.id,
            kind: "booking",
            amountMinor: item.amountMinor,
            currency: item.currency,
            paymentState: item.paymentState,
            checkoutId: item.checkoutId,
            checkoutUrl: item.checkoutUrl,
          };
        } catch (error) {
          if (!(error instanceof DomainError) || error.status !== 404)
            throw error;
          const item = (await service.packages(actor)).find(
            (value) => value.id === action,
          );
          if (!item) throw error;
          order = {
            id: item.id,
            kind: "package",
            amountMinor: item.amountMinor,
            currency: item.currency,
            paymentState: item.paymentState,
            checkoutId: item.checkoutId,
            checkoutUrl: item.checkoutUrl,
          };
        }
        if (!order.checkoutId?.startsWith("demo_"))
          throw new DomainError("CHECKOUT_REQUIRED", 409);
        const event: PaymentEvent = {
          provider: "demo",
          eventId: "demo_paid_" + order.id,
          bookingId: order.id,
          paymentId: "demo_pi_" + order.id,
          amountMinor: order.amountMinor,
          currency: order.currency,
          status: "paid",
        };
        await repository.acceptPaymentEvent(event, new Date().toISOString());
        return response({ accepted: true }, 202);
      }
      if (resource === "sessions" && itemId) {
        if (action === "cancel" && method === "POST") {
          const input = z
            .object({ reason: z.string().min(10).max(500), version })
            .strict()
            .parse(await jsonBody(request));
          return response(
            sessionForActor(
              await service.cancel(
                actor,
                itemId,
                input.reason,
                input.version,
                idempotencyKey(request),
              ),
              actor,
            ),
            202,
          );
        }
        if (action === "reschedule" && method === "POST") {
          const input = z
            .object({ slotId: id, version })
            .strict()
            .parse(await jsonBody(request));
          return response(
            sessionForActor(
              await service.reschedule(
                actor,
                itemId,
                input.slotId,
                input.version,
              ),
              actor,
            ),
          );
        }
        if (action === "complete" && method === "POST")
          return response(
            sessionForActor(await service.complete(actor, itemId), actor),
          );
        if (action === "notes" && method === "GET")
          return response({ note: await service.note(actor, itemId) });
        if (action === "notes" && method === "PUT") {
          const input = z
            .object({ note: z.string().max(2000), version: version.optional() })
            .strict()
            .parse(await jsonBody(request));
          await service.saveNote(actor, itemId, input.note);
          return response({ note: input.note });
        }
        if (action === "reviews" && method === "POST") {
          const input = z
            .object({
              rating: z.number().int().min(1).max(5),
              comment: z.string().min(10).max(1000),
            })
            .strict()
            .parse(await jsonBody(request));
          return response(
            await service.addReview(actor, itemId, input.rating, input.comment),
            201,
          );
        }
        const booking = await service.booking(actor, itemId);
        if (!action && method === "GET")
          return response(sessionForActor(booking, actor));
        if (action === "calendar" && method === "GET") {
          const ics = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//DevMentor//Sessions//PL",
            "BEGIN:VEVENT",
            `UID:${booking.id}@devmentor`,
            `DTSTAMP:${calendarTime(new Date().toISOString())}`,
            `DTSTART:${calendarTime(booking.startsAt)}`,
            `DTEND:${calendarTime(booking.endsAt)}`,
            "SUMMARY:Sesja mentoringu DevMentor",
            "END:VEVENT",
            "END:VCALENDAR",
            "",
          ];
          return new Response(ics.join("\r\n"), {
            headers: {
              "Content-Type": "text/calendar; charset=utf-8",
              "Content-Disposition":
                'attachment; filename="devmentor-session.ics"',
              "Cache-Control": "no-store",
            },
          });
        }
        if (action === "join" && method === "POST") {
          if (
            booking.state !== "confirmed" ||
            Date.now() < Date.parse(booking.startsAt) - 15 * 60_000 ||
            Date.now() > Date.parse(booking.endsAt)
          )
            throw new DomainError("SESSION_NOT_JOINABLE");
          if (runtime.env.APP_MODE === "demo")
            return response({
              roomUrl: "/room/" + encodeURIComponent(booking.id),
              demo: true,
            });
          if (!runtime.env.MEETING_BASE_URL)
            throw new DomainError("MEETING_PROVIDER_UNAVAILABLE", 503);
          const meeting = new URL(runtime.env.MEETING_BASE_URL);
          meeting.searchParams.set("session", booking.id);
          return response({ roomUrl: meeting.href });
        }
      }
      if (resource === "conversations") {
        if (!itemId && method === "GET")
          return bounded(await service.conversations(actor), url.searchParams);
        if (!itemId && method === "POST") {
          const input = z
            .object({ mentorId: id })
            .strict()
            .parse(await jsonBody(request));
          return response(
            await service.conversation(actor, input.mentorId),
            201,
          );
        }
        if (itemId && action === "messages" && method === "GET")
          return pageResponse(
            await service.messages(
              actor,
              itemId,
              url.searchParams.get("cursor") ?? undefined,
            ),
          );
        if (itemId && action === "messages" && method === "POST") {
          const input = z
            .object({ text: z.string().min(1).max(2000), clientMessageId: id })
            .strict()
            .parse(await jsonBody(request));
          return response(
            await service.sendMessage(
              actor,
              itemId,
              input.text,
              input.clientMessageId,
            ),
            201,
          );
        }
      }
      if (
        resource === "learning-plans" &&
        itemId &&
        action === "milestones" &&
        subitem &&
        method === "PATCH"
      ) {
        const plan = await service.learningPlan(actor);
        if (plan.id !== itemId) throw new DomainError("NOT_FOUND", 404);
        const input = z
          .object({ completed: z.boolean(), version })
          .strict()
          .parse(await jsonBody(request));
        return response(
          await service.saveMilestone(
            actor,
            subitem,
            input.completed,
            input.version,
          ),
        );
      }
      if (resource === "subscriptions") {
        if (!itemId && method === "POST") {
          const input = z
            .object({
              mentorId: id,
              packageSize: z.literal(4).optional(),
              autoRenew: z.literal(false).optional(),
              consentVersion: z.string().max(100).optional(),
            })
            .strict()
            .parse(await jsonBody(request));
          const item = await service.buyPackage(
            actor,
            input.mentorId,
            idempotencyKey(request),
            new Date().toISOString(),
          );
          await checkoutNow({
            id: item.id,
            kind: "package",
            amountMinor: item.amountMinor,
            currency: item.currency,
            paymentState: item.paymentState,
            checkoutId: item.checkoutId,
            checkoutUrl: item.checkoutUrl,
          });
          return response(
            (await service.packages(actor)).find(
              (value) => value.id === item.id,
            ),
            201,
          );
        }
        if (itemId && method === "PATCH") {
          const input = z
            .object({
              action: z.enum(["pause", "resume", "cancel"]),
              version,
              autoRenew: z.literal(false).optional(),
            })
            .strict()
            .parse(await jsonBody(request));
          return response(
            await service.updatePackage(
              actor,
              itemId,
              input.action,
              input.version,
            ),
          );
        }
      }
      if (resource === "mentor-applications" && method === "POST")
        return response(
          await service.applyMentor(
            actor,
            mentorInput.parse(await jsonBody(request)) as MentorInput,
          ),
          201,
        );
      if (resource === "mentor") {
        if (itemId === "dashboard" && method === "GET")
          return response({
            application: await service.ownApplication(actor),
            profile: actor.roles.includes("mentor")
              ? await service.ownMentor(actor)
              : null,
            sessions: actor.roles.includes("mentor")
              ? (await service.bookings(actor)).map((booking) =>
                  sessionForActor(booking, actor),
                )
              : [],
          });
        if (itemId === "profile" && method === "GET")
          return response(await service.ownMentor(actor));
        if (itemId === "profile" && method === "PATCH")
          return response(
            await service.saveMentor(
              actor,
              mentorInput.parse(await jsonBody(request)) as MentorInput,
            ),
          );
        if (itemId === "availability" && action === "rules" && method === "GET")
          return response(await service.availabilityRules(actor));
        if (
          itemId === "availability" &&
          action === "rules" &&
          method === "PUT"
        ) {
          const input = z
            .object({
              rules: z
                .array(
                  z.object({
                    weekday: z.number().int().min(0).max(6),
                    localTime: z.string().regex(/^\d{2}:\d{2}$/),
                    timezone: z.string().max(100),
                    disambiguation: z
                      .enum(["earlier", "later", "reject"])
                      .optional(),
                  }),
                )
                .max(50),
              exceptions: z
                .array(
                  z.object({ localDate: z.iso.date(), available: z.boolean() }),
                )
                .max(366),
            })
            .strict()
            .parse(await jsonBody(request));
          return response(
            await service.saveAvailabilityRules(
              actor,
              input.rules as AvailabilityRule[],
              input.exceptions as CalendarException[],
            ),
          );
        }
        if (itemId === "availability" && !action && method === "GET") {
          const mentor = await service.ownMentor(actor);
          const range = timeRange(url.searchParams);
          return response(
            await service.availability(mentor.id, range.from, range.to),
          );
        }
        if (itemId === "availability" && !action && method === "PUT") {
          const input = z
            .object({
              slots: z.array(slotInput).max(1000),
              version: version.optional(),
            })
            .strict()
            .parse(await jsonBody(request));
          return response(
            await service.saveAvailability(actor, input.slots as SlotInput[]),
          );
        }
        if (itemId === "earnings" && method === "GET")
          return response(await service.earnings(actor));
        if (itemId === "payouts" && method === "POST") {
          const input = z
            .object({ amountMinor: minor, currency: z.literal("PLN") })
            .strict()
            .parse(await jsonBody(request));
          return response(
            await service.payout(
              actor,
              input.amountMinor,
              idempotencyKey(request),
              new Date().toISOString(),
            ),
            202,
          );
        }
        if (itemId === "connect" && method === "POST") {
          requireRole(actor, ["mentor"]);
          const account = await service.connectAccount(actor);
          const profile = await service.profile(actor);
          const result = await connectOnboarding(
            actor.id,
            profile.email,
            account.accountId,
            runtime.env,
          );
          await repository.updateConnectAccount(
            actor.id,
            result.accountId,
            result.ready,
          );
          return response({ url: result.url });
        }
      }
      if (resource === "support-tickets" && method === "POST") {
        const input = z
          .object({
            category: z.string().min(1).max(80),
            description: z.string().min(20).max(2000),
            sessionId: id.optional(),
            email: z.email().optional(),
          })
          .strict()
          .parse(await jsonBody(request));
        return response(
          await service.support(
            actor,
            input.category,
            input.description,
            input.sessionId,
          ),
          201,
        );
      }
      if (resource === "admin") {
        if (itemId === "mentor-applications" && method === "GET")
          return bounded(
            await service.adminCases(actor, "mentor_application"),
            url.searchParams,
          );
        if (itemId === "support-tickets" && method === "GET")
          return bounded(
            await service.adminCases(actor, "support"),
            url.searchParams,
          );
        if (itemId === "overview" && method === "GET") {
          requireRole(actor, ["support", "moderator", "admin"]);
          const summary: Record<string, number> = {};
          if (actor.roles.some((role) => ["admin", "support"].includes(role))) {
            const supportCases = await service.adminCases(actor, "support");
            const pending = supportCases.filter(
              (item) => item.status === "pending",
            ).length;
            summary.openTickets = pending;
            summary.supportOpen = pending;
            summary.cases = supportCases.length;
          }
          if (actor.roles.some((role) => ["admin", "moderator"].includes(role)))
            summary.pendingApplications = (
              await service.adminCases(actor, "mentor_application")
            ).filter((item) => item.status === "pending").length;
          return response(summary);
        }
        if (itemId === "cases" && action && !subitem && method === "GET")
          return response(await service.caseDetail(actor, action));
        if (
          itemId === "cases" &&
          action &&
          subitem === "decision" &&
          method === "POST"
        ) {
          const input = z
            .object({
              action: z.enum(["approve", "reject", "resolve"]),
              reason: z.string().min(10).max(1000),
              version,
            })
            .strict()
            .parse(await jsonBody(request));
          return response(
            await service.decideCase(
              actor,
              action,
              input.action,
              input.reason,
              input.version,
              new Date().toISOString(),
            ),
          );
        }
        if (itemId === "jobs" && !action && method === "GET")
          return response(await service.failedJobs(actor));
        if (
          itemId === "jobs" &&
          action &&
          subitem === "retry" &&
          method === "POST"
        ) {
          await service.retryFailedJob(actor, action);
          return response({ accepted: true }, 202);
        }
        if (itemId === "metrics" && method === "GET") {
          requireRole(actor, ["admin"]);
          return response(await repository.metrics(new Date().toISOString()));
        }
      }
      throw new DomainError("NOT_FOUND", 404);
    });
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

export function handleApi(request: Request): Promise<Response> {
  return trace
    .getTracer("devmentor-http")
    .startActiveSpan("http.request", async (span) => {
      span.setAttribute("http.request.method", request.method);
      try {
        const result = await dispatchApi(request);
        span.setAttribute("http.response.status_code", result.status);
        if (result.status >= 500)
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: "REQUEST_FAILED",
          });
        return result;
      } finally {
        span.end();
      }
    });
}
