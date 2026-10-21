import "reflect-metadata";
import { test } from "node:test";
import assert from "node:assert/strict";
import { assertManualCapabilities, notificationChannelEnabled } from "../dist/config/manual-capabilities.js";
import { ManualBankVerificationProvider } from "../dist/modules/verification/verification.provider.js";
import { VerificationService } from "../dist/modules/verification/verification.service.js";
import { DisabledDeliveryProvider } from "../dist/modules/notifications/delivery.providers.js";
const config = { NODE_ENV: "production", IDENTITY_VERIFICATION_ENABLED: "false", BANK_VERIFICATION_PROVIDER: "manual-review", OTP_PROVIDER: "blacksms", AUTH_OTP_CHANNEL: "sms", BLACKSMS_API_KEY: "synthetic-test-credential", BLACKSMS_SENDER_ID: "synthetictemplate", BLACKSMS_ROUTE: "1", NOTIFICATIONS_EMAIL_ENABLED: "false", NOTIFICATIONS_SMS_ENABLED: "false", NOTIFICATIONS_PUSH_ENABLED: "false", SUPPORT_ATTACHMENTS_ENABLED: "false", PRIVATE_FINANCIAL_STORAGE: "postgres-encrypted" };
test("manual capabilities accept disabled optional channels without pretending they are healthy", () => {
 assert.doesNotThrow(() => assertManualCapabilities(config));
 for (const channel of ["EMAIL", "SMS", "PUSH"]) {
  assert.equal(notificationChannelEnabled(channel, config), false);
  assert.throws(() => assertManualCapabilities({...config, [`NOTIFICATIONS_${channel}_ENABLED`]: "true"}), /ADAPTER_NOT_REGISTERED/);
 }
});
test("real OTP configuration and private financial storage remain mandatory", () => {
 for (const key of ["OTP_PROVIDER", "AUTH_OTP_CHANNEL", "BLACKSMS_API_KEY", "BLACKSMS_SENDER_ID", "BLACKSMS_ROUTE", "PRIVATE_FINANCIAL_STORAGE"]) {
  assert.throws(() => assertManualCapabilities({...config, [key]: ""}));
 }
 assert.throws(() => assertManualCapabilities({...config, IDENTITY_VERIFICATION_ENABLED: "true"}));
 assert.throws(() => assertManualCapabilities({...config, SUPPORT_ATTACHMENTS_ENABLED: "true"}));
});
test("disabled delivery never fabricates a successful notification", async () => {
 await assert.rejects(new DisabledDeliveryProvider().send({}), /disabled/);
});
test("manual bank adapter returns pending review, never synthetic verification", async () => {
 const old = process.env.BANK_VERIFICATION_PROVIDER;
 process.env.BANK_VERIFICATION_PROVIDER = "manual-review";
 try {
  const p = new ManualBankVerificationProvider();
  const result = await p.bank("synthetic-user", "123456789", "TEST0123456");
  assert.equal(result.status, "under_review");
  assert.equal(result.sandbox, false);
  await assert.rejects(p.start("synthetic-user", "identity"));
  await assert.rejects(p.submit("reference", "identity"));
 } finally { if(old === undefined) delete process.env.BANK_VERIFICATION_PROVIDER; else process.env.BANK_VERIFICATION_PROVIDER = old; }
});
test("disabled identity routes do not read or mutate legacy verification records", async () => {
 const old = process.env.IDENTITY_VERIFICATION_ENABLED;
 process.env.IDENTITY_VERIFICATION_ENABLED = "false";
 try {
  const service = new VerificationService(null, null, null);
  for (const operation of [() => service.status("id"), () => service.start("id"), () => service.submit("id", "record")]) {
   await assert.rejects(operation, e => e.getStatus() === 404);
  }
 } finally { if(old === undefined) delete process.env.IDENTITY_VERIFICATION_ENABLED; else process.env.IDENTITY_VERIFICATION_ENABLED = old; }
});
