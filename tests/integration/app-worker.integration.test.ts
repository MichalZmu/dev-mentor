import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { beforeAll, afterAll, expect, test } from "vitest";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { database } from "@devmentor/db";
import type { PaymentGateway as Gateway } from "@devmentor/core";
import {
  closeAuthRuntime,
  getAuthRuntime,
} from "../../packages/app/server/auth";
import { runWorkerOnce } from "../../packages/app/server/worker";
import { createPaymentGateway } from "../../packages/app/server/payments";
const run = promisify(execFile);
let container: StartedPostgreSqlContainer | undefined;
const previous = { ...process.env };
beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:18.6")
    .withDatabase("worker_v1")
    .start();
  Object.assign(process.env, {
    APP_MODE: "demo",
    APP_URL: "http://localhost:3000",
    DATABASE_URL: container.getConnectionUri(),
    AUTH_DATABASE_URL: container.getConnectionUri(),
    MIGRATION_DATABASE_URL: container.getConnectionUri(),
    AUTH_MIGRATION_DATABASE_URL: container.getConnectionUri(),
  });
  await run("npm", ["run", "migrate"], { env: process.env, timeout: 90000 });
  await run("npm", ["run", "seed:demo"], { env: process.env, timeout: 90000 });
});
afterAll(async () => {
  await closeAuthRuntime();
  await database.close();
  await container?.stop();
  for (const key of Object.keys(process.env))
    if (!(key in previous)) delete process.env[key];
  Object.assign(process.env, previous);
});
test("101 abandoned orders do not hide a new checkout job or late payment on the next reconciliation page", async () => {
  const runtime = getAuthRuntime();
  const pool = runtime.pool;
  await pool.query(
    `insert into public.bookings select (jsonb_populate_record(null::public.bookings,to_jsonb(b)||jsonb_build_object('id','000_abandoned_'||n,'state','expired','expires_at',now()-interval '1 day'))).* from public.bookings b cross join generate_series(1,101) n where b.id='demo-completed-session'`,
  );
  await pool.query(
    `insert into public.bookings select (jsonb_populate_record(null::public.bookings,to_jsonb(b)||jsonb_build_object('id','zz_checkout_target','state','held','starts_at',now()+interval '400 days','ends_at',now()+interval '400 days 50 minutes','expires_at',now()+interval '15 minutes'))).* from public.bookings b where b.id='demo-completed-session'`,
  );
  await pool.query(
    `insert into public.payments select (jsonb_populate_record(null::public.payments,to_jsonb(p)||jsonb_build_object('id','000_abandoned_'||n,'booking_id','000_abandoned_'||n,'state','pending','provider_payment_id',null,'checkout_id',null,'checkout_url',null))).* from public.payments p cross join generate_series(1,101) n where p.booking_id='demo-completed-session'`,
  );
  await pool.query(
    `insert into public.payments select (jsonb_populate_record(null::public.payments,to_jsonb(p)||jsonb_build_object('id','zz_checkout_target','booking_id','zz_checkout_target','state','pending','provider_payment_id',null,'checkout_id',null,'checkout_url',null))).* from public.payments p where p.booking_id='demo-completed-session'`,
  );
  await pool.query(
    `insert into public.outbox_jobs(id,kind,payload,available_at,created_at) values('v1_checkout_job','checkout.start','{"orderId":"zz_checkout_target"}',now(),now())`,
  );
  const base = createPaymentGateway(runtime.env);
  let created = 0;
  const gateway: Gateway = {
    ...base,
    async createCheckout(order) {
      created++;
      return base.createCheckout(order);
    },
  };
  await runWorkerOnce(gateway);
  expect(created).toBe(1);
  const checkout = await pool.query(
    "select checkout_id from public.payments where booking_id='zz_checkout_target'",
  );
  expect(checkout.rows[0]?.checkout_id).toBe("demo_zz_checkout_target");
  expect(
    (
      await pool.query(
        "select state from public.outbox_jobs where id='v1_checkout_job'",
      )
    ).rows[0]?.state,
  ).toBe("done");
  await pool.query(
    `update public.payments set checkout_id='demo_'||booking_id where booking_id like '000_abandoned_%'`,
  );
  await pool.query(
    "update public.bookings set state='expired',expires_at=now()-interval '1 minute' where id='zz_checkout_target'",
  );
  const seen: string[] = [];
  gateway.retrieve = async (order) => {
    seen.push(order.id);
    return order.id === "zz_checkout_target"
      ? {
          provider: "demo",
          eventId: "v1_late_paid",
          bookingId: order.id,
          paymentId: "demo_pi_v1_late",
          amountMinor: order.amountMinor,
          currency: order.currency,
          status: "paid",
        }
      : null;
  };
  await runWorkerOnce(gateway);
  expect(seen.length).toBe(102);
  expect(seen).toContain("zz_checkout_target");
  await runWorkerOnce(gateway);
  const paid = await pool.query(
    "select b.state,p.state as payment_state from public.bookings b join public.payments p on p.booking_id=b.id where b.id='zz_checkout_target'",
  );
  expect(paid.rows[0]).toMatchObject({
    state: "confirmed",
    payment_state: "paid",
  });
});
test("missing checkout target is retried and never acknowledged as success", async () => {
  const pool = getAuthRuntime().pool;
  await pool.query(
    `insert into public.outbox_jobs(id,kind,payload,available_at,created_at) values('v1_missing_job','checkout.start','{"orderId":"missing-order"}',now(),now())`,
  );
  const result = await runWorkerOnce();
  expect(result.failed).toBeGreaterThan(0);
  const job = await pool.query(
    "select state,attempts from public.outbox_jobs where id='v1_missing_job'",
  );
  expect(job.rows[0]?.state).toBe("pending");
  expect(job.rows[0]?.attempts).toBe(1);
});
