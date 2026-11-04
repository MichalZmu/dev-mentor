export type Role = "mentee" | "mentor" | "moderator" | "support" | "admin";
export interface Actor {
  id: string;
  roles: Role[];
  mfaVerified: boolean;
  requestId?: string;
}
export interface Money {
  amountMinor: string;
  currency: string;
}
export type BookingState =
  "held" | "confirmed" | "completed" | "expired" | "cancelled";
export type PaymentState = "pending" | "paid" | "failed";
export type RefundState =
  "none" | "requested" | "pending" | "succeeded" | "failed";
export interface Page<T> {
  data: T[];
  nextCursor: string | null;
}
export interface UserProfile {
  id: string;
  name: string;
  email: string;
  timezone: string;
  roles: Role[];
  preferences: Record<string, unknown>;
  version: number;
}
export interface Mentor {
  id: string;
  userId: string;
  name: string;
  headline: string;
  bio: string;
  specialty: string;
  languages: string[];
  priceMinor: string;
  currency: string;
  years: number;
  rating: number;
  status: string;
  version: number;
}
export interface AvailabilitySlot {
  id: string;
  mentorId: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  available: boolean;
}
export interface Booking {
  id: string;
  mentorId: string;
  menteeId: string;
  mentorUserId: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  state: BookingState;
  expiresAt: string;
  amountMinor: string;
  currency: string;
  feeMinor: string;
  paymentState: PaymentState;
  refundState: RefundState;
  checkoutUrl: string | null;
  checkoutId: string | null;
  version: number;
  policyVersion: string;
  paymentMode: string;
}
export interface Conversation {
  id: string;
  mentorId: string;
  menteeId: string;
  mentorUserId: string;
  mentorName: string;
}
export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  createdAt: string;
}
export interface Review {
  id: string;
  bookingId: string;
  authorName: string;
  rating: number;
  comment: string;
  createdAt: string;
}
export interface Case {
  id: string;
  kind: "mentor_application" | "support";
  userId: string;
  status: string;
  payload: Record<string, unknown>;
  decisionReason: string | null;
  version: number;
  createdAt: string;
}
export interface AuditEntry {
  requestId: string;
  previousStatus: string | null;
  newStatus: string | null;
  id: string;
  actorId: string;
  caseId: string | null;
  action: string;
  reason: string;
  createdAt: string;
}
export interface Package {
  id: string;
  userId: string;
  mentorId: string;
  state: string;
  credits: number;
  expiresAt: string;
  autoRenew: boolean;
  version: number;
  amountMinor: string;
  currency: string;
  paymentState: PaymentState;
  checkoutUrl: string | null;
  checkoutId: string | null;
}
export interface PaymentOrder {
  id: string;
  kind: "booking" | "package";
  amountMinor: string;
  currency: string;
  paymentState: PaymentState;
  checkoutId: string | null;
  checkoutUrl: string | null;
}
export interface RefundOrder {
  orderId: string;
  paymentId: string;
  amountMinor: string;
  currency: string;
  providerId: string | null;
  state: string;
}
export interface DeadJob {
  id: string;
  kind: string;
  attempts: number;
  lastErrorCode: string | null;
}
export interface Payout {
  id: string;
  userId: string;
  amountMinor: string;
  currency: string;
  accountId: string;
  state: string;
  providerId: string | null;
}
export interface Job {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  attempts: number;
  leaseToken: string;
}
export interface PaymentEvent {
  refundId?: string;
  provider: string;
  eventId: string;
  bookingId: string;
  paymentId: string;
  amountMinor: string;
  currency: string;
  status: "paid" | "failed" | "refund_succeeded" | "refund_failed";
}
export interface MentorFilter {
  q?: string;
  specialty?: string;
  language?: string;
  maxPriceMinor?: string;
  sort?: string;
  cursor?: string;
  limit?: number;
}
export interface MentorInput {
  headline: string;
  bio: string;
  specialty: string;
  languages: string[];
  priceMinor: string;
  years: number;
  version?: number;
}
export interface AvailabilityRule {
  weekday: number;
  localTime: string;
  timezone: string;
  disambiguation?: "earlier" | "later" | "reject";
}
export interface CalendarException {
  localDate: string;
  available: boolean;
}
export interface SlotInput {
  startsAt: string;
  endsAt: string;
  timezone: string;
}
export interface HoldInput {
  mentorId: string;
  slotId: string;
  durationMinutes?: number;
}
export interface CheckoutInput {
  holdId: string;
  paymentMode: "psp" | "credit";
  acceptedPolicyVersion: string;
}
export interface PlatformRepository {
  ensureUser(input: {
    id: string;
    name: string;
    email: string;
    roles?: Role[];
  }): Promise<UserProfile>;
  getActor(id: string, mfaVerified?: boolean): Promise<Actor>;
  profile(actor: Actor): Promise<UserProfile>;
  updateProfile(
    actor: Actor,
    input: {
      name: string;
      timezone: string;
      preferences?: Record<string, unknown>;
      version: number;
    },
  ): Promise<UserProfile>;
  mentors(filter?: MentorFilter): Promise<Page<Mentor>>;
  mentor(id: string): Promise<Mentor>;
  availability(
    mentorId: string,
    from: string,
    to: string,
  ): Promise<AvailabilitySlot[]>;
  reviews(mentorId: string, cursor?: string): Promise<Page<Review>>;
  favorites(actor: Actor): Promise<Mentor[]>;
  setFavorite(actor: Actor, mentorId: string, active: boolean): Promise<void>;
  goals(actor: Actor): Promise<Record<string, unknown>>;
  saveGoals(
    actor: Actor,
    input: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
  createHold(
    actor: Actor,
    input: HoldInput,
    now: string,
    id: string,
  ): Promise<Booking>;
  checkout(
    actor: Actor,
    input: CheckoutInput,
    key: string,
    now: string,
  ): Promise<Booking>;
  booking(actor: Actor, id: string): Promise<Booking>;
  bookings(actor: Actor): Promise<Booking[]>;
  cancel(
    actor: Actor,
    id: string,
    reason: string,
    version: number,
    key: string,
    now: string,
  ): Promise<Booking>;
  reschedule(
    actor: Actor,
    id: string,
    slotId: string,
    version: number,
    now: string,
  ): Promise<Booking>;
  complete(actor: Actor, id: string, now: string): Promise<Booking>;
  saveNote(actor: Actor, id: string, note: string): Promise<void>;
  note(actor: Actor, id: string): Promise<string>;
  addReview(
    actor: Actor,
    id: string,
    rating: number,
    comment: string,
    now: string,
  ): Promise<Review>;
  conversations(actor: Actor): Promise<Conversation[]>;
  conversation(actor: Actor, mentorId: string): Promise<Conversation>;
  messages(actor: Actor, id: string, cursor?: string): Promise<Page<Message>>;
  sendMessage(
    actor: Actor,
    id: string,
    text: string,
    clientMessageId: string,
    now: string,
  ): Promise<Message>;
  learningPlan(actor: Actor): Promise<Record<string, unknown>>;
  saveMilestone(
    actor: Actor,
    milestoneId: string,
    completed: boolean,
    version: number,
  ): Promise<Record<string, unknown>>;
  packages(actor: Actor): Promise<Package[]>;
  buyPackage(
    actor: Actor,
    mentorId: string,
    key: string,
    now: string,
  ): Promise<Package>;
  updatePackage(
    actor: Actor,
    id: string,
    action: string,
    version: number,
  ): Promise<Package>;
  applyMentor(actor: Actor, input: MentorInput): Promise<Case>;
  ownApplication(actor: Actor): Promise<Case | null>;
  ownMentor(actor: Actor): Promise<Mentor>;
  saveMentor(actor: Actor, input: MentorInput): Promise<Mentor>;
  availabilityRules(
    actor: Actor,
  ): Promise<{ rules: AvailabilityRule[]; exceptions: CalendarException[] }>;
  saveAvailabilityRules(
    actor: Actor,
    rules: AvailabilityRule[],
    exceptions: CalendarException[],
  ): Promise<{ rules: AvailabilityRule[]; exceptions: CalendarException[] }>;
  saveAvailability(
    actor: Actor,
    slots: SlotInput[],
  ): Promise<AvailabilitySlot[]>;
  earnings(actor: Actor): Promise<Record<string, unknown>>;
  payout(
    actor: Actor,
    amountMinor: string,
    key: string,
    now: string,
  ): Promise<Payout>;
  completePayout(
    payoutId: string,
    providerId: string,
    success: boolean,
  ): Promise<void>;
  markRefundResult(
    orderId: string,
    providerId: string,
    success: boolean,
  ): Promise<void>;
  support(
    actor: Actor,
    category: string,
    description: string,
    sessionId?: string,
  ): Promise<Case>;
  ownCases(actor: Actor): Promise<Case[]>;
  adminCases(actor: Actor, kind?: string): Promise<Case[]>;
  caseDetail(
    actor: Actor,
    id: string,
  ): Promise<{ item: Case; audit: AuditEntry[] }>;
  decideCase(
    actor: Actor,
    id: string,
    action: string,
    reason: string,
    version: number,
    now: string,
  ): Promise<Case>;
  acceptPaymentEvent(event: PaymentEvent, now: string): Promise<boolean>;
  processPaymentEvent(event: PaymentEvent, now: string): Promise<void>;
  attachCheckout(id: string, checkoutId: string, url: string): Promise<void>;
  expireHolds(now: string): Promise<number>;
  claimJobs(now: string, leaseSeconds?: number): Promise<Job[]>;
  finishJob(id: string, leaseToken: string): Promise<void>;
  failJob(id: string, leaseToken: string, now: string): Promise<void>;
  pendingRefunds(): Promise<RefundOrder[]>;
  attachRefund(orderId: string, providerId: string): Promise<void>;
  failedJobs(actor: Actor): Promise<DeadJob[]>;
  retryFailedJob(actor: Actor, id: string): Promise<void>;
  paymentOrder(id: string): Promise<PaymentOrder>;
  pendingPayments(cursor?: string): Promise<PaymentOrder[]>;
  connectAccount(
    actor: Actor,
  ): Promise<{ accountId: string | null; ready: boolean }>;
  updateConnectAccount(
    userId: string,
    accountId: string,
    ready: boolean,
  ): Promise<void>;
  metrics(now: string): Promise<Record<string, number>>;
}
export interface PlatformDependencies {
  repository: PlatformRepository;
  now: () => Date;
  id: () => string;
}
