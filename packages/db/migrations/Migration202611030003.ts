import { Migration } from "@mikro-orm/migrations";
/** Preserve manually entered slots when recurring rules are edited. */
export class Migration202611030003 extends Migration {
  override up(): void {
    this.addSql(
      `alter table availability_slots add column source text not null default 'manual' check(source in('manual','rule'));`,
    );
  }
  override down(): void {
    this.addSql(`alter table availability_slots drop column source;`);
  }
}
