import { ServiceUnavailableException } from "@nestjs/common";
export const manualDeposits = () =>
  process.env.MANUAL_DEPOSIT_REVIEW === "true";
export const manualPayouts = () => process.env.MANUAL_PAYOUT === "true";
export const manualIdentityOptional = () =>
  process.env.NODE_ENV !== "production" && manualDeposits() && manualPayouts();
export const selfDeclaredManualBanks = () => manualIdentityOptional() && process.env.AUTOMATED_PAYOUT === 'false';
// Evidence intake only. This must never authorize ledger credit or execution.
export const manualDepositSubmissions = () =>
  manualDeposits() && process.env.AUTOMATED_BLOCKCHAIN_CREDIT === "false" &&
  process.env.MANUAL_DEPOSIT_SUBMISSIONS_ENABLED === "true";
export function requireManual(kind: "deposit" | "payout") {
  if (!(kind === "deposit" ? manualDeposits() : manualPayouts()))
    throw new ServiceUnavailableException("Manual operation unavailable");
}
export function assertManualMode(s: NodeJS.ProcessEnv) {
  if (
    s.MANUAL_DEPOSIT_REVIEW === "true" &&
    s.AUTOMATED_BLOCKCHAIN_CREDIT !== "false"
  )
    throw new Error("AUTOMATIC_CREDIT_MUST_BE_DISABLED");
  if (s.MANUAL_PAYOUT === "true" && s.AUTOMATED_PAYOUT !== "false")
    throw new Error("AUTOMATIC_PAYOUT_MUST_BE_DISABLED");
}
