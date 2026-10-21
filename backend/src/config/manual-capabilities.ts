import { validDvConnectConfig } from "../modules/auth/dvconnect-otp.transport";
import { validBlackSmsConfig } from "../modules/auth/blacksms-otp.provider";
/** Explicit capabilities for the current manual product. Disabled is never healthy. */
export function notificationChannelEnabled(channel: string, s = process.env) {
  return s.NODE_ENV !== "production" ? s[`NOTIFICATIONS_${channel}_ENABLED`] !== "false" : s[`NOTIFICATIONS_${channel}_ENABLED`] === "true";
}
export function assertManualCapabilities(s: NodeJS.ProcessEnv) {
  if (s.IDENTITY_VERIFICATION_ENABLED !== "false") throw new Error("IDENTITY_ADAPTER_NOT_REGISTERED");
  if (s.BANK_VERIFICATION_PROVIDER !== "manual-review") throw new Error("MANUAL_BANK_REVIEW_REQUIRED");
  if (!["blacksms", "dvconnect"].includes(s.OTP_PROVIDER ?? "") || s.AUTH_OTP_CHANNEL !== "sms") throw new Error("PRODUCTION_SMS_OTP_ADAPTER_REQUIRED");
  if (s.OTP_PROVIDER === "dvconnect" && !validDvConnectConfig(s)) throw new Error("DVCONNECT_CREDENTIALS_REQUIRED");
  if (s.OTP_PROVIDER === "blacksms" && !validBlackSmsConfig(s)) throw new Error("BLACKSMS_CREDENTIALS_AND_SENDER_REQUIRED");
  for (const channel of ["EMAIL", "SMS", "PUSH"]) {
    if (s[`NOTIFICATIONS_${channel}_ENABLED`] !== "false") throw new Error(`NOTIFICATION_${channel}_ADAPTER_NOT_REGISTERED`);
  }
  if (s.SUPPORT_ATTACHMENTS_ENABLED !== "false") throw new Error("SUPPORT_ATTACHMENT_ADAPTER_NOT_REGISTERED");
  if (s.PRIVATE_FINANCIAL_STORAGE !== "postgres-encrypted") throw new Error("PRIVATE_FINANCIAL_STORAGE_REQUIRED");
}
