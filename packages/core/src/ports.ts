import type { PaymentEvent, PaymentOrder, RefundOrder } from "./platform";

export interface Clock {
  now(): Date;
}
export interface IdentifierGenerator {
  next(): string;
}
export interface PaymentGateway {
  createCheckout(order: PaymentOrder): Promise<{ id: string; url: string }>;
  expireCheckout(id: string): Promise<void>;
  retrieve(order: PaymentOrder): Promise<PaymentEvent | null>;
  refund(
    orderId: string,
    paymentId: string,
    amountMinor: string,
    currency: string,
  ): Promise<{ providerId: string; event: PaymentEvent | null }>;
  retrieveRefund(order: RefundOrder): Promise<PaymentEvent | null>;
  payout(
    id: string,
    accountId: string,
    amountMinor: string,
    currency: string,
  ): Promise<string>;
}
export interface Notification {
  userId: string;
  template: string;
  bookingId?: string;
  caseId?: string;
}
export interface NotificationSender {
  send(notification: Notification): Promise<void>;
}
