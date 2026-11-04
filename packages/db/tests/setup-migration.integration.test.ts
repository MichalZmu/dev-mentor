import { expect, test } from "vitest";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { MikroORM } from "@mikro-orm/postgresql";
import { Migrator } from "@mikro-orm/migrations";
import { createDatabaseConfig } from "../src/config";
import { seedDemoPlatform } from "../src/seed";
import { Migration202611030001 } from "../migrations/Migration202611030001";
import { Migration202611030002 } from "../migrations/Migration202611030002";
import { Migration202611030003 } from "../migrations/Migration202611030003";
import { Migration202611030004 } from "../migrations/Migration202611030004";
import { Migration202611040001 } from "../migrations/Migration202611040001";

test("demo marker migration upgrades, rolls back and reapplies without changing existing domain data", async () => {
  const container = await new PostgreSqlContainer("postgres:18.6").start();
  try {
    const orm = await MikroORM.init({
      ...createDatabaseConfig({ DATABASE_URL: container.getConnectionUri() }),
      extensions: [Migrator],
      migrations: {
        snapshot: false,
        migrationsList: [
          Migration202611030001,
          Migration202611030002,
          Migration202611030003,
          Migration202611030004,
          Migration202611040001,
        ],
      },
    });
    try {
      await orm.migrator.up({ to: "Migration202611030004" });
      const connection = orm.em.getConnection();
      await connection.execute(
        "insert into domain_users(id,name,email,goals,roles) values('legacy','Legacy','legacy@example.test','{\"description\":\"keep\"}','[\"mentee\",\"support\"]')",
      );
      await orm.migrator.up();
      const identities = {
        menteeId: "legacy",
        mentorId: "mentor",
        adminId: "admin",
      };
      expect((await seedDemoPlatform(orm.em.fork(), identities)).seeded).toBe(
        true,
      );
      const users: unknown = await connection.execute(
        "select id,name,email,roles,goals from domain_users order by id",
      );
      const bookings: unknown = await connection.execute(
        "select * from bookings order by id",
      );
      const payments: unknown = await connection.execute(
        "select * from payments order by id",
      );

      await orm.migrator.down({ migrations: ["Migration202611040001"] });
      expect(
        await connection.execute(
          "select to_regclass('public.demo_seed_state') as marker",
        ),
      ).toEqual([{ marker: null }]);
      expect(
        await connection.execute(
          "select name from mikro_orm_migrations order by name",
        ),
      ).toEqual([
        { name: "Migration202611030001" },
        { name: "Migration202611030002" },
        { name: "Migration202611030003" },
        { name: "Migration202611030004" },
      ]);
      expect(
        await connection.execute(
          "select id,name,email,roles,goals from domain_users order by id",
        ),
      ).toEqual(users);
      expect(
        await connection.execute("select * from bookings order by id"),
      ).toEqual(bookings);
      expect(
        await connection.execute("select * from payments order by id"),
      ).toEqual(payments);

      await orm.migrator.up({ migrations: ["Migration202611040001"] });
      expect(
        await connection.execute(
          "select count(*)::int as total from demo_seed_state",
        ),
      ).toEqual([{ total: 0 }]);
      expect((await seedDemoPlatform(orm.em.fork(), identities)).seeded).toBe(
        true,
      );
      expect((await seedDemoPlatform(orm.em.fork(), identities)).seeded).toBe(
        false,
      );
      expect(
        await connection.execute(
          "select id,name,email,roles,goals from domain_users order by id",
        ),
      ).toEqual(users);
      expect(
        await connection.execute("select * from bookings order by id"),
      ).toEqual(bookings);
      expect(
        await connection.execute("select * from payments order by id"),
      ).toEqual(payments);
    } finally {
      await orm.close(true);
    }
  } finally {
    await container.stop();
  }
});
