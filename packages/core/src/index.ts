export interface ApplicationInfo {
  name: string;
  description: string;
}

export const applicationInfo: Readonly<ApplicationInfo> = Object.freeze({
  name: "DevMentor",
  description: "Przestrzeń do rozwijania umiejętności programistycznych.",
});

export interface RequestMetadata {
  id: string;
}

export * from "./platform";
export * from "./policies";
export * from "./platform-service";

export type {
  Clock,
  IdentifierGenerator,
  PaymentGateway,
  Notification,
  NotificationSender,
} from "./ports";
