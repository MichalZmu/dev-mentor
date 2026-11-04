import { Migration } from "@mikro-orm/migrations";

/** Expand audit context without rewriting append-only historical rows. */
export class Migration202611030002 extends Migration {
  override up(): void {
    this.addSql(
      `alter table audit_log add column request_id text not null default 'system'; alter table audit_log add column previous_status text; alter table audit_log add column new_status text; create index inbox_received on inbox(received_at,id); create index pending_payment_orders on payments(created_at,id) where state='pending';`,
    );
  }
  override down(): void {
    this.addSql(
      `drop index if exists pending_payment_orders; drop index if exists inbox_received; alter table audit_log drop column new_status; alter table audit_log drop column previous_status; alter table audit_log drop column request_id;`,
    );
  }
}
