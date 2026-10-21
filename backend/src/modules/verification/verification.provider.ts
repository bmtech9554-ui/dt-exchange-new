import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
export type VerificationType =
  | "identity"
  | "pan"
  | "document"
  | "selfie"
  | "bank"
  | "risk";
export interface VerificationResult {
  provider: string;
  reference: string;
  status: "pending" | "under_review" | "verified" | "rejected";
  sandbox: boolean;
  reason?: string;
}
/** Vendor adapters own hosted collection/upload and authenticated decisions; client data never determines approval. */
export abstract class VerificationProvider {
  abstract start(
    userId: string,
    type: VerificationType,
  ): Promise<VerificationResult>;
  abstract submit(
    reference: string,
    type: VerificationType,
  ): Promise<VerificationResult>;
  abstract bank(
    userId: string,
    account: string,
    ifsc: string,
  ): Promise<VerificationResult>;
}
@Injectable()
export class MockVerificationProvider extends VerificationProvider {
  private assert() {
    if (
      process.env.NODE_ENV === "production" ||
      process.env.VERIFICATION_PROVIDER !== "mock"
    )
      throw new ServiceUnavailableException(
        "Verification provider not configured",
      );
  }
  async start(
    _uid: string,
    _type: VerificationType,
  ): Promise<VerificationResult> {
    this.assert();
    return {
      provider: "development_mock",
      reference: randomUUID(),
      status: "pending",
      sandbox: true,
    };
  }
  async submit(
    reference: string,
    _type: VerificationType,
  ): Promise<VerificationResult> {
    this.assert();
    const status =
      process.env.MOCK_VERIFICATION_DECISION === "verified"
        ? "verified"
        : process.env.MOCK_VERIFICATION_DECISION === "rejected"
          ? "rejected"
          : "under_review";
    return {
      provider: "development_mock",
      reference,
      status,
      sandbox: true,
      ...(status === "rejected" ? { reason: "SANDBOX_REJECTED" } : {}),
    };
  }
  async bank(uid: string, _account: string, _ifsc: string) {
    const started = await this.start(uid, "bank");
    return this.submit(started.reference, "bank");
  }
}

@Injectable()
export class ManualBankVerificationProvider extends VerificationProvider {
  async start(_uid: string, _type: VerificationType): Promise<VerificationResult> { throw new ServiceUnavailableException("Identity verification disabled"); }
  async submit(_reference: string, _type: VerificationType): Promise<VerificationResult> { throw new ServiceUnavailableException("Identity verification disabled"); }
  async bank(_uid: string, _account: string, _ifsc: string): Promise<VerificationResult> {
    if (process.env.BANK_VERIFICATION_PROVIDER !== "manual-review") throw new ServiceUnavailableException("Bank review unavailable");
    return {provider: "manual-review", reference: randomUUID(), status: "under_review", sandbox: false};
  }
}
