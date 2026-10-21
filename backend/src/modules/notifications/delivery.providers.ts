import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { createHash } from "node:crypto";
export type DeliveryInput = {
  signal?: AbortSignal;
  key: string;
  destination: string;
  title: string;
  message: string;
  template:
    | "OTP"
    | "SECURITY"
    | "TRANSACTION"
    | "PAYOUT"
    | "SUPPORT"
    | "SYSTEM";
};
export type DeliveryResult = {
  reference: string;
  status: "SENT" | "DELIVERED";
  sandbox: boolean;
};
export abstract class PushNotificationProvider {
  abstract send(input: DeliveryInput): Promise<DeliveryResult>;
}
export abstract class EmailProvider {
  abstract send(input: DeliveryInput): Promise<DeliveryResult>;
}
export abstract class SmsProvider {
  abstract send(input: DeliveryInput): Promise<DeliveryResult>;
}
function mock(input: DeliveryInput): DeliveryResult {
  if (process.env.NODE_ENV === "production")
    throw new ServiceUnavailableException("Development delivery disabled");
  return {
    reference:
      "SANDBOX-" +
      createHash("sha256").update(input.key).digest("hex").slice(0, 24),
    status: "SENT",
    sandbox: true,
  };
}
@Injectable()
export class MockPushProvider extends PushNotificationProvider {
  async send(i: DeliveryInput) {
    return mock(i);
  }
}
@Injectable()
export class MockEmailProvider extends EmailProvider {
  async send(i: DeliveryInput) {
    return mock(i);
  }
}
@Injectable()
export class MockSmsProvider extends SmsProvider {
  async send(i: DeliveryInput) {
    return mock(i);
  }
}
export const notificationTemplates = {
  OTP: "Your verification code",
  SECURITY: "Security update",
  TRANSACTION: "Transaction update",
  PAYOUT: "Payout update",
  SUPPORT: "Support reply",
  SYSTEM: "DT Exchange update",
} as const;

/** Disabled channels never claim a successful delivery. */
export class DisabledDeliveryProvider {
  async send(_input: DeliveryInput): Promise<DeliveryResult> {
    throw new ServiceUnavailableException("Notification channel disabled");
  }
}
