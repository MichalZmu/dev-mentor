import { Migration } from "@mikro-orm/migrations";

/** Demo bootstrap state lives with its database, never in a checkout marker. */
export class Migration202611040001 extends Migration {
  override up(): void {
    this.addSql(
      "create table demo_seed_state(id text primary key, started_at timestamptz not null default now(), completed_at timestamptz);",
    );
  }
  override down(): void {
    this.addSql("drop table demo_seed_state;");
  }
}
