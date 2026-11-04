import { Migration } from "@mikro-orm/migrations";

/** Persist checkout funding choice and distinguish current calendar offers from booking history. */
export class Migration202611030004 extends Migration {
  override up(): void {
    this.addSql(`
   alter table payments add column checkout_mode text check(checkout_mode in('psp','credit'));
   update payments p set checkout_mode=case when b.payment_mode='credit' then 'credit' when p.package_id is not null or p.checkout_id is not null or p.provider_payment_id is not null or exists(select 1 from outbox_jobs j where j.kind='checkout.start' and j.payload->>'orderId'=p.id) then 'psp' else null end from bookings b where b.id=p.booking_id;
   update payments set checkout_mode='psp' where package_id is not null;
   alter table refunds add column provider_payment_id text;
   alter table refunds add column currency text not null default 'PLN';
   alter table refunds add column kind text not null default 'booking' check(kind in('booking','extra_charge'));
   update refunds r set provider_payment_id=p.provider_payment_id,currency=p.currency from payments p where p.id=r.payment_id;
   alter table availability_slots add column manual_offered boolean not null default true;
   alter table availability_slots add column rule_offered boolean not null default false;
   update availability_slots set manual_offered=(source='manual'),rule_offered=(source='rule');
   alter table availability_slots add column active boolean generated always as(manual_offered or rule_offered) stored;
  `);
  }
  override down(): void {
    this.addSql(
      `alter table availability_slots drop column active;alter table availability_slots drop column rule_offered;alter table availability_slots drop column manual_offered;alter table refunds drop column kind;alter table refunds drop column currency;alter table refunds drop column provider_payment_id;alter table payments drop column checkout_mode;`,
    );
  }
}
