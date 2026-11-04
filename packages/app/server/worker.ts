import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  type Job,
  type PaymentEvent,
  type PaymentGateway,
} from "@devmentor/core";
import { getAuthRuntime } from "./auth";
import { deliverEmail } from "./email";
import { createPaymentGateway } from "./payments";
import { withPlatform } from "./platform";
import { logEvent } from "./log";

const text = z.string().min(1).max(1000);
const eventSchema = z.object({
  provider: text,
  eventId: text,
  refundId: z.string().optional(),
  bookingId: text,
  paymentId: text,
  amountMinor: z.string().regex(/^\d+$/),
  currency: z.string().length(3),
  status: z.enum(["paid", "failed", "refund_succeeded", "refund_failed"]),
});
export async function runWorkerOnce(gatewayOverride?: PaymentGateway): Promise<{
  processed: number;
  failed: number;
}> {
  const runtime = getAuthRuntime();
  const gateway = gatewayOverride ?? createPaymentGateway(runtime.env);
  return withPlatform(async (service, repository) => {
    const now = (): string => new Date().toISOString();
    await repository.expireHolds(now());
    let processed = 0;
    let failed = 0;
    const jobs: Job[] = await repository.claimJobs(now(), 120);
    for (const job of jobs) {
      try {
        if (job.kind === "checkout.start") {
          const input = z.object({ orderId: text }).parse(job.payload);
          const order = await repository.paymentOrder(input.orderId);
          if (order.paymentState === "pending" && !order.checkoutId) {
            const checkout = await gateway.createCheckout(order);
            await repository.attachCheckout(
              order.id,
              checkout.id,
              checkout.url,
            );
          }
        } else if (job.kind === "checkout.expire") {
          const input = z.object({ checkoutId: text }).parse(job.payload);
          await gateway.expireCheckout(input.checkoutId);
        } else if (job.kind === "payment.process") {
          const { event } = z.object({ event: eventSchema }).parse(job.payload);
          await repository.processPaymentEvent(event as PaymentEvent, now());
        } else if (job.kind === "payment.refund") {
          const input = z
            .object({
              orderId: text,
              paymentId: text,
              amountMinor: text,
              currency: text,
            })
            .parse(job.payload);
          const result = await gateway.refund(
            input.orderId,
            input.paymentId,
            input.amountMinor,
            input.currency,
          );
          await repository.attachRefund(input.orderId, result.providerId);
          if (result.event)
            await repository.acceptPaymentEvent(result.event, now());
        } else if (job.kind === "notification.send") {
          const input = z
            .object({
              userId: text,
              template: text,
              bookingId: text.optional(),
            })
            .parse(job.payload);
          const actor = await repository.getActor(input.userId);
          const user = await service.profile(actor);
          await deliverEmail(runtime.pool, runtime.env, {
            to: user.email,
            subject: "Powiadomienie DevMentor",
            text: "Status operacji w DevMentor został zaktualizowany. Sprawdź swój panel.",
          });
        } else if (job.kind === "payout.send") {
          const input = z
            .object({
              payoutId: text,
              accountId: text,
              amountMinor: text,
              currency: text,
            })
            .parse(job.payload);
          const providerId = await gateway.payout(
            input.payoutId,
            input.accountId,
            input.amountMinor,
            input.currency,
          );
          await repository.completePayout(input.payoutId, providerId, true);
        } else throw new Error("Unknown durable job kind");
        await repository.finishJob(job.id, job.leaseToken);
        processed++;
      } catch {
        await repository.failJob(job.id, job.leaseToken, now());
        failed++;
        logEvent("error", "worker.job", job.id, "JOB_RETRY_OR_INTERVENTION");
      }
    }
    let cursor: string | undefined;
    for (;;) {
      const orders = await repository.pendingPayments(cursor);
      for (const order of orders) {
        if (order.checkoutId)
          try {
            const event = await gateway.retrieve(order);
            if (event) await repository.acceptPaymentEvent(event, now());
          } catch {
            logEvent(
              "error",
              "payments.reconcile",
              randomUUID(),
              "RECONCILE_RETRY",
            );
          }
      }
      if (orders.length < 100) break;
      const next = orders.at(-1)?.id;
      if (!next || next === cursor)
        throw new Error("Reconciliation cursor did not advance");
      cursor = next;
    }
    for (const order of await repository.pendingRefunds()) {
      if (order.providerId)
        try {
          const event = await gateway.retrieveRefund(order);
          if (event) await repository.acceptPaymentEvent(event, now());
        } catch {
          logEvent(
            "error",
            "refunds.reconcile",
            randomUUID(),
            "REFUND_RECONCILE_RETRY",
          );
        }
    }
    return { processed, failed };
  });
}
