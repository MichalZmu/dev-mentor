import { defineEntity } from "@mikro-orm/core";

// Full column metadata mirrors the SQL-owned domain migrations. PostgreSQL-only
// constraints/triggers are authoritative; automatic schema diff excludes these tables.
export const DomainUsersSchema = defineEntity({
  name: "DomainUsersSchema",
  tableName: "domain_users",
  properties: (p) => ({
    id: p.text().primary(),
    name: p.text(),
    email: p.text(),
    timezone: p.text(),
    roles: p.json<unknown>().columnType("jsonb"),
    preferences: p.json<unknown>().columnType("jsonb"),
    goals: p.json<unknown>().columnType("jsonb"),
    version: p.integer(),
    connect_account_id: p.text().nullable(),
    connect_ready: p.boolean(),
  }),
});

export const MentorProfilesSchema = defineEntity({
  name: "MentorProfilesSchema",
  tableName: "mentor_profiles",
  properties: (p) => ({
    id: p.text().primary(),
    user_id: p.text(),
    headline: p.text(),
    bio: p.text(),
    specialty: p.text(),
    languages: p.json<unknown>().columnType("jsonb"),
    price_minor: p.bigint("string"),
    currency: p.text(),
    years: p.integer(),
    status: p.text(),
    version: p.integer(),
  }),
});

export const AvailabilitySlotsSchema = defineEntity({
  name: "AvailabilitySlotsSchema",
  tableName: "availability_slots",
  properties: (p) => ({
    id: p.text().primary(),
    mentor_id: p.text(),
    starts_at: p.datetime().columnType("timestamptz"),
    ends_at: p.datetime().columnType("timestamptz"),
    timezone: p.text(),
    source: p.text(),
    manual_offered: p.boolean(),
    rule_offered: p.boolean(),
    active: p.boolean().generated("(manual_offered or rule_offered)"),
  }),
});

export const AvailabilityRulesSchema = defineEntity({
  name: "AvailabilityRulesSchema",
  tableName: "availability_rules",
  properties: (p) => ({
    id: p.text().primary(),
    mentor_id: p.text(),
    weekday: p.integer(),
    local_time: p.time(),
    timezone: p.text(),
    disambiguation: p.text(),
  }),
});

export const AvailabilityExceptionsSchema = defineEntity({
  name: "AvailabilityExceptionsSchema",
  tableName: "availability_exceptions",
  properties: (p) => ({
    id: p.text().primary(),
    mentor_id: p.text(),
    local_date: p.date(),
    available: p.boolean(),
  }),
});

export const BookingsSchema = defineEntity({
  name: "BookingsSchema",
  tableName: "bookings",
  properties: (p) => ({
    id: p.text().primary(),
    mentor_id: p.text(),
    mentee_id: p.text(),
    starts_at: p.datetime().columnType("timestamptz"),
    ends_at: p.datetime().columnType("timestamptz"),
    timezone: p.text(),
    state: p.text(),
    expires_at: p.datetime().columnType("timestamptz"),
    amount_minor: p.bigint("string"),
    fee_minor: p.bigint("string"),
    currency: p.text(),
    policy_version: p.text(),
    payment_mode: p.text(),
    version: p.integer(),
    created_at: p.datetime().columnType("timestamptz"),
  }),
});

export const PackagesSchema = defineEntity({
  name: "PackagesSchema",
  tableName: "packages",
  properties: (p) => ({
    id: p.text().primary(),
    user_id: p.text(),
    mentor_id: p.text(),
    state: p.text(),
    credits: p.integer(),
    expires_at: p.datetime().columnType("timestamptz"),
    auto_renew: p.boolean(),
    version: p.integer(),
    created_at: p.datetime().columnType("timestamptz"),
  }),
});

export const PaymentsSchema = defineEntity({
  name: "PaymentsSchema",
  tableName: "payments",
  properties: (p) => ({
    id: p.text().primary(),
    booking_id: p.text().nullable(),
    package_id: p.text().nullable(),
    amount_minor: p.bigint("string"),
    currency: p.text(),
    state: p.text(),
    checkout_mode: p.text().nullable(),
    provider_payment_id: p.text().nullable(),
    checkout_id: p.text().nullable(),
    checkout_url: p.text().nullable(),
    created_at: p.datetime().columnType("timestamptz"),
  }),
});

export const RefundsSchema = defineEntity({
  name: "RefundsSchema",
  tableName: "refunds",
  properties: (p) => ({
    id: p.text().primary(),
    payment_id: p.text(),
    amount_minor: p.bigint("string"),
    state: p.text(),
    provider_id: p.text().nullable(),
    provider_payment_id: p.text().nullable(),
    currency: p.text(),
    kind: p.text(),
    created_at: p.datetime().columnType("timestamptz"),
  }),
});

export const CreditLedgerSchema = defineEntity({
  name: "CreditLedgerSchema",
  tableName: "credit_ledger",
  properties: (p) => ({
    id: p.text().primary(),
    package_id: p.text(),
    booking_id: p.text().nullable(),
    reference: p.text(),
    kind: p.text(),
    delta: p.integer(),
    created_at: p.datetime().columnType("timestamptz"),
  }),
});

export const IdempotencySchema = defineEntity({
  name: "IdempotencySchema",
  tableName: "idempotency",
  properties: (p) => ({
    actor_id: p.text().primary(),
    operation: p.text().primary(),
    key: p.text().primary(),
    payload_hash: p.text(),
    result: p.json<unknown>().columnType("jsonb"),
    created_at: p.datetime().columnType("timestamptz"),
  }),
});

