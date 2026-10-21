import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { OtpProvider, OtpDelivery } from "./otp.provider";
import { requestDvConnectV1 } from "./dvconnect-otp.transport";
/** Contract observed in one authorized v1 request, 2026-10-07.
 * Acceptance is not a handset-delivery receipt. Unknown responses fail closed. */
export function dvConnectAccepted(raw: string): boolean {
  try {
    const body = JSON.parse(raw) as Record<string, unknown>;
    return body !== null && body.return === true &&
      typeof body.request_id === "number" && Number.isSafeInteger(body.request_id) && body.request_id > 0 &&
      Array.isArray(body.message) && body.message.length === 1 && body.message[0] === "Message sent successfully";
  } catch { return false; }
}
@Injectable()
export class DvConnectOtpProvider extends OtpProvider {
  async send(delivery: OtpDelivery): Promise<void> {
    const raw = await requestDvConnectV1(delivery);
    if (!dvConnectAccepted(raw)) throw new ServiceUnavailableException("SMS authentication unavailable");
  }
}
