import { expect, test } from "vitest";
import { MikroORM } from "@mikro-orm/postgresql";
import { createDatabaseConfig } from "../src/config";
import { Migration202611030001 } from "../migrations/Migration202611030001";
import { Migration202611030002 } from "../migrations/Migration202611030002";
import { Migration202611030003 } from "../migrations/Migration202611030003";
import { Migration202611040001 } from "../migrations/Migration202611040001";
import { Migration202611030004 } from "../migrations/Migration202611030004";

test("domain schema declares booking exclusion, durable deduplication and append-only audit", async () => {
  const orm = new MikroORM(
    createDatabaseConfig({
      DATABASE_URL: "postgresql://test@127.0.0.1:1/unused",
    }),
  );
  try {
    const migration = new Migration202611030001(orm.driver, orm.config);
    migration.up();
    const sql = migration.getQueries().join("\n");
    expect(sql).toContain(
      "constraint no_overlapping_mentor_bookings exclude using gist",
    );
    expect(sql).toContain("where(state in ('held','confirmed'))");
    expect(sql).toContain("unique(provider,event_id)");
    expect(sql).toContain("unique(reference,kind)");
    expect(sql).toContain("create trigger append_only_audit");
    migration.reset();
    migration.down();
    expect(migration.getQueries().join("\n")).toContain(
      "drop function if exists reject_audit_mutation()",
    );
  } finally {
    await orm.close();
  }
});
test("incremental migrations add reversible audit context and availability provenance", async () => {
  const orm = new MikroORM(
    createDatabaseConfig({
      DATABASE_URL: "postgresql://test@127.0.0.1:1/unused",
    }),
  );
  try {
    for (const [MigrationClass, addition, removal] of [
      [
        Migration202611030002,
        "add column request_id",
        "drop column request_id",
      ],
      [
        Migration202611040001,
        "create table demo_seed_state",
        "drop table demo_seed_state",
      ],
      [Migration202611030003, "add column source", "drop column source"],
      [
        Migration202611030004,
        "add column checkout_mode",
        "drop column checkout_mode",
      ],
    ] as const) {
      const migration = new MigrationClass(orm.driver, orm.config);
      migration.up();
      expect(migration.getQueries().join("\n")).toContain(addition);
      migration.reset();
      migration.down();
      expect(migration.getQueries().join("\n")).toContain(removal);
    }
  } finally {
    await orm.close();
  }
});

test("funding and availability migration backfills durable choices and separates current offers from history", async () => {
  const orm = new MikroORM(
    createDatabaseConfig({
      DATABASE_URL: "postgresql://test@127.0.0.1:1/unused",
    }),
  );
  try {
    const migration = new Migration202611030004(orm.driver, orm.config);
    migration.up();
    const sql = migration.getQueries().join("\n");
    expect(sql).toContain("check(checkout_mode in('psp','credit'))");
    expect(sql).toContain("j.kind='checkout.start'");
    expect(sql).toContain("add column provider_payment_id text");
    expect(sql).toContain("check(kind in('booking','extra_charge'))");
    expect(sql).toContain(
      "manual_offered=(source='manual'),rule_offered=(source='rule')",
    );
    expect(sql).toContain(
      "active boolean generated always as(manual_offered or rule_offered) stored",
    );
    migration.reset();
    migration.down();
    const down = migration.getQueries().join("\n");
    for (const field of [
      "active",
      "manual_offered",
      "rule_offered",
      "checkout_mode",
    ])
      expect(down).toContain("drop column " + field);
  } finally {
    await orm.close();
  }
});
