import { Migration } from "@mikro-orm/migrations";

export class Migration202611030001 extends Migration {
  override up(): void {
    this.addSql(`
 create extension if not exists btree_gist;
 create table domain_users (
 id text primary key, name text not null, email text not null unique, timezone text not null default 'Europe/Warsaw', roles jsonb not null default '["mentee"]', preferences jsonb not null default '{}', goals jsonb not null default '{}', version integer not null default 1, connect_account_id text, connect_ready boolean not null default false
 );
 create table mentor_profiles (
 id text primary key, user_id text not null unique references domain_users(id), headline text not null, bio text not null, specialty text not null, languages jsonb not null, price_minor bigint not null check(price_minor between 5000 and 50000), currency text not null default 'PLN' check(currency='PLN'), years integer not null check(years between 1 and 40), status text not null check(status in ('pending','published','suspended')), version integer not null default 1
 );
 create table availability_slots (id text primary key, mentor_id text not null references mentor_profiles(id), starts_at timestamptz not null, ends_at timestamptz not null, timezone text not null, check(ends_at-starts_at=interval '50 minutes'), unique(mentor_id,starts_at));
 create table availability_rules (id text primary key, mentor_id text not null references mentor_profiles(id), weekday integer not null check(weekday between 0 and 6), local_time time not null, timezone text not null, disambiguation text not null default 'reject' check(disambiguation in('reject','earlier','later')));
 create table availability_exceptions (id text primary key, mentor_id text not null references mentor_profiles(id), local_date date not null, available boolean not null, unique(mentor_id,local_date));
 create table bookings (
 id text primary key, mentor_id text not null references mentor_profiles(id), mentee_id text not null references domain_users(id), starts_at timestamptz not null, ends_at timestamptz not null, timezone text not null, state text not null check(state in ('held','confirmed','completed','expired','cancelled')), expires_at timestamptz not null, amount_minor bigint not null check(amount_minor>0), fee_minor bigint not null check(fee_minor>=0 and fee_minor<=amount_minor), currency text not null check(currency='PLN'), policy_version text not null, payment_mode text not null default 'psp' check(payment_mode in ('psp','credit')), version integer not null default 1, created_at timestamptz not null, check(ends_at>starts_at), constraint no_overlapping_mentor_bookings exclude using gist(mentor_id with =,tstzrange(starts_at,ends_at,'[)') with &&) where(state in ('held','confirmed'))
 );
 create index bookings_mentee_time on bookings(mentee_id,starts_at,id);
 create index bookings_expiry on bookings(expires_at) where(state='held');
 create table packages (id text primary key, user_id text not null references domain_users(id), mentor_id text not null references mentor_profiles(id), state text not null check(state in ('pending','active','paused','cancelled','expired')), credits integer not null default 0 check(credits>=0), expires_at timestamptz not null, auto_renew boolean not null default false, version integer not null default 1, created_at timestamptz not null);
 create table payments (id text primary key, booking_id text unique references bookings(id), package_id text unique references packages(id), amount_minor bigint not null check(amount_minor>0), currency text not null check(currency='PLN'), state text not null default 'pending' check(state in ('pending','paid','failed')), provider_payment_id text unique, checkout_id text unique, checkout_url text, created_at timestamptz not null, check((booking_id is not null)::int+(package_id is not null)::int=1));
 create table refunds (id text primary key, payment_id text not null unique references payments(id), amount_minor bigint not null check(amount_minor>0), state text not null check(state in ('requested','pending','succeeded','failed')), provider_id text unique, created_at timestamptz not null);
 create table credit_ledger (id text primary key, package_id text not null references packages(id), booking_id text references bookings(id), reference text not null, kind text not null check(kind in ('purchase','use','return')), delta integer not null, created_at timestamptz not null, unique(reference,kind));
 create table idempotency (actor_id text not null references domain_users(id), operation text not null, key text not null, payload_hash text not null, result jsonb not null, created_at timestamptz not null, primary key(actor_id,operation,key));
 create table inbox (id text primary key, provider text not null, event_id text not null, payload jsonb not null, received_at timestamptz not null, unique(provider,event_id));
 create table outbox_jobs (id text primary key, kind text not null, payload jsonb not null, state text not null default 'pending' check(state in ('pending','running','done','failed')), attempts integer not null default 0, available_at timestamptz not null, lease_until timestamptz, lease_token text, last_error_code text, created_at timestamptz not null);
 create index outbox_available on outbox_jobs(state,available_at);
 create table conversations (id text primary key, mentor_id text not null references mentor_profiles(id), mentee_id text not null references domain_users(id), created_at timestamptz not null, unique(mentor_id,mentee_id));
 create table messages (id text primary key, conversation_id text not null references conversations(id), sender_id text not null references domain_users(id), text text not null check(char_length(text) between 1 and 2000), client_message_id text not null, created_at timestamptz not null, unique(conversation_id,sender_id,client_message_id));
 create index messages_cursor on messages(conversation_id,created_at,id);
 create table private_notes (booking_id text not null references bookings(id), user_id text not null references domain_users(id), note text not null check(char_length(note)<=2000), primary key(booking_id,user_id));
 create table reviews (id text primary key, booking_id text not null unique references bookings(id), mentor_id text not null references mentor_profiles(id), user_id text not null references domain_users(id), rating integer not null check(rating between 1 and 5), comment text not null check(char_length(comment) between 10 and 1000), created_at timestamptz not null);
 create table favorites (user_id text not null references domain_users(id), mentor_id text not null references mentor_profiles(id), primary key(user_id,mentor_id));
 create table learning_plans (id text primary key, user_id text not null unique references domain_users(id), mentor_id text references mentor_profiles(id), goal text not null default '', milestones jsonb not null default '[]', version integer not null default 1);
 create table cases (id text primary key, kind text not null check(kind in ('mentor_application','support')), user_id text not null references domain_users(id), status text not null default 'pending', payload jsonb not null, decision_reason text, version integer not null default 1, created_at timestamptz not null);
 create unique index one_pending_application on cases(user_id) where(kind='mentor_application' and status='pending');
 create table audit_log (id text primary key, actor_id text not null references domain_users(id), case_id text references cases(id), action text not null, reason text not null, created_at timestamptz not null);
 create function reject_audit_mutation() returns trigger language plpgsql as $$ begin raise exception 'Audit is append-only' using errcode='42501'; end; $$;
 create trigger append_only_audit before update or delete on audit_log for each row execute function reject_audit_mutation();
 create table payouts (id text primary key, user_id text not null references domain_users(id), amount_minor bigint not null check(amount_minor>0), currency text not null check(currency='PLN'), account_id text not null, state text not null default 'pending' check(state in ('pending','succeeded','failed')), provider_id text unique, created_at timestamptz not null);
 `);
  }
  override down(): void {
    this.addSql(
      `drop table if exists payouts,audit_log,cases,learning_plans,favorites,reviews,private_notes,messages,conversations,outbox_jobs,inbox,idempotency,credit_ledger,refunds,payments,packages,bookings,availability_exceptions,availability_rules,availability_slots,mentor_profiles,domain_users cascade; drop function if exists reject_audit_mutation();`,
    );
  }
}