export const InboxSchema = defineEntity({
  name: "InboxSchema",
  tableName: "inbox",
  properties: (p) => ({
    id: p.text().primary(),
    provider: p.text(),
    event_id: p.text(),
    payload: p.json<unknown>().columnType("jsonb"),
    received_at: p.datetime().columnType("timestamptz"),
  }),
});

export const OutboxJobsSchema = defineEntity({
  name: "OutboxJobsSchema",
  tableName: "outbox_jobs",
  properties: (p) => ({
    id: p.text().primary(),
    kind: p.text(),
    payload: p.json<unknown>().columnType("jsonb"),
    state: p.text(),
    attempts: p.integer(),
    available_at: p.datetime().columnType("timestamptz"),
    lease_until: p.datetime().columnType("timestamptz").nullable(),
    lease_token: p.text().nullable(),
    last_error_code: p.text().nullable(),
    created_at: p.datetime().columnType("timestamptz"),
  }),
});

export const ConversationsSchema = defineEntity({
  name: "ConversationsSchema",
  tableName: "conversations",
  properties: (p) => ({
    id: p.text().primary(),
    mentor_id: p.text(),
    mentee_id: p.text(),
    created_at: p.datetime().columnType("timestamptz"),
  }),
});

export const MessagesSchema = defineEntity({
  name: "MessagesSchema",
  tableName: "messages",
  properties: (p) => ({
    id: p.text().primary(),
    conversation_id: p.text(),
    sender_id: p.text(),
    text: p.text(),
    client_message_id: p.text(),
    created_at: p.datetime().columnType("timestamptz"),
  }),
});

export const PrivateNotesSchema = defineEntity({
  name: "PrivateNotesSchema",
  tableName: "private_notes",
  properties: (p) => ({
    booking_id: p.text().primary(),
    user_id: p.text().primary(),
    note: p.text(),
  }),
});

export const ReviewsSchema = defineEntity({
  name: "ReviewsSchema",
  tableName: "reviews",
  properties: (p) => ({
    id: p.text().primary(),
    booking_id: p.text(),
    mentor_id: p.text(),
    user_id: p.text(),
    rating: p.integer(),
    comment: p.text(),
    created_at: p.datetime().columnType("timestamptz"),
  }),
});

export const FavoritesSchema = defineEntity({
  name: "FavoritesSchema",
  tableName: "favorites",
  properties: (p) => ({
    user_id: p.text().primary(),
    mentor_id: p.text().primary(),
  }),
});

export const LearningPlansSchema = defineEntity({
  name: "LearningPlansSchema",
  tableName: "learning_plans",
  properties: (p) => ({
    id: p.text().primary(),
    user_id: p.text(),
    mentor_id: p.text().nullable(),
    goal: p.text(),
    milestones: p.json<unknown>().columnType("jsonb"),
    version: p.integer(),
  }),
});

export const CasesSchema = defineEntity({
  name: "CasesSchema",
  tableName: "cases",
  properties: (p) => ({
    id: p.text().primary(),
    kind: p.text(),
    user_id: p.text(),
    status: p.text(),
    payload: p.json<unknown>().columnType("jsonb"),
    decision_reason: p.text().nullable(),
    version: p.integer(),
    created_at: p.datetime().columnType("timestamptz"),
  }),
});

export const AuditLogSchema = defineEntity({
  name: "AuditLogSchema",
  tableName: "audit_log",
  properties: (p) => ({
    id: p.text().primary(),
    actor_id: p.text(),
    case_id: p.text().nullable(),
    request_id: p.text(),
    previous_status: p.text().nullable(),
    new_status: p.text().nullable(),
    action: p.text(),
    reason: p.text(),
    created_at: p.datetime().columnType("timestamptz"),
  }),
});

export const PayoutsSchema = defineEntity({
  name: "PayoutsSchema",
  tableName: "payouts",
  properties: (p) => ({
    id: p.text().primary(),
    user_id: p.text(),
    amount_minor: p.bigint("string"),
    currency: p.text(),
    account_id: p.text(),
    state: p.text(),
    provider_id: p.text().nullable(),
    created_at: p.datetime().columnType("timestamptz"),
  }),
});

export const DemoSeedStateSchema = defineEntity({
  name: "DemoSeedStateSchema",
  tableName: "demo_seed_state",
  properties: (p) => ({
    id: p.text().primary(),
    started_at: p.datetime().columnType("timestamptz"),
    completed_at: p.datetime().columnType("timestamptz").nullable(),
  }),
});

export const domainEntities = [
  DemoSeedStateSchema,
  DomainUsersSchema,
  MentorProfilesSchema,
  AvailabilitySlotsSchema,
  AvailabilityRulesSchema,
  AvailabilityExceptionsSchema,
  BookingsSchema,
  PackagesSchema,
  PaymentsSchema,
  RefundsSchema,
  CreditLedgerSchema,
  IdempotencySchema,
  InboxSchema,
  OutboxJobsSchema,
  ConversationsSchema,
  MessagesSchema,
  PrivateNotesSchema,
  ReviewsSchema,
  FavoritesSchema,
  LearningPlansSchema,
  CasesSchema,
  AuditLogSchema,
  PayoutsSchema,
];
export const domainTableNames = [
  "demo_seed_state",
  "domain_users",
  "mentor_profiles",
  "availability_slots",
  "availability_rules",
  "availability_exceptions",
  "bookings",
  "packages",
  "payments",
  "refunds",
  "credit_ledger",
  "idempotency",
  "inbox",
  "outbox_jobs",
  "conversations",
  "messages",
  "private_notes",
  "reviews",
  "favorites",
  "learning_plans",
  "cases",
  "audit_log",
  "payouts",
];
